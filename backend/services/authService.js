const {
  createHmac,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 65_536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

function getTokenSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    const error = new Error('Authentication is not configured. Set JWT_SECRET to at least 32 characters.');
    error.status = 503;
    throw error;
  }
  return secret;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltValue, hashValue] = String(storedHash || '').split('$');
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  if (
    algorithm !== 'scrypt'
    || !Number.isSafeInteger(cost)
    || cost < 2 ** 14
    || cost > 2 ** 18
    || !Number.isSafeInteger(blockSize)
    || blockSize < 1
    || blockSize > 16
    || !Number.isSafeInteger(parallelization)
    || parallelization < 1
    || parallelization > 4
    || !saltValue
    || !hashValue
  ) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedKey = Buffer.from(hashValue, 'base64url');
  if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;

  const actualKey = await scrypt(password, salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 128 * 1024 * 1024,
  });
  return timingSafeEqual(expectedKey, actualKey);
}

function signToken(user) {
  const secret = getTokenSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: String(user.userId),
    email: user.email,
    userName: user.userName,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  })).toString('base64url');
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
}

function verifyToken(token) {
  const secret = getTokenSecret();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerValue, payloadValue, signatureValue] = parts;
  const expectedSignature = createHmac('sha256', secret)
    .update(`${headerValue}.${payloadValue}`)
    .digest();
  const providedSignature = Buffer.from(signatureValue, 'base64url');
  if (
    providedSignature.length !== expectedSignature.length
    || !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const header = JSON.parse(Buffer.from(headerValue, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadValue, 'base64url').toString('utf8'));
    if (
      header.alg !== 'HS256'
      || typeof payload.sub !== 'string'
      || !Number.isSafeInteger(Number(payload.sub))
      || !Number.isSafeInteger(payload.exp)
      || payload.exp <= Math.floor(Date.now() / 1000)
      || typeof payload.email !== 'string'
      || typeof payload.userName !== 'string'
    ) {
      return null;
    }
    return {
      userId: Number(payload.sub),
      email: payload.email,
      userName: payload.userName,
    };
  } catch {
    return null;
  }
}

module.exports = { getTokenSecret, hashPassword, signToken, verifyPassword, verifyToken };

const pool = require('../config/db');
const {
  getTokenSecret,
  hashPassword,
  signToken,
  verifyPassword,
} = require('../services/authService');

const dummyPasswordHash = 'scrypt$65536$8$1$MTIzNDU2Nzg5MDEyMzQ1Ng$' + 'A'.repeat(86);

function getRegistrationInput(body = {}) {
  const userName = typeof body.userName === 'string' ? body.userName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const department = typeof body.department === 'string' ? body.department.trim() : null;
  const contactInfo = typeof body.contactInfo === 'string' ? body.contactInfo.trim() : null;

  if (body.department != null && typeof body.department !== 'string') {
    return { error: 'Department must be text.' };
  }
  if (body.contactInfo != null && typeof body.contactInfo !== 'string') {
    return { error: 'Contact information must be text.' };
  }
  if (!userName || userName.length > 100) return { error: 'Name must contain 1–100 characters.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: 'Enter a valid email address (maximum 254 characters).' };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: 'Password must contain 8–128 characters.' };
  }
  if (department && department.length > 100) return { error: 'Department must be at most 100 characters.' };
  if (contactInfo && contactInfo.length > 150) return { error: 'Contact information must be at most 150 characters.' };

  return { userName, email, password, department, contactInfo };
}

async function register(req, res) {
  const input = getRegistrationInput(req.body);
  if (input.error) {
    return res.status(400).json({ status: 'error', message: input.error });
  }

  getTokenSecret();
  const passwordHash = await hashPassword(input.password);
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [userResult] = await connection.execute(
      'INSERT INTO `user` (UserName, Department, ContactInfo) VALUES (?, ?, ?)',
      [input.userName, input.department || null, input.contactInfo || null],
    );
    const user = {
      userId: userResult.insertId,
      userName: input.userName,
      email: input.email,
    };
    await connection.execute(
      'INSERT INTO auth_credential (UserID, Email, PasswordHash) VALUES (?, ?, ?)',
      [user.userId, user.email, passwordHash],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'An account with that email already exists.' });
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function login(req, res) {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || email.length > 254 || !password || password.length > 128) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required.' });
  }

  const [rows] = await pool.execute(
    `SELECT
      ac.UserID AS userId,
      ac.Email AS email,
      ac.PasswordHash AS passwordHash,
      u.UserName AS userName
    FROM auth_credential AS ac
    INNER JOIN \`user\` AS u ON u.UserID = ac.UserID
    WHERE ac.Email = ?`,
    [email],
  );
  const credential = rows[0];
  const passwordMatches = await verifyPassword(password, credential?.passwordHash || dummyPasswordHash);
  if (!credential || !passwordMatches) {
    return res.status(401).json({ status: 'error', message: 'Email or password is incorrect.' });
  }

  const user = {
    userId: Number(credential.userId),
    userName: credential.userName,
    email: credential.email,
  };
  return res.status(200).json({ user, token: signToken(user) });
}

function getCurrentUser(req, res) {
  return res.status(200).json({ user: req.user });
}

module.exports = { getCurrentUser, login, register };

const { verifyToken } = require('../services/authService');

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  const user = match ? verifyToken(match[1]) : null;

  if (!user) {
    return res.status(401).json({
      status: 'error',
      message: 'A valid bearer token is required.',
    });
  }

  req.user = user;
  return next();
}

module.exports = requireAuth;

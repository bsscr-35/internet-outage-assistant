const express = require('express');
const { getCurrentUser, login, register } = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getCurrentUser);

module.exports = router;

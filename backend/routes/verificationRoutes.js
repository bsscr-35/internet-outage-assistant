const express = require('express');
const {
  createServiceVerification,
  getServiceVerifications,
} = require('../controllers/verificationController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/service-verifications', getServiceVerifications);
router.post('/service-verifications', requireAuth, createServiceVerification);

module.exports = router;

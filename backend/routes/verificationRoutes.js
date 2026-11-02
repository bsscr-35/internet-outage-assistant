const express = require('express');
const { getServiceVerifications } = require('../controllers/verificationController');

const router = express.Router();

router.get('/service-verifications', getServiceVerifications);

module.exports = router;

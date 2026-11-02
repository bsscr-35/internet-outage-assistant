const express = require('express');
const {
  getRecoveryActions,
  getRecoveryLogs,
  getRecoveryStatusAudit,
} = require('../controllers/recoveryController');

const router = express.Router();

router.get('/recovery-actions', getRecoveryActions);
router.get('/recovery-logs', getRecoveryLogs);
router.get('/recovery-status-audit', getRecoveryStatusAudit);

module.exports = router;

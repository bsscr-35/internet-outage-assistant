const express = require('express');
const {
  createRecoveryAction,
  getRecoveryActions,
  getRecoveryActionsForOutage,
  getRecoveryLogs,
  getRecoveryStatusAudit,
  updateRecoveryActionStatus,
} = require('../controllers/recoveryController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/recovery-actions', getRecoveryActions);
router.post('/recovery-actions', requireAuth, createRecoveryAction);
router.get('/outages/:id/recovery-actions', getRecoveryActionsForOutage);
router.patch('/recovery-actions/:id/status', requireAuth, updateRecoveryActionStatus);
router.get('/recovery-logs', getRecoveryLogs);
router.get('/recovery-status-audit', getRecoveryStatusAudit);

module.exports = router;

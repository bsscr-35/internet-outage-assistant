const pool = require('../config/db');

async function getRecoveryActions(req, res) {
  const [actions] = await pool.query(`
    SELECT
      ActionID AS actionId,
      OutageID AS outageId,
      ActionType AS actionType,
      Description AS description,
      Priority AS priority,
      RecommendedAt AS recommendedAt,
      Status AS status
    FROM recovery_action
    ORDER BY RecommendedAt DESC, ActionID DESC
  `);

  res.status(200).json({ actions });
}

async function getRecoveryLogs(req, res) {
  const [logs] = await pool.query(`
    SELECT
      rl.RecoveryID AS recoveryId,
      rl.ActionID AS actionId,
      ra.OutageID AS outageId,
      ra.ActionType AS actionType,
      rl.AssignedTo AS assignedTo,
      rl.StartedAt AS startedAt,
      rl.CompletedAt AS completedAt,
      rl.Status AS status,
      rl.Remarks AS remarks
    FROM recovery_log AS rl
    INNER JOIN recovery_action AS ra ON ra.ActionID = rl.ActionID
    ORDER BY rl.StartedAt DESC, rl.RecoveryID DESC
  `);

  res.status(200).json({ logs });
}

async function getRecoveryStatusAudit(req, res) {
  const [audit] = await pool.query(`
    SELECT
      rsa.AuditID AS auditId,
      rsa.ActionID AS actionId,
      ra.OutageID AS outageId,
      ra.ActionType AS actionType,
      rsa.OldStatus AS oldStatus,
      rsa.NewStatus AS newStatus,
      rsa.ChangedAt AS changedAt
    FROM recovery_status_audit AS rsa
    INNER JOIN recovery_action AS ra ON ra.ActionID = rsa.ActionID
    ORDER BY rsa.ChangedAt DESC, rsa.AuditID DESC
  `);

  res.status(200).json({ audit });
}

module.exports = { getRecoveryActions, getRecoveryLogs, getRecoveryStatusAudit };

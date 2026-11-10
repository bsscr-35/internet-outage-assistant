const pool = require('../config/db');
const { addServiceNames, getServiceNames } = require('../services/serviceNames');

function parsePositiveInteger(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseRecommendedAt(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    year < 1000
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:00`;
}

async function getRecoveryActions(req, res) {
  const [actions] = await pool.execute(`
    SELECT
      ra.ActionID AS actionId,
      ra.OutageID AS outageId,
      ra.ActionType AS actionType,
      ra.Description AS description,
      ra.Priority AS priority,
      ra.RecommendedAt AS recommendedAt,
      ra.Status AS status,
      (
        SELECT GROUP_CONCAT(DISTINCT oi.ServiceID ORDER BY oi.ServiceID)
        FROM outage_impact AS oi
        WHERE oi.OutageID = ra.OutageID
      ) AS serviceIds
    FROM recovery_action AS ra
    INNER JOIN outage AS o ON o.OutageID = ra.OutageID
    WHERE o.OwnerUserID = ?
    ORDER BY ra.RecommendedAt DESC, ra.ActionID DESC
  `, [req.user.userId]);

  res.status(200).json({ actions: addServiceNames(actions) });
}

async function getRecoveryActionsForOutage(req, res) {
  const outageId = parsePositiveInteger(req.params.id);
  if (!outageId) {
    return res.status(400).json({ status: 'error', message: 'Outage ID must be a positive integer.' });
  }

  const [outages] = await pool.execute(
    'SELECT OutageID FROM outage WHERE OutageID = ? AND OwnerUserID = ?',
    [outageId, req.user.userId],
  );
  if (outages.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Outage not found.' });
  }

  const [actions] = await pool.execute(`
    SELECT
      ActionID AS actionId,
      OutageID AS outageId,
      ActionType AS actionType,
      Description AS description,
      Priority AS priority,
      RecommendedAt AS recommendedAt,
      Status AS status,
      (
        SELECT GROUP_CONCAT(DISTINCT oi.ServiceID ORDER BY oi.ServiceID)
        FROM outage_impact AS oi
        WHERE oi.OutageID = recovery_action.OutageID
      ) AS serviceIds
    FROM recovery_action
    WHERE OutageID = ?
    ORDER BY RecommendedAt DESC, ActionID DESC
  `, [outageId]);

  return res.status(200).json({ actions: addServiceNames(actions) });
}

async function createRecoveryAction(req, res) {
  const body = req.body || {};
  const outageId = parsePositiveInteger(String(body.outageId ?? ''));
  const actionType = typeof body.actionType === 'string' ? body.actionType.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const priority = typeof body.priority === 'string' ? body.priority.trim().toUpperCase() : '';
  const recommendedAt = parseRecommendedAt(body.recommendedAt);

  if (!outageId) {
    return res.status(400).json({ status: 'error', message: 'Outage ID must be a positive integer.' });
  }
  if (!actionType || actionType.length > 100) {
    return res.status(400).json({ status: 'error', message: 'Action type must contain 1–100 characters.' });
  }
  if (!description || description.length > 255) {
    return res.status(400).json({ status: 'error', message: 'Description must contain 1–255 characters.' });
  }
  if (!priority || priority.length > 20) {
    return res.status(400).json({ status: 'error', message: 'Priority must contain 1–20 characters.' });
  }
  if (!recommendedAt) {
    return res.status(400).json({ status: 'error', message: 'Recommendation time must be a valid local date and time.' });
  }

  const [outages] = await pool.execute(
    `SELECT OutageID,
       (SELECT GROUP_CONCAT(DISTINCT oi.ServiceID ORDER BY oi.ServiceID)
        FROM outage_impact AS oi
        WHERE oi.OutageID = outage.OutageID) AS serviceIds
     FROM outage
     WHERE OutageID = ? AND OwnerUserID = ?`,
    [outageId, req.user.userId],
  );
  if (outages.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Outage not found.' });
  }

  const [result] = await pool.execute(
    `INSERT INTO recovery_action (OutageID, ActionType, Description, Priority, RecommendedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [outageId, actionType, description, priority, recommendedAt],
  );
  return res.status(201).json({
    action: {
      actionId: result.insertId,
      outageId,
      actionType,
      description,
      priority,
      recommendedAt,
      status: 'PENDING',
      serviceNames: getServiceNames(outages[0].serviceIds),
    },
  });
}

async function getRecoveryLogs(req, res) {
  const [logs] = await pool.execute(`
    SELECT
      rl.RecoveryID AS recoveryId,
      rl.ActionID AS actionId,
      ra.OutageID AS outageId,
      ra.ActionType AS actionType,
      ra.Status AS actionStatus,
      rl.AssignedTo AS assignedTo,
      rl.StartedAt AS startedAt,
      rl.CompletedAt AS completedAt,
      rl.Status AS status,
      rl.Remarks AS remarks,
      nc.ComponentName AS componentName,
      l.LocationName AS locationName,
      l.Region AS region,
      (
        SELECT GROUP_CONCAT(DISTINCT oi.ServiceID ORDER BY oi.ServiceID)
        FROM outage_impact AS oi
        WHERE oi.OutageID = o.OutageID
      ) AS serviceIds
    FROM recovery_log AS rl
    INNER JOIN recovery_action AS ra ON ra.ActionID = rl.ActionID
    INNER JOIN outage AS o ON o.OutageID = ra.OutageID
    INNER JOIN network_component AS nc
      ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
    INNER JOIN location AS l
      ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
    WHERE o.OwnerUserID = ?
    ORDER BY rl.StartedAt DESC, rl.RecoveryID DESC
  `, [req.user.userId]);

  res.status(200).json({ logs: addServiceNames(logs) });
}

async function getRecoveryStatusAudit(req, res) {
  const [audit] = await pool.execute(`
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
    INNER JOIN outage AS o ON o.OutageID = ra.OutageID
    WHERE o.OwnerUserID = ?
    ORDER BY rsa.ChangedAt DESC, rsa.AuditID DESC
  `, [req.user.userId]);

  res.status(200).json({ audit });
}

async function updateRecoveryActionStatus(req, res) {
  const actionId = Number(req.params.id);
  const body = req.body || {};
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : null;
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(actionId)) {
    return res.status(400).json({ status: 'error', message: 'Action ID must be a positive integer.' });
  }
  if (body.remarks != null && typeof body.remarks !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Remarks must be text.' });
  }
  if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Recovery status must be PENDING, IN_PROGRESS, or COMPLETED.',
    });
  }
  if (remarks && remarks.length > 255) {
    return res.status(400).json({ status: 'error', message: 'Remarks must be at most 255 characters.' });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [actions] = await connection.execute(
      `SELECT ra.Status
       FROM recovery_action AS ra
       INNER JOIN outage AS o ON o.OutageID = ra.OutageID
       WHERE ra.ActionID = ? AND o.OwnerUserID = ?
       FOR UPDATE`,
      [actionId, req.user.userId],
    );
    if (actions.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ status: 'error', message: 'Recovery action not found.' });
    }

    const previousStatus = String(actions[0].Status).toUpperCase();
    const allowedNextStatus = {
      PENDING: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    }[previousStatus];
    if (previousStatus !== status && allowedNextStatus !== status) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        status: 'error',
        message: 'Recovery actions can only progress from PENDING to IN_PROGRESS to COMPLETED.',
      });
    }

    if (previousStatus !== status) {
      await connection.execute(
        'UPDATE recovery_action SET Status = ? WHERE ActionID = ?',
        [status, actionId],
      );
      await connection.execute(
        `INSERT INTO recovery_log (ActionID, AssignedTo, StartedAt, CompletedAt, Status, Remarks)
         VALUES (?, ?, CASE WHEN ? = 'PENDING' THEN NULL ELSE NOW() END,
           CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE NULL END, ?, ?)`,
        [actionId, req.user.userName, status, status, status, remarks],
      );
    }

    await connection.commit();
    transactionStarted = false;
    return res.status(200).json({
      action: { actionId, status, updated: previousStatus !== status },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRecoveryAction,
  getRecoveryActions,
  getRecoveryActionsForOutage,
  getRecoveryLogs,
  getRecoveryStatusAudit,
  updateRecoveryActionStatus,
};

const pool = require('../config/db');

async function getDashboardStats(req, res) {
  const [rows] = await pool.execute(`
    SELECT
      COUNT(*) AS totalOutages,
      COALESCE(SUM(CASE WHEN UPPER(o.Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
      COALESCE(SUM(CASE WHEN UPPER(o.Status) = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedOutages,
      COALESCE(SUM(CASE WHEN UPPER(o.Severity) = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS criticalOutages,
      COALESCE(SUM(CASE WHEN UPPER(o.Severity) = 'HIGH' THEN 1 ELSE 0 END), 0) AS highSeverityOutages,
      COALESCE((
        SELECT COUNT(DISTINCT nc.LocationID)
        FROM outage AS locationOutages
        INNER JOIN network_component AS nc
          ON nc.ComponentID = locationOutages.ComponentID
          AND nc.OwnerUserID = locationOutages.OwnerUserID
        WHERE locationOutages.OwnerUserID = ?
      ), 0) AS affectedLocations,
      COALESCE((
        SELECT SUM(oi.UsersAffected)
        FROM outage_impact AS oi
        INNER JOIN outage AS impactedOutage ON impactedOutage.OutageID = oi.OutageID
        WHERE impactedOutage.OwnerUserID = ?
      ), 0) AS totalAffectedUsers,
      (SELECT COUNT(*) FROM recovery_action AS ra
       INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
       WHERE recoveryOutage.OwnerUserID = ?) AS totalRecoveryActions,
      (SELECT COUNT(*) FROM recovery_action AS ra
       INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
       WHERE recoveryOutage.OwnerUserID = ? AND UPPER(ra.Status) = 'COMPLETED') AS completedRecoveryActions,
      (SELECT COUNT(*) FROM recovery_action AS ra
       INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
       WHERE recoveryOutage.OwnerUserID = ? AND UPPER(ra.Status) = 'IN_PROGRESS') AS inProgressRecoveryActions,
      (SELECT COUNT(*) FROM recovery_log AS rl
       INNER JOIN recovery_action AS ra ON ra.ActionID = rl.ActionID
       INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
       WHERE recoveryOutage.OwnerUserID = ?) AS totalRecoveryLogs
    FROM outage AS o
    WHERE o.OwnerUserID = ?
  `, Array(7).fill(req.user.userId));
  const stats = Object.fromEntries(
    Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
  );

  res.status(200).json({ stats });
}

module.exports = { getDashboardStats };

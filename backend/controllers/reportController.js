const pool = require('../config/db');

async function getReportSummary(req, res) {
  const [summaryRows, severityDistribution, recoverySummary, locationSummary, incidentSummary] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS totalOutages,
        COALESCE(SUM(CASE WHEN UPPER(Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
        COALESCE(SUM(CASE WHEN UPPER(Status) = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedOutages,
        COALESCE((
          SELECT SUM(oi.UsersAffected)
          FROM outage_impact AS oi
          INNER JOIN outage AS impactedOutage ON impactedOutage.OutageID = oi.OutageID
          WHERE impactedOutage.OwnerUserID = ?
        ), 0) AS totalAffectedUsers,
        (
          SELECT COUNT(*)
          FROM recovery_action AS ra
          INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
          WHERE recoveryOutage.OwnerUserID = ?
        ) AS totalRecoveryActions,
        (
          SELECT COUNT(*)
          FROM recovery_action AS ra
          INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
          WHERE recoveryOutage.OwnerUserID = ? AND UPPER(ra.Status) = 'COMPLETED'
        ) AS completedRecoveryActions,
        (
          SELECT COUNT(*)
          FROM recovery_action AS ra
          INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
          WHERE recoveryOutage.OwnerUserID = ? AND UPPER(ra.Status) = 'IN_PROGRESS'
        ) AS inProgressRecoveryActions,
        (
          SELECT COUNT(*)
          FROM recovery_log AS rl
          INNER JOIN recovery_action AS ra ON ra.ActionID = rl.ActionID
          INNER JOIN outage AS recoveryOutage ON recoveryOutage.OutageID = ra.OutageID
          WHERE recoveryOutage.OwnerUserID = ?
        ) AS totalRecoveryLogs
      FROM outage
      WHERE OwnerUserID = ?
    `, Array(6).fill(req.user.userId)),
    pool.execute(`
      SELECT
        COALESCE(UPPER(Severity), 'UNKNOWN') AS severity,
        COUNT(*) AS count
      FROM outage
      WHERE OwnerUserID = ?
      GROUP BY COALESCE(UPPER(Severity), 'UNKNOWN')
      ORDER BY severity
    `, [req.user.userId]),
    pool.execute(`
      SELECT
        COALESCE(UPPER(ra.Status), 'UNKNOWN') AS status,
        COUNT(*) AS count
      FROM recovery_action AS ra
      INNER JOIN outage AS o ON o.OutageID = ra.OutageID
      WHERE o.OwnerUserID = ?
      GROUP BY COALESCE(UPPER(ra.Status), 'UNKNOWN')
      ORDER BY status
    `, [req.user.userId]),
    pool.execute(`
      SELECT
        l.LocationID AS locationId,
        l.LocationName AS locationName,
        l.Region AS region,
        COUNT(DISTINCT o.OutageID) AS outageCount,
        COALESCE(SUM(CASE WHEN UPPER(o.Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
        COALESCE(SUM(CASE WHEN UPPER(o.Status) = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedOutages,
        COALESCE(SUM(impactTotals.affectedUsers), 0) AS affectedUsers
      FROM location AS l
      LEFT JOIN network_component AS nc
        ON nc.LocationID = l.LocationID AND nc.OwnerUserID = l.OwnerUserID
      LEFT JOIN outage AS o
        ON o.ComponentID = nc.ComponentID AND o.OwnerUserID = l.OwnerUserID
      LEFT JOIN (
        SELECT
          OutageID,
          SUM(UsersAffected) AS affectedUsers
        FROM outage_impact
        GROUP BY OutageID
      ) AS impactTotals ON impactTotals.OutageID = o.OutageID
      WHERE l.OwnerUserID = ?
      GROUP BY l.LocationID, l.LocationName, l.Region
      ORDER BY outageCount DESC, l.LocationName
    `, [req.user.userId]),
    pool.execute(`
      SELECT
        o.OutageID AS outageId,
        o.Cause AS cause,
        o.Severity AS severity,
        o.Status AS status,
        o.DetectedAt AS detectedAt,
        nc.ComponentName AS componentName,
        l.LocationID AS locationId,
        l.LocationName AS locationName,
        l.Region AS region,
        (
          SELECT COUNT(*)
          FROM outage_impact AS oi
          WHERE oi.OutageID = o.OutageID
        ) AS impactCount,
        (
          SELECT COUNT(*)
          FROM recovery_action AS ra
          WHERE ra.OutageID = o.OutageID
        ) AS recoveryActionCount,
        (
          SELECT COUNT(*)
          FROM recovery_action AS ra
          WHERE ra.OutageID = o.OutageID
            AND UPPER(ra.Status) = 'COMPLETED'
        ) AS completedRecoveryActionCount,
        (
          SELECT sv.ServiceStatus
          FROM service_verification AS sv
          WHERE sv.OutageID = o.OutageID
          ORDER BY sv.VerificationTime DESC, sv.VerificationID DESC
          LIMIT 1
        ) AS latestServiceStatus,
        (
          SELECT sv.ConnectivityStatus
          FROM service_verification AS sv
          WHERE sv.OutageID = o.OutageID
          ORDER BY sv.VerificationTime DESC, sv.VerificationID DESC
          LIMIT 1
        ) AS latestConnectivityStatus
      FROM outage AS o
      INNER JOIN network_component AS nc
        ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
      INNER JOIN location AS l
        ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
      WHERE o.OwnerUserID = ?
      ORDER BY o.DetectedAt DESC, o.OutageID DESC
    `, [req.user.userId]),
  ]);

  const summary = Object.fromEntries(
    Object.entries(summaryRows[0][0]).map(([key, value]) => [key, Number(value)]),
  );
  const severities = severityDistribution[0].map((row) => ({
    severity: row.severity,
    count: Number(row.count),
  }));
  const recoveries = recoverySummary[0].map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));
  const locations = locationSummary[0].map((row) => ({
    ...row,
    locationId: Number(row.locationId),
    outageCount: Number(row.outageCount),
    ongoingOutages: Number(row.ongoingOutages),
    resolvedOutages: Number(row.resolvedOutages),
    affectedUsers: Number(row.affectedUsers),
  }));
  const incidents = incidentSummary[0].map((row) => ({
    ...row,
    outageId: Number(row.outageId),
    locationId: Number(row.locationId),
    impactCount: Number(row.impactCount),
    recoveryActionCount: Number(row.recoveryActionCount),
    completedRecoveryActionCount: Number(row.completedRecoveryActionCount),
  }));

  res.status(200).json({
    summary,
    severityDistribution: severities,
    recoverySummary: recoveries,
    locationSummary: locations,
    incidents,
  });
}

module.exports = { getReportSummary };

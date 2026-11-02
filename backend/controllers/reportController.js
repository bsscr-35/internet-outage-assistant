const pool = require('../config/db');

async function getReportSummary(req, res) {
  const [summaryRows, severityDistribution, recoverySummary, locationSummary] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS totalOutages,
        COALESCE(SUM(CASE WHEN UPPER(Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
        COALESCE(SUM(CASE WHEN UPPER(Status) = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedOutages,
        COALESCE((
          SELECT SUM(UsersAffected)
          FROM outage_impact
        ), 0) AS totalAffectedUsers,
        (
          SELECT COUNT(*)
          FROM recovery_action
        ) AS totalRecoveryActions
      FROM outage
    `),
    pool.query(`
      SELECT
        COALESCE(UPPER(Severity), 'UNKNOWN') AS severity,
        COUNT(*) AS count
      FROM outage
      GROUP BY COALESCE(UPPER(Severity), 'UNKNOWN')
      ORDER BY severity
    `),
    pool.query(`
      SELECT
        COALESCE(UPPER(Status), 'UNKNOWN') AS status,
        COUNT(*) AS count
      FROM recovery_action
      GROUP BY COALESCE(UPPER(Status), 'UNKNOWN')
      ORDER BY status
    `),
    pool.query(`
      SELECT
        l.LocationID AS locationId,
        l.LocationName AS locationName,
        l.Region AS region,
        COUNT(DISTINCT o.OutageID) AS outageCount,
        COALESCE(SUM(impactTotals.affectedUsers), 0) AS affectedUsers
      FROM location AS l
      LEFT JOIN network_component AS nc ON nc.LocationID = l.LocationID
      LEFT JOIN outage AS o ON o.ComponentID = nc.ComponentID
      LEFT JOIN (
        SELECT
          OutageID,
          SUM(UsersAffected) AS affectedUsers
        FROM outage_impact
        GROUP BY OutageID
      ) AS impactTotals ON impactTotals.OutageID = o.OutageID
      GROUP BY l.LocationID, l.LocationName, l.Region
      ORDER BY outageCount DESC, l.LocationName
    `),
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
    affectedUsers: Number(row.affectedUsers),
  }));

  res.status(200).json({
    summary,
    severityDistribution: severities,
    recoverySummary: recoveries,
    locationSummary: locations,
  });
}

module.exports = { getReportSummary };

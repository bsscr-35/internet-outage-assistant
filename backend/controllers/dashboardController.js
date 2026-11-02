const pool = require('../config/db');

async function getDashboardStats(req, res) {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS totalOutages,
      COALESCE(SUM(CASE WHEN UPPER(Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
      COALESCE(SUM(CASE WHEN UPPER(Status) = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolvedOutages,
      COALESCE(SUM(CASE WHEN UPPER(Severity) = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS criticalOutages,
      COALESCE(SUM(CASE WHEN UPPER(Severity) = 'HIGH' THEN 1 ELSE 0 END), 0) AS highSeverityOutages,
      COALESCE((SELECT SUM(UsersAffected) FROM outage_impact), 0) AS totalAffectedUsers
    FROM outage
  `);
  const stats = Object.fromEntries(
    Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
  );

  res.status(200).json({ stats });
}

module.exports = { getDashboardStats };

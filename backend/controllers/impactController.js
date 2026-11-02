const pool = require('../config/db');

async function getImpacts(req, res) {
  const [impacts] = await pool.query(`
    SELECT
      oi.ImpactID AS impactId,
      oi.OutageID AS outageId,
      s.ServiceID AS serviceId,
      oi.ImpactLevel AS impactLevel,
      oi.UsersAffected AS usersAffected,
      oi.Description AS description
    FROM outage_impact AS oi
    INNER JOIN service AS s ON s.ServiceID = oi.ServiceID
    ORDER BY oi.ImpactID
  `);

  res.status(200).json({ impacts });
}

module.exports = { getImpacts };

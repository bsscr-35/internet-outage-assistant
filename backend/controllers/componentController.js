const pool = require('../config/db');

async function getComponents(req, res) {
  const [components] = await pool.query(`
    SELECT
      nc.ComponentID AS componentId,
      nc.ComponentName AS componentName,
      nc.ComponentType AS componentType,
      nc.IPAddress AS ipAddress,
      nc.Status AS status,
      nc.Criticality AS criticality,
      l.LocationID AS locationId,
      l.LocationName AS locationName,
      l.Region AS region
    FROM network_component AS nc
    INNER JOIN location AS l ON l.LocationID = nc.LocationID
    ORDER BY nc.ComponentID
  `);

  res.status(200).json({ components });
}

module.exports = { getComponents };

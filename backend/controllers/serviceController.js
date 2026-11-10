const pool = require('../config/db');

async function getServices(req, res) {
  const [services] = await pool.query(
    'SELECT ServiceID AS serviceId FROM service ORDER BY ServiceID',
  );
  res.status(200).json({ services });
}

module.exports = { getServices };

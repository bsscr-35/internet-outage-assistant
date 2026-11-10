const pool = require('../config/db');
const { getServiceName } = require('../services/serviceNames');

async function getServices(req, res) {
  const [services] = await pool.query(
    'SELECT ServiceID AS serviceId FROM service ORDER BY ServiceID',
  );
  res.status(200).json({
    services: services.map((service) => ({
      ...service,
      serviceName: getServiceName(service.serviceId),
    })),
  });
}

module.exports = { getServices };

const pool = require('../config/db');
const { getServiceName } = require('../services/serviceNames');
const validImpactLevels = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

async function getImpacts(req, res) {
  const [impacts] = await pool.execute(`
    SELECT
      oi.ImpactID AS impactId,
      oi.OutageID AS outageId,
      s.ServiceID AS serviceId,
      s.ServiceID AS serviceNameId,
      oi.ImpactLevel AS impactLevel,
      oi.UsersAffected AS usersAffected,
      oi.Description AS description,
      o.Status AS outageStatus,
      o.Severity AS outageSeverity,
      o.Cause AS outageCause,
      nc.ComponentName AS componentName,
      l.LocationName AS locationName,
      l.Region AS region
    FROM outage_impact AS oi
    INNER JOIN service AS s ON s.ServiceID = oi.ServiceID
    INNER JOIN outage AS o ON o.OutageID = oi.OutageID
    INNER JOIN network_component AS nc
      ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
    INNER JOIN location AS l
      ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
    WHERE o.OwnerUserID = ?
    ORDER BY oi.ImpactID
  `, [req.user.userId]);

  res.status(200).json({
    impacts: impacts.map(({ serviceNameId, ...impact }) => ({
      ...impact,
      serviceName: getServiceName(serviceNameId),
    })),
  });
}

async function createOutageImpact(req, res) {
  const outageId = Number(req.params.id);
  const body = req.body || {};
  const serviceId = Number(body.serviceId);
  const impactLevel = typeof body.impactLevel === 'string'
    ? body.impactLevel.trim().toUpperCase()
    : '';
  const usersAffected = Number(body.usersAffected);
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(outageId)) {
    return res.status(400).json({ status: 'error', message: 'Outage ID must be a positive integer.' });
  }
  if (!/^[1-9]\d*$/.test(String(body.serviceId ?? '')) || !Number.isSafeInteger(serviceId)) {
    return res.status(400).json({ status: 'error', message: 'Service ID must be a positive integer.' });
  }
  if (!validImpactLevels.has(impactLevel)) {
    return res.status(400).json({ status: 'error', message: 'Impact level must be CRITICAL, HIGH, MEDIUM, or LOW.' });
  }
  if (!Number.isSafeInteger(usersAffected) || usersAffected < 0) {
    return res.status(400).json({ status: 'error', message: 'Affected users must be a non-negative integer.' });
  }
  if (description.length > 255) {
    return res.status(400).json({ status: 'error', message: 'Impact description must be at most 255 characters.' });
  }
  if (body.description != null && typeof body.description !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Impact description must be text.' });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [outages] = await connection.execute(
      'SELECT OutageID FROM outage WHERE OutageID = ? AND OwnerUserID = ? FOR UPDATE',
      [outageId, req.user.userId],
    );
    if (outages.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ status: 'error', message: 'Outage not found.' });
    }

    const [services] = await connection.execute(
      'SELECT ServiceID FROM service WHERE ServiceID = ?',
      [serviceId],
    );
    if (services.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ status: 'error', message: 'Service not found.' });
    }

    const [existingImpacts] = await connection.execute(
      'SELECT ImpactID FROM outage_impact WHERE OutageID = ? AND ServiceID = ? LIMIT 1',
      [outageId, serviceId],
    );
    if (existingImpacts.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        status: 'error',
        message: 'An impact for this service is already recorded on this outage.',
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO outage_impact (OutageID, ServiceID, ImpactLevel, UsersAffected, Description)
       VALUES (?, ?, ?, ?, ?)`,
      [outageId, serviceId, impactLevel, usersAffected, description || null],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      impact: {
        impactId: result.insertId,
        outageId,
        serviceId,
        serviceName: getServiceName(serviceId),
        impactLevel,
        usersAffected,
        description: description || null,
      },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createOutageImpact, getImpacts };

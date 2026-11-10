const pool = require('../config/db');

const validCriticalities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const validStatuses = new Set(['UP', 'DOWN']);

async function getComponents(req, res) {
  const [components] = await pool.execute(`
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
    INNER JOIN location AS l
      ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
    WHERE nc.OwnerUserID = ?
    ORDER BY nc.ComponentID
  `, [req.user.userId]);

  res.status(200).json({ components });
}

async function createComponent(req, res) {
  const body = req.body || {};
  const componentName = typeof body.componentName === 'string' ? body.componentName.trim() : '';
  const componentType = typeof body.componentType === 'string' ? body.componentType.trim() : '';
  const criticality = typeof body.criticality === 'string' ? body.criticality.trim().toUpperCase() : '';
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  const locationId = Number(body.locationId);
  const ipAddress = typeof body.ipAddress === 'string' ? body.ipAddress.trim() : '';

  if (!Number.isSafeInteger(locationId) || locationId < 1) {
    return res.status(400).json({ status: 'error', message: 'A valid location is required.' });
  }
  if (!componentName || componentName.length > 100 || !componentType || componentType.length > 50) {
    return res.status(400).json({
      status: 'error',
      message: 'Component name and type are required and must be at most 100 and 50 characters.',
    });
  }
  if (!validCriticalities.has(criticality) || !validStatuses.has(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Criticality must be CRITICAL, HIGH, MEDIUM, or LOW; status must be UP or DOWN.',
    });
  }
  if (ipAddress.length > 45) {
    return res.status(400).json({ status: 'error', message: 'IP address must be at most 45 characters.' });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [locations] = await connection.execute(
      `SELECT LocationID, LocationName, Region
       FROM location
       WHERE LocationID = ? AND OwnerUserID = ?
       FOR SHARE`,
      [locationId, req.user.userId],
    );
    if (locations.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ status: 'error', message: 'Location not found.' });
    }

    const [existing] = await connection.execute(
      `SELECT ComponentID
       FROM network_component
       WHERE LocationID = ? AND OwnerUserID = ?
         AND LOWER(ComponentName) = LOWER(?) AND LOWER(ComponentType) = LOWER(?)
       LIMIT 1
       FOR SHARE`,
      [locationId, req.user.userId, componentName, componentType],
    );
    if (existing.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        status: 'error',
        message: 'A component with this name and type already exists at the selected location.',
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO network_component
         (ComponentName, ComponentType, IPAddress, Status, Criticality, LocationID, OwnerUserID)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [componentName, componentType, ipAddress || null, status, criticality, locationId, req.user.userId],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      component: {
        componentId: Number(result.insertId),
        componentName,
        componentType,
        ipAddress: ipAddress || null,
        status,
        criticality,
        locationId,
        locationName: locations[0].LocationName,
        region: locations[0].Region,
      },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createComponent, getComponents };

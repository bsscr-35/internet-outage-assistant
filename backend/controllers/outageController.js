const pool = require('../config/db');

const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const validImpactLevels = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const validCriticalities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

function isPositiveInteger(value) {
  return (
    Number.isSafeInteger(value) && value > 0
    || typeof value === 'string'
      && /^[1-9]\d*$/.test(value)
      && Number.isSafeInteger(Number(value))
  );
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

async function getOutages(req, res) {
  const [outages] = await pool.execute(`
    SELECT
      o.OutageID AS outageId,
      o.ComponentID AS componentId,
      o.DetectedAt AS detectedAt,
      o.StartTime AS startTime,
      o.EndTime AS endTime,
      o.Cause AS cause,
      o.Severity AS severity,
      o.Status AS status,
      nc.ComponentName AS componentName,
      nc.ComponentType AS componentType,
      nc.Status AS componentStatus,
      nc.Criticality AS componentCriticality,
      l.LocationID AS locationId,
      l.LocationName AS locationName,
      l.Region AS region
    FROM outage AS o
    INNER JOIN network_component AS nc
      ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
    INNER JOIN location AS l
      ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
    WHERE o.OwnerUserID = ?
    ORDER BY o.DetectedAt DESC, o.OutageID DESC
  `, [req.user.userId]);

  res.status(200).json({ outages });
}

async function getOutageById(req, res) {
  const outageId = Number(req.params.id);
  if (!Number.isSafeInteger(outageId) || outageId < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Outage ID must be a positive integer.',
    });
  }

  const [outages] = await pool.execute(
    `
      SELECT
        o.OutageID AS outageId,
        o.ComponentID AS componentId,
        o.DetectedAt AS detectedAt,
        o.StartTime AS startTime,
        o.EndTime AS endTime,
        o.Cause AS cause,
        o.Severity AS severity,
        o.Status AS status,
        nc.ComponentName AS componentName,
        nc.ComponentType AS componentType,
        nc.Status AS componentStatus,
        nc.Criticality AS componentCriticality,
        l.LocationID AS locationId,
        l.LocationName AS locationName,
        l.Region AS region
      FROM outage AS o
      INNER JOIN network_component AS nc
        ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
      INNER JOIN location AS l
        ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
      WHERE o.OutageID = ? AND o.OwnerUserID = ?
    `,
    [outageId, req.user.userId],
  );

  if (outages.length === 0) {
    return res.status(404).json({
      status: 'error',
      message: 'Outage not found.',
    });
  }

  const [impacts, recoveryActions] = await Promise.all([
    pool.execute(
      `
        SELECT
          ImpactID AS impactId,
          OutageID AS outageId,
          ServiceID AS serviceId,
          ImpactLevel AS impactLevel,
          UsersAffected AS usersAffected,
          Description AS description
        FROM outage_impact
        WHERE OutageID = ?
        ORDER BY ImpactID
      `,
      [outageId],
    ),
    pool.execute(
      `
        SELECT
          ActionID AS actionId,
          OutageID AS outageId,
          ActionType AS actionType,
          Description AS description,
          Priority AS priority,
          RecommendedAt AS recommendedAt,
          Status AS status
        FROM recovery_action
        WHERE OutageID = ?
        ORDER BY ActionID
      `,
      [outageId],
    ),
  ]);

  res.status(200).json({
    outage: {
      ...outages[0],
      impacts: impacts[0],
      recoveryActions: recoveryActions[0],
    },
  });
}

async function createOutage(req, res) {
  const body = req.body || {};
  const severity = typeof body.severity === 'string' ? body.severity.trim().toUpperCase() : '';
  const cause = typeof body.cause === 'string' ? body.cause.trim() : '';
  const impacts = body.impacts === undefined ? [] : body.impacts;
  const hasComponentId = body.componentId !== undefined && body.componentId !== null && body.componentId !== '';
  const hasLocationId = body.locationId !== undefined && body.locationId !== null && body.locationId !== '';
  const hasNewLocation = body.newLocation !== undefined;
  const hasNewComponent = body.newComponent !== undefined;

  if (
    (hasComponentId && (hasNewLocation || hasNewComponent))
    || (!hasComponentId && !hasNewComponent)
    || (!hasComponentId && hasNewComponent && hasNewLocation === hasLocationId)
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Provide either an existing component ID, a location ID with new component details, or new location and component details.',
    });
  }
  if (hasComponentId && !isPositiveInteger(body.componentId)) {
    return res.status(400).json({ status: 'error', message: 'Component ID must be a positive integer.' });
  }
  if (hasLocationId && !isPositiveInteger(body.locationId)) {
    return res.status(400).json({ status: 'error', message: 'Location ID must be a positive integer.' });
  }
  if (hasNewLocation) {
    const location = body.newLocation;
    if (!location || typeof location !== 'object' || Array.isArray(location)) {
      return res.status(400).json({ status: 'error', message: 'New location details are required.' });
    }
    if (
      typeof location.locationName !== 'string'
      || !location.locationName.trim()
      || location.locationName.trim().length > 100
      || typeof location.region !== 'string'
      || !location.region.trim()
      || location.region.trim().length > 100
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Location name and region are required and must be at most 100 characters.',
      });
    }
  }
  if (hasNewComponent) {
    const component = body.newComponent;
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      return res.status(400).json({ status: 'error', message: 'New component details are required.' });
    }
    if (
      typeof component.componentName !== 'string'
      || !component.componentName.trim()
      || component.componentName.trim().length > 100
      || typeof component.componentType !== 'string'
      || !component.componentType.trim()
      || component.componentType.trim().length > 50
      || !validCriticalities.has(String(component.criticality || '').trim().toUpperCase())
      || (
        component.ipAddress != null
        && (typeof component.ipAddress !== 'string' || component.ipAddress.trim().length > 45)
      )
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Component name, type, and valid criticality are required; IP address must be at most 45 characters.',
      });
    }
  }
  if (!validSeverities.has(severity)) {
    return res.status(400).json({ status: 'error', message: 'Severity must be CRITICAL, HIGH, MEDIUM, or LOW.' });
  }
  if (cause.length > 255) {
    return res.status(400).json({ status: 'error', message: 'Cause must be at most 255 characters.' });
  }
  if (body.cause != null && typeof body.cause !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Cause must be text.' });
  }
  if (!Array.isArray(impacts) || impacts.length > 20) {
    return res.status(400).json({ status: 'error', message: 'Impacts must be an array of at most 20 records.' });
  }
  const serviceIds = new Set();
  for (const impact of impacts) {
    if (
      !impact
      || !isPositiveInteger(impact.serviceId)
      || !validImpactLevels.has(String(impact.impactLevel || '').toUpperCase())
      || !isNonNegativeInteger(impact.usersAffected)
      || (impact.description != null && (typeof impact.description !== 'string' || impact.description.length > 255))
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Each impact needs a valid service ID, impact level, non-negative affected-user count, and description no longer than 255 characters.',
      });
    }
    const serviceId = Number(impact.serviceId);
    if (serviceIds.has(serviceId)) {
      return res.status(400).json({ status: 'error', message: 'An outage can include only one impact per service.' });
    }
    serviceIds.add(serviceId);
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    let componentId;
    let componentDetails;
    if (hasNewComponent) {
      const componentName = body.newComponent.componentName.trim();
      const componentType = body.newComponent.componentType.trim();
      const criticality = String(body.newComponent.criticality).trim().toUpperCase();
      const ipAddress = body.newComponent.ipAddress?.trim() || null;

      let locationId;
      let locationName;
      let region;
      if (hasLocationId) {
        const [locations] = await connection.execute(
          `SELECT LocationID, LocationName, Region
           FROM location
           WHERE LocationID = ? AND OwnerUserID = ?
           FOR SHARE`,
          [Number(body.locationId), req.user.userId],
        );
        if (locations.length === 0) {
          await connection.rollback();
          transactionStarted = false;
          return res.status(404).json({ status: 'error', message: 'Location not found.' });
        }
        locationId = Number(locations[0].LocationID);
        locationName = locations[0].LocationName;
        region = locations[0].Region;
      } else {
        locationName = body.newLocation.locationName.trim();
        region = body.newLocation.region.trim();
        const [existingLocations] = await connection.execute(
          `SELECT LocationID
           FROM location
           WHERE OwnerUserID = ?
             AND LOWER(LocationName) = LOWER(?)
             AND LOWER(Region) = LOWER(?)
           LIMIT 1
           FOR SHARE`,
          [req.user.userId, locationName, region],
        );
        if (existingLocations.length > 0) {
          locationId = Number(existingLocations[0].LocationID);
        } else {
          const [locationResult] = await connection.execute(
            'INSERT INTO location (LocationName, Region, OwnerUserID) VALUES (?, ?, ?)',
            [locationName, region, req.user.userId],
          );
          locationId = Number(locationResult.insertId);
          if (!Number.isSafeInteger(locationId) || locationId < 1) {
            throw new Error('Location insert did not return a valid ID.');
          }
        }
      }

      const [existingComponents] = await connection.execute(
        `SELECT
           ComponentID AS componentId,
           ComponentName AS componentName,
           ComponentType AS componentType,
           Status AS componentStatus,
           Criticality AS componentCriticality,
           IPAddress AS ipAddress
         FROM network_component
         WHERE LocationID = ? AND OwnerUserID = ?
           AND LOWER(ComponentName) = LOWER(?)
           AND LOWER(ComponentType) = LOWER(?)
         LIMIT 1
         FOR SHARE`,
        [locationId, req.user.userId, componentName, componentType],
      );
      if (existingComponents.length > 0) {
        componentDetails = {
          ...existingComponents[0],
          locationId,
          locationName,
          region,
        };
        componentId = Number(componentDetails.componentId);
      } else {
        const [componentResult] = await connection.execute(
          `INSERT INTO network_component
             (ComponentName, ComponentType, IPAddress, Status, Criticality, LocationID, OwnerUserID)
           VALUES (?, ?, ?, 'DOWN', ?, ?, ?)`,
          [componentName, componentType, ipAddress, criticality, locationId, req.user.userId],
        );
        componentId = Number(componentResult.insertId);
        if (!Number.isSafeInteger(componentId) || componentId < 1) {
          throw new Error('Component insert did not return a valid ID.');
        }
        componentDetails = {
          componentId,
          componentName,
          componentType,
          componentStatus: 'DOWN',
          componentCriticality: criticality,
          ipAddress,
          locationId,
          locationName,
          region,
        };
      }
    } else {
      componentId = Number(body.componentId);
      const [components] = await connection.execute(
        `SELECT
           nc.ComponentID AS componentId,
           nc.ComponentName AS componentName,
           nc.ComponentType AS componentType,
           nc.Status AS componentStatus,
           nc.Criticality AS componentCriticality,
           l.LocationID AS locationId,
           l.LocationName AS locationName,
           l.Region AS region
         FROM network_component AS nc
         INNER JOIN location AS l ON l.LocationID = nc.LocationID
         WHERE nc.ComponentID = ?
           AND nc.OwnerUserID = ?
           AND l.OwnerUserID = ?
         FOR SHARE`,
        [componentId, req.user.userId, req.user.userId],
      );
      if (components.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({ status: 'error', message: 'Network component not found.' });
      }
      componentDetails = components[0];
      if (
        body.locationId !== undefined
        && Number(componentDetails.locationId) !== Number(body.locationId)
      ) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          status: 'error',
          message: 'The selected component does not belong to the selected location.',
        });
      }
    }

    for (const impact of impacts) {
      const [services] = await connection.execute(
        'SELECT ServiceID FROM service WHERE ServiceID = ?',
        [Number(impact.serviceId)],
      );
      if (services.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({
          status: 'error',
          message: `Service ID ${Number(impact.serviceId)} does not exist.`,
        });
      }
    }

    const [result] = await connection.execute(
      `INSERT INTO outage (ComponentID, OwnerUserID, DetectedAt, StartTime, Cause, Severity, Status)
       VALUES (?, ?, NOW(), NOW(), ?, ?, 'ONGOING')`,
      [componentId, req.user.userId, cause || null, severity],
    );

    for (const impact of impacts) {
      await connection.execute(
        `INSERT INTO outage_impact (OutageID, ServiceID, ImpactLevel, UsersAffected, Description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          result.insertId,
          Number(impact.serviceId),
          String(impact.impactLevel).toUpperCase(),
          Number(impact.usersAffected),
          impact.description?.trim() || null,
        ],
      );
    }

    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      outage: {
        outageId: result.insertId,
        ...componentDetails,
        severity,
        status: 'ONGOING',
      },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOutageStatus(req, res) {
  const outageId = Number(req.params.id);
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ status: 'error', message: 'Outage ID must be a positive integer.' });
  }
  if (!['ONGOING', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Status must be ONGOING or RESOLVED.' });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [outages] = await connection.execute(
      'SELECT OutageID, Status FROM outage WHERE OutageID = ? AND OwnerUserID = ? FOR UPDATE',
      [outageId, req.user.userId],
    );
    if (outages.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ status: 'error', message: 'Outage not found.' });
    }

    if (status === 'RESOLVED') {
      const [[recoverySummary]] = await connection.execute(
        `SELECT
           COUNT(*) AS totalActions,
           COALESCE(SUM(UPPER(Status) <> 'COMPLETED'), 0) AS incompleteActions
         FROM recovery_action
         WHERE OutageID = ?`,
        [outageId],
      );
      const [verifications] = await connection.execute(
        `SELECT ServiceStatus AS serviceStatus, ConnectivityStatus AS connectivityStatus
         FROM service_verification
         WHERE OutageID = ?
         ORDER BY VerificationTime DESC, VerificationID DESC
         LIMIT 1`,
        [outageId],
      );
      const latestVerification = verifications[0];
      if (
        Number(recoverySummary.totalActions) === 0
        || Number(recoverySummary.incompleteActions) > 0
        || String(latestVerification?.serviceStatus || '').toUpperCase() !== 'RESTORED'
        || String(latestVerification?.connectivityStatus || '').toUpperCase() !== 'CONNECTED'
      ) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          status: 'error',
          message: 'An outage can be resolved only after all recovery actions are completed and the latest service check is RESTORED and CONNECTED.',
        });
      }
    }

    await connection.execute(
      `UPDATE outage
       SET Status = ?, EndTime = CASE WHEN ? = 'RESOLVED' THEN COALESCE(EndTime, NOW()) ELSE NULL END
       WHERE OutageID = ?`,
      [status, status, outageId],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(200).json({ outage: { outageId, status } });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createOutage, getOutageById, getOutages, updateOutageStatus };

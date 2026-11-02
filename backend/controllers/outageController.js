const pool = require('../config/db');

async function getOutages(req, res) {
  const [outages] = await pool.query(`
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
    INNER JOIN network_component AS nc ON nc.ComponentID = o.ComponentID
    INNER JOIN location AS l ON l.LocationID = nc.LocationID
    ORDER BY o.DetectedAt DESC, o.OutageID DESC
  `);

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
      INNER JOIN network_component AS nc ON nc.ComponentID = o.ComponentID
      INNER JOIN location AS l ON l.LocationID = nc.LocationID
      WHERE o.OutageID = ?
    `,
    [outageId],
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

module.exports = { getOutages, getOutageById };

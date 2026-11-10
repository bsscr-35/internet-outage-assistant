const pool = require('../config/db');

function validateLocation(body) {
  const locationName = typeof body?.locationName === 'string' ? body.locationName.trim() : '';
  const region = typeof body?.region === 'string' ? body.region.trim() : '';
  if (!locationName || locationName.length > 100 || !region || region.length > 100) {
    return { error: 'Location name and region are required and must be at most 100 characters.' };
  }
  return { locationName, region };
}

async function getLocationSummary(req, res) {
  const [locations] = await pool.execute(`
    SELECT
      l.LocationID AS locationId,
      l.LocationName AS locationName,
      l.Region AS region,
      COUNT(DISTINCT o.OutageID) AS outageCount,
      COALESCE(SUM(CASE WHEN UPPER(o.Status) = 'ONGOING' THEN 1 ELSE 0 END), 0) AS ongoingOutages,
      COALESCE(SUM(impactTotals.affectedUsers), 0) AS affectedUsers
    FROM location AS l
    LEFT JOIN network_component AS nc
      ON nc.LocationID = l.LocationID AND nc.OwnerUserID = l.OwnerUserID
    LEFT JOIN outage AS o
      ON o.ComponentID = nc.ComponentID AND o.OwnerUserID = l.OwnerUserID
    LEFT JOIN (
      SELECT OutageID, SUM(UsersAffected) AS affectedUsers
      FROM outage_impact
      GROUP BY OutageID
    ) AS impactTotals ON impactTotals.OutageID = o.OutageID
    WHERE l.OwnerUserID = ?
    GROUP BY l.LocationID, l.LocationName, l.Region
    ORDER BY outageCount DESC, l.LocationName
  `, [req.user.userId]);

  res.status(200).json({
    locations: locations.map((location) => ({
      ...location,
      locationId: Number(location.locationId),
      outageCount: Number(location.outageCount),
      ongoingOutages: Number(location.ongoingOutages),
      affectedUsers: Number(location.affectedUsers),
    })),
  });
}

async function createLocation(req, res) {
  const location = validateLocation(req.body);
  if (location.error) {
    return res.status(400).json({ status: 'error', message: location.error });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [existing] = await connection.execute(
      `SELECT LocationID
       FROM location
      WHERE OwnerUserID = ?
        AND LOWER(LocationName) = LOWER(?)
        AND LOWER(Region) = LOWER(?)
      LIMIT 1
      FOR SHARE`,
      [req.user.userId, location.locationName, location.region],
    );
    if (existing.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ status: 'error', message: 'This location already exists.' });
    }

    const [result] = await connection.execute(
      'INSERT INTO location (LocationName, Region, OwnerUserID) VALUES (?, ?, ?)',
      [location.locationName, location.region, req.user.userId],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      location: {
        locationId: Number(result.insertId),
        locationName: location.locationName,
        region: location.region,
        outageCount: 0,
        ongoingOutages: 0,
        affectedUsers: 0,
      },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createLocation, getLocationSummary };

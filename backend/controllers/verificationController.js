const pool = require('../config/db');
const { getServiceNames } = require('../services/serviceNames');

async function getServiceVerifications(req, res) {
  const [verifications] = await pool.execute(`
    SELECT
      sv.VerificationID AS verificationId,
      sv.OutageID AS outageId,
      sv.VerificationTime AS verificationTime,
      sv.ServiceStatus AS serviceStatus,
      sv.ConnectivityStatus AS connectivityStatus,
      sv.VerifiedBy AS verifiedBy,
      nc.ComponentName AS componentName,
      l.LocationName AS locationName,
      l.Region AS region,
      COALESCE(impactServices.serviceIds, '') AS serviceIds
    FROM service_verification AS sv
    INNER JOIN outage AS o ON o.OutageID = sv.OutageID
    INNER JOIN network_component AS nc
      ON nc.ComponentID = o.ComponentID AND nc.OwnerUserID = o.OwnerUserID
    INNER JOIN location AS l
      ON l.LocationID = nc.LocationID AND l.OwnerUserID = nc.OwnerUserID
    LEFT JOIN (
      SELECT OutageID, GROUP_CONCAT(DISTINCT ServiceID ORDER BY ServiceID) AS serviceIds
      FROM outage_impact
      GROUP BY OutageID
    ) AS impactServices ON impactServices.OutageID = sv.OutageID
    WHERE o.OwnerUserID = ?
    ORDER BY sv.VerificationTime DESC, sv.VerificationID DESC
  `, [req.user.userId]);

  return res.status(200).json({
    verifications: verifications.map((verification) => ({
      ...verification,
      outageId: Number(verification.outageId),
      serviceIds: verification.serviceIds
        ? verification.serviceIds.split(',').map(Number)
        : [],
      serviceNames: getServiceNames(verification.serviceIds),
    })),
  });
}

async function createServiceVerification(req, res) {
  const body = req.body || {};
  const outageId = Number(body.outageId);
  const serviceStatus = typeof body.serviceStatus === 'string'
    ? body.serviceStatus.trim().toUpperCase()
    : '';
  const connectivityStatus = typeof body.connectivityStatus === 'string'
    ? body.connectivityStatus.trim().toUpperCase()
    : '';
  const validResult = (
    serviceStatus === 'RESTORED' && connectivityStatus === 'CONNECTED'
  ) || (
    serviceStatus === 'DOWN' && connectivityStatus === 'DISCONNECTED'
  );

  if (!/^[1-9]\d*$/.test(String(body.outageId ?? '')) || !Number.isSafeInteger(outageId)) {
    return res.status(400).json({ status: 'error', message: 'Outage ID must be a positive integer.' });
  }
  if (!validResult) {
    return res.status(400).json({
      status: 'error',
      message: 'Choose a consistent observed result: RESTORED with CONNECTED, or DOWN with DISCONNECTED.',
    });
  }

  const [outages] = await pool.execute(
    `SELECT o.OutageID
     FROM outage AS o
     WHERE o.OutageID = ?
       AND o.OwnerUserID = ?
       AND EXISTS (SELECT 1 FROM outage_impact AS oi WHERE oi.OutageID = o.OutageID)`,
    [outageId, req.user.userId],
  );
  if (outages.length === 0) {
    const [existingOutages] = await pool.execute(
      'SELECT OutageID FROM outage WHERE OutageID = ? AND OwnerUserID = ?',
      [outageId, req.user.userId],
    );
    return res.status(existingOutages.length ? 409 : 404).json({
      status: 'error',
      message: existingOutages.length
        ? 'Add an actual service impact to this outage before recording a service check.'
        : 'Outage not found.',
    });
  }

  if (serviceStatus === 'RESTORED') {
    const [[recoverySummary]] = await pool.execute(
      `SELECT
         COUNT(*) AS totalActions,
         COALESCE(SUM(UPPER(Status) <> 'COMPLETED'), 0) AS incompleteActions
       FROM recovery_action
       WHERE OutageID = ?`,
      [outageId],
    );
    if (
      Number(recoverySummary.totalActions) === 0
      || Number(recoverySummary.incompleteActions) > 0
    ) {
      return res.status(409).json({
        status: 'error',
        message: 'A RESTORED result can be recorded only after at least one recovery action exists and all actions are COMPLETED.',
      });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO service_verification
       (OutageID, VerificationTime, ServiceStatus, ConnectivityStatus, VerifiedBy)
     VALUES (?, NOW(), ?, ?, ?)`,
    [outageId, serviceStatus, connectivityStatus, req.user.userName],
  );
  return res.status(201).json({
    verification: {
      verificationId: result.insertId,
      outageId,
      serviceStatus,
      connectivityStatus,
      verifiedBy: req.user.userName,
    },
  });
}

module.exports = { createServiceVerification, getServiceVerifications };

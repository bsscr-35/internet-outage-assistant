const pool = require('../config/db');

async function getServiceVerifications(req, res) {
  const [verifications] = await pool.query(`
    SELECT
      VerificationID AS verificationId,
      OutageID AS outageId,
      VerificationTime AS verificationTime,
      ServiceStatus AS serviceStatus,
      ConnectivityStatus AS connectivityStatus,
      VerifiedBy AS verifiedBy
    FROM service_verification
    ORDER BY VerificationTime DESC, VerificationID DESC
  `);

  res.status(200).json({ verifications });
}

module.exports = { getServiceVerifications };

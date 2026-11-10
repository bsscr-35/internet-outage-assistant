const pool = require('../config/db');

async function getDatabaseHealth(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      message: 'Database connection successful.',
    });
  } catch (error) {
    console.error('Database health check failed:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      message: error.message,
    });
    res.status(503).json({
      status: 'error',
      message: 'Unable to connect to the database.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { getDatabaseHealth };

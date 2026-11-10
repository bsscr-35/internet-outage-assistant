function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      status: 'error',
      message: 'Request body exceeds the 32 KB limit.',
    });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      message: 'Request body must contain valid JSON.',
    });
  }
  if (!error.status || error.status >= 500) {
    console.error('Unhandled request error:', error.message || error.name || error.code || 'Unknown error');
  }
  if (
    ['ER_COLUMNACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR'].includes(error.code)
  ) {
    if (req.method === 'POST' && req.originalUrl?.split('?')[0] === '/api/locations') {
      return res.status(503).json({
        status: 'error',
        message: 'Adding locations requires INSERT on outage_assistant_demo.location. No location was saved.',
      });
    }
    if (req.method === 'POST' && req.originalUrl?.split('?')[0] === '/api/components') {
      return res.status(503).json({
        status: 'error',
        message: 'Adding components requires INSERT on outage_assistant_demo.network_component. No component was saved.',
      });
    }
    if (
      req.method === 'POST'
      && req.originalUrl?.split('?')[0] === '/api/outages'
      && req.body?.newLocation
      && req.body?.newComponent
    ) {
      return res.status(503).json({
        status: 'error',
        message: 'A required database permission prevented this outage report from being saved. Ask an administrator to check the outage_assistant_demo permissions. No outage was saved.',
      });
    }
    return res.status(503).json({
      status: 'error',
      message: 'The application database account lacks permission for this operation. Ask a MySQL administrator to grant the required table-level permission.',
    });
  }
  if (
    error.code === 'ER_BAD_FIELD_ERROR'
    && /OwnerUserID/i.test(error.sqlMessage || error.message || '')
  ) {
    return res.status(503).json({
      status: 'error',
      message: 'User-specific records are not enabled in the database yet. Ask a MySQL administrator to review and apply backend/migrations/003_user_record_ownership.sql, then restart the backend.',
    });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      status: 'error',
      message: 'A record with the supplied unique values already exists. Refresh and retry.',
    });
  }
  if (
    error.status === 503
    || [
      'ER_ACCESS_DENIED_ERROR',
      'ER_NO_SUCH_TABLE',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ].includes(error.code)
  ) {
    return res.status(503).json({
      status: 'error',
      message: 'A required database service, schema, or permission is unavailable. Check backend configuration and apply the documented migration.',
    });
  }
  if (
    error.name === 'ValidationError'
    || ['ER_BAD_NULL_ERROR', 'ER_DATA_TOO_LONG', 'ER_NO_REFERENCED_ROW_2', 'ER_TRUNCATED_WRONG_VALUE'].includes(error.code)
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'The submitted data does not satisfy the database schema.',
    });
  }

  res.status(500).json({
    status: 'error',
    message: 'An unexpected server error occurred.',
  });
}

module.exports = errorHandler;

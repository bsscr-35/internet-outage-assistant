function errorHandler(error, req, res, next) {
  console.error('Unhandled request error:', error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    status: 'error',
    message: 'An unexpected server error occurred.',
  });
}

module.exports = errorHandler;

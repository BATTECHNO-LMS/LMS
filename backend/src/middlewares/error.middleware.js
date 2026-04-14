const crypto = require('crypto');
const { ApiError } = require('../utils/apiError');
const { env } = require('../config/env');
const { log } = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code || 'API_ERROR',
      ...(err.details != null ? { details: err.details } : {}),
      ...(req.id ? { requestId: req.id } : {}),
    });
  }

  const errorId = crypto.randomUUID();
  log('error', err.message || 'Unhandled error', {
    errorId,
    requestId: req.id,
    name: err.name,
    ...(env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });

  return res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    errorId,
    ...(req.id ? { requestId: req.id } : {}),
  });
}

module.exports = { errorMiddleware };

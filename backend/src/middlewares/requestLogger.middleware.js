const morgan = require('morgan');
const { env } = require('../config/env');

/** Skip noisy health checks in production access logs. */
function skip(req) {
  return req.path === '/health' || req.path === '/health/ready';
}

const format =
  env.NODE_ENV === 'production'
    ? ':remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]'
    : 'dev';

function createRequestLogger() {
  return morgan(format, {
    skip,
  });
}

module.exports = { createRequestLogger };

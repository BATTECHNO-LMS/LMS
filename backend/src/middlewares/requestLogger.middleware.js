const morgan = require('morgan');
const { env } = require('../config/env');
const { getSecurityClientIp } = require('../shared/security/clientIdentity');
const { redactUrl } = require('../shared/security/redaction');

/** Skip noisy health checks in production access logs. */
function skip(req) {
  return req.path === '/health' || req.path === '/health/ready';
}

morgan.token('client-ip', (req) => getSecurityClientIp(req) || '-');
morgan.token('request-id', (req) => req.id || '-');
morgan.token('safe-url', (req) => redactUrl(req.originalUrl || req.url || '') || '-');
morgan.token('user-id', (req) => req.user?.userId || '-');

/** One line per request: client, method, redacted URL, status, bytes, duration, request id. */
const PRODUCTION_FORMAT =
  ':client-ip :method :safe-url :status :res[content-length] - :response-time ms rid=:request-id uid=:user-id';
const DEVELOPMENT_FORMAT = ':method :safe-url :status :response-time ms - :res[content-length] rid=:request-id';

function createRequestLogger(options = {}) {
  const format = env.NODE_ENV === 'production' ? PRODUCTION_FORMAT : DEVELOPMENT_FORMAT;
  return morgan(options.format || format, {
    skip,
    ...(options.stream ? { stream: options.stream } : {}),
  });
}

module.exports = { createRequestLogger, PRODUCTION_FORMAT, DEVELOPMENT_FORMAT };

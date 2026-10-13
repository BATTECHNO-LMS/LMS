const crypto = require('crypto');
const { runWithRequestContext, truncateUserAgent } = require('../shared/requestContext');

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function requestIdMiddleware(req, res, next) {
  const fromHeader = req.headers['x-request-id'];
  const candidate = typeof fromHeader === 'string' ? fromHeader.trim().slice(0, 128) : '';
  const id = candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  runWithRequestContext(
    {
      requestId: id,
      ipAddress: req.ip || null,
      userAgent: truncateUserAgent(req.headers['user-agent']),
    },
    () => next()
  );
}

module.exports = { requestIdMiddleware };

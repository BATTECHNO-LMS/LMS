const crypto = require('crypto');
const { env } = require('../config/env');
const { runWithRequestContext, truncateUserAgent } = require('../shared/requestContext');
const { getSecurityClientIp, isFromTrustedProxy } = require('../shared/security/clientIdentity');

/** nginx `$request_id` (32 hex) or a UUID — nothing else is accepted from upstream. */
const UPSTREAM_REQUEST_ID = /^(?:[a-f0-9]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Canonical request id (`req.id`, `X-Request-Id` response header, logs, audit rows).
 * A client-supplied X-Request-Id is ignored: an upstream id is only accepted when this
 * deployment opts in (TRUST_UPSTREAM_REQUEST_ID, host nginx overwrites the header with
 * `$request_id`) and the TCP peer is one of our trusted proxies.
 */
function resolveRequestId(req, { trustUpstream = env.TRUST_UPSTREAM_REQUEST_ID } = {}) {
  if (trustUpstream && isFromTrustedProxy(req)) {
    const raw = req.headers['x-request-id'];
    const candidate = typeof raw === 'string' ? raw.trim() : '';
    if (UPSTREAM_REQUEST_ID.test(candidate)) return { id: candidate.toLowerCase(), source: 'upstream' };
  }
  return { id: crypto.randomUUID(), source: 'generated' };
}

function requestIdMiddleware(req, res, next) {
  const { id } = resolveRequestId(req);
  req.id = id;
  res.setHeader('X-Request-Id', id);
  runWithRequestContext(
    {
      requestId: id,
      ipAddress: getSecurityClientIp(req),
      userAgent: truncateUserAgent(req.headers['user-agent']),
    },
    () => next()
  );
}

module.exports = { requestIdMiddleware, resolveRequestId, UPSTREAM_REQUEST_ID };

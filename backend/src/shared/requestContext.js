'use strict';

const { AsyncLocalStorage } = require('async_hooks');

/**
 * Per-request context (request id, client IP, user agent, authenticated actor/session).
 * Lets audit writes deep inside services attach request metadata without threading `req`.
 */
const storage = new AsyncLocalStorage();

const MAX_USER_AGENT = 512;

function truncateUserAgent(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_USER_AGENT);
}

function runWithRequestContext(ctx, fn) {
  return storage.run({ ...ctx }, fn);
}

/** @returns {{ requestId?: string, ipAddress?: string|null, userAgent?: string|null, userId?: string, sessionId?: string, actorRole?: string, universityId?: string|null, organizationId?: string|null } | null} */
function getRequestContext() {
  return storage.getStore() || null;
}

function updateRequestContext(patch) {
  const store = storage.getStore();
  if (!store || !patch) return;
  Object.assign(store, patch);
}

module.exports = {
  runWithRequestContext,
  getRequestContext,
  updateRequestContext,
  truncateUserAgent,
};

'use strict';

/**
 * Short-lived in-process cache of resolved request auth context.
 * Stores authorization snapshots only (no passwords, tokens, or secrets).
 * Fail closed: never cache load errors. TTL is the maximum stale-auth window
 * when a mutation path forgets to invalidate.
 */

const DEFAULT_TTL_MS = 15_000;
const MAX_ENTRIES = 2_000;
const MIN_TTL_MS = 5_000;
const MAX_TTL_MS = 60_000;

function clampTtl(raw, fallback = DEFAULT_TTL_MS) {
  if (raw === 0 || raw === '0') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n === 0) return 0;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.trunc(n)));
}

function cacheKey(userId, portalType) {
  const portal =
    portalType === 'UNIVERSITY' || portalType === 'INSTITUTION' ? portalType : '_';
  return `${String(userId)}|${portal}`;
}

function cloneValue(value) {
  return structuredClone(value);
}

function createAuthContextCache(options = {}) {
  const ttlMs = clampTtl(options.ttlMs, DEFAULT_TTL_MS);
  const requestedMax = Number(options.maxEntries);
  const maxEntries =
    Number.isFinite(requestedMax) && requestedMax >= 1
      ? Math.trunc(requestedMax)
      : MAX_ENTRIES;
  const map = new Map();
  const inflight = new Map();

  function get(userId, portalType) {
    if (!userId || ttlMs === 0) return undefined;
    const key = cacheKey(userId, portalType);
    const hit = map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      map.delete(key);
      return undefined;
    }
    map.delete(key);
    map.set(key, hit);
    return cloneValue(hit.value);
  }

  function set(userId, portalType, value) {
    if (!userId || ttlMs === 0 || !value) return;
    const key = cacheKey(userId, portalType);
    if (map.has(key)) map.delete(key);
    while (map.size >= maxEntries) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
    }
    map.set(key, { value: cloneValue(value), expiresAt: Date.now() + ttlMs });
  }

  function invalidateUser(userId) {
    if (!userId) return;
    const prefix = `${String(userId)}|`;
    for (const key of [...map.keys()]) {
      if (key.startsWith(prefix)) map.delete(key);
    }
    for (const key of [...inflight.keys()]) {
      if (key.startsWith(prefix)) inflight.delete(key);
    }
  }

  function clear() {
    map.clear();
    inflight.clear();
  }

  function rememberInflight(userId, portalType, promise) {
    if (!userId || ttlMs === 0) return promise;
    const key = cacheKey(userId, portalType);
    if (inflight.has(key)) return inflight.get(key);
    inflight.set(key, promise);
    return promise.finally(() => {
      inflight.delete(key);
    });
  }

  function getInflight(userId, portalType) {
    if (!userId || ttlMs === 0) return undefined;
    return inflight.get(cacheKey(userId, portalType));
  }

  return {
    get,
    set,
    invalidateUser,
    clear,
    rememberInflight,
    getInflight,
    get ttlMs() {
      return ttlMs;
    },
    get maxEntries() {
      return maxEntries;
    },
    size() {
      return map.size;
    },
  };
}

const { env } = require('../../config/env');

const authContextCache = createAuthContextCache({
  ttlMs: env.AUTH_CONTEXT_CACHE_TTL_MS,
  maxEntries: Math.max(32, Number(env.AUTH_CONTEXT_CACHE_MAX) || MAX_ENTRIES),
});

function invalidateAuthContextForUser(userId) {
  authContextCache.invalidateUser(userId);
}

function clearAuthContextCache() {
  authContextCache.clear();
}

module.exports = {
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  cacheKey,
  clampTtl,
  createAuthContextCache,
  authContextCache,
  invalidateAuthContextForUser,
  clearAuthContextCache,
};

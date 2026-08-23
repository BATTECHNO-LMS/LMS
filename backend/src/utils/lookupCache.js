'use strict';

/**
 * Tiny in-memory TTL cache for stable lookup rows (university / organization identity).
 * Not for permissions, grades, attendance, or user-specific payloads.
 */

function createTtlCache(ttlMs = 60_000) {
  const map = new Map();

  function get(key) {
    const hit = map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value) {
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  function clear() {
    map.clear();
  }

  return { get, set, clear, ttlMs };
}

const universityIdentityCache = createTtlCache(60_000);
const organizationIdentityCache = createTtlCache(60_000);

module.exports = {
  createTtlCache,
  createTtlCache: createTtlCache,
  universityIdentityCache,
  organizationIdentityCache,
  universityIdentityCache: universityIdentityCache,
  organizationIdentityCache: organizationIdentityCache,
};
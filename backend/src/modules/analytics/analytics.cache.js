'use strict';

const { createTtlCache } = require('../../utils/lookupCache');
const { FRESHNESS } = require('./analytics.definitions');

const liveCache = createTtlCache(FRESHNESS.LIVE.ttlMs);
const nearCache = createTtlCache(FRESHNESS.NEAR.ttlMs);
const historicalCache = createTtlCache(FRESHNESS.HISTORICAL.ttlMs);

function cacheFor(freshness) {
  if (freshness === 'live') return liveCache;
  if (freshness === 'historical') return historicalCache;
  return nearCache;
}

async function withCache(freshness, key, fn) {
  const cache = cacheFor(freshness);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cache.set(key, value);
  return value;
}

function clearAnalyticsCaches() {
  liveCache.clear();
  nearCache.clear();
  historicalCache.clear();
}

module.exports = {
  withCache,
  clearAnalyticsCaches,
  liveCache,
  nearCache,
  historicalCache,
};

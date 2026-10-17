'use strict';

/**
 * Progressive login cooldown (in-process; the API runs as a single container).
 *
 * - client IP + identifier: after LOGIN_FAILURE_FREE_ATTEMPTS wrong passwords the pair must
 *   wait BASE * 2^(n - free) seconds (capped) before the next attempt. A success resets it.
 * - client IP across identifiers: same curve after LOGIN_FAILURE_IP_FREE_ATTEMPTS
 *   (credential stuffing from one client).
 * - identifier across all IPs: detection only (LOGIN_BRUTE_FORCE_SUSPECTED). Accounts are
 *   never locked, so an attacker cannot lock a student out by failing on purpose.
 *
 * Keys use the submitted identifier string, not account existence, so throttling behaves
 * identically for unknown emails (no enumeration).
 */

const crypto = require('crypto');
const { env } = require('../../config/env');

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 50_000;

const pairs = new Map();
const ips = new Map();
const accounts = new Map();

function cfg() {
  return {
    pairFree: env.LOGIN_FAILURE_FREE_ATTEMPTS,
    ipFree: env.LOGIN_FAILURE_IP_FREE_ATTEMPTS,
    baseMs: env.LOGIN_FAILURE_BASE_COOLDOWN_SECONDS * 1000,
    maxMs: env.LOGIN_FAILURE_MAX_COOLDOWN_SECONDS * 1000,
    accountAlert: env.LOGIN_FAILURE_ACCOUNT_ALERT_THRESHOLD,
  };
}

function hashIdentifier(identifier) {
  return crypto.createHash('sha256').update(String(identifier || '')).digest('hex').slice(0, 24);
}

function cooldownMs(failures, free, baseMs, maxMs) {
  if (failures < free) return 0;
  const exponent = Math.min(failures - free, 16);
  return Math.min(maxMs, baseMs * 2 ** exponent);
}

function touch(map, key, nowMs) {
  let entry = map.get(key);
  if (entry && nowMs - entry.lastFailureAt > Math.max(FAILURE_WINDOW_MS, entry.blockedUntil - entry.lastFailureAt)) {
    map.delete(key);
    entry = null;
  }
  if (!entry) {
    if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value);
    entry = { failures: 0, lastFailureAt: nowMs, blockedUntil: 0, ips: new Set(), alerted: false };
  }
  map.delete(key);
  map.set(key, entry);
  return entry;
}

function pairKey(ip, identifier) {
  return `${ip || 'unknown'}|${hashIdentifier(identifier)}`;
}

/**
 * @returns {{ blocked: boolean, retryAfterSeconds: number, scope: 'ip_identifier'|'ip'|null }}
 */
function checkLoginAllowed({ ip, identifier, nowMs = Date.now() }) {
  const pair = pairs.get(pairKey(ip, identifier));
  if (pair && pair.blockedUntil > nowMs) {
    return { blocked: true, retryAfterSeconds: Math.ceil((pair.blockedUntil - nowMs) / 1000), scope: 'ip_identifier' };
  }
  const ipEntry = ips.get(ip || 'unknown');
  if (ipEntry && ipEntry.blockedUntil > nowMs) {
    return { blocked: true, retryAfterSeconds: Math.ceil((ipEntry.blockedUntil - nowMs) / 1000), scope: 'ip' };
  }
  return { blocked: false, retryAfterSeconds: 0, scope: null };
}

/**
 * Record one wrong-password / unknown-identifier attempt.
 * @returns {{ pairFailures: number, cooldownSeconds: number, accountAlert: null | { failures: number, distinctIps: number } }}
 */
function noteLoginFailure({ ip, identifier, nowMs = Date.now() }) {
  const c = cfg();
  const pair = touch(pairs, pairKey(ip, identifier), nowMs);
  pair.failures += 1;
  pair.lastFailureAt = nowMs;
  const pairCooldown = cooldownMs(pair.failures, c.pairFree, c.baseMs, c.maxMs);
  if (pairCooldown) pair.blockedUntil = nowMs + pairCooldown;

  const ipEntry = touch(ips, ip || 'unknown', nowMs);
  ipEntry.failures += 1;
  ipEntry.lastFailureAt = nowMs;
  const ipCooldown = cooldownMs(ipEntry.failures, c.ipFree, c.baseMs, c.maxMs);
  if (ipCooldown) ipEntry.blockedUntil = nowMs + ipCooldown;

  let accountAlert = null;
  if (identifier) {
    const account = touch(accounts, hashIdentifier(identifier), nowMs);
    account.failures += 1;
    account.lastFailureAt = nowMs;
    if (account.ips.size < 100) account.ips.add(ip || 'unknown');
    if (!account.alerted && account.failures >= c.accountAlert) {
      account.alerted = true;
      accountAlert = { failures: account.failures, distinctIps: account.ips.size };
    }
  }
  return {
    pairFailures: pair.failures,
    cooldownSeconds: Math.ceil(Math.max(pairCooldown, ipCooldown) / 1000),
    accountAlert,
  };
}

/** A correct password clears this client's cooldown for that identifier. */
function noteLoginSuccess({ ip, identifier }) {
  pairs.delete(pairKey(ip, identifier));
}

function resetLoginThrottleForTests() {
  pairs.clear();
  ips.clear();
  accounts.clear();
}

module.exports = {
  checkLoginAllowed,
  noteLoginFailure,
  noteLoginSuccess,
  hashIdentifier,
  cooldownMs,
  resetLoginThrottleForTests,
};

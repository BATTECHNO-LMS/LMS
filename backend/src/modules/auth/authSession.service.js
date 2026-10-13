'use strict';

/**
 * Server-side authentication sessions (`auth_sessions`).
 *
 * - One row per successful login. The JWT carries only the row id (`sid`).
 * - `last_activity_at` = last real human activity → controls the idle timeout.
 * - `last_seen_at`     = presence / background traffic → never extends the session.
 * - Ending a session is a conditional update (`ended_at IS NULL`) so the matching audit
 *   event (USER_LOGOUT / AUTH_SESSION_IDLE_TIMEOUT / AUTH_SESSION_ENDED) is written once.
 */

const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const { recordAudit } = require('../../shared/services/audit.service');
const { SESSION_END_REASONS, AUDIT_OUTCOMES } = require('../../shared/audit/auditActions');
const { AUTH_ERROR_CODES } = require('../../utils/authErrorCatalog');
const { logger } = require('../../utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SESSION_SELECT = Object.freeze({
  id: true,
  user_id: true,
  created_at: true,
  last_seen_at: true,
  last_activity_at: true,
  absolute_expires_at: true,
  ended_at: true,
  end_reason: true,
  is_active: true,
  portal_type: true,
});

function sessionConfig() {
  return {
    idleTimeoutMs: env.AUTH_IDLE_TIMEOUT_MINUTES * 60_000,
    idleTimeoutMinutes: env.AUTH_IDLE_TIMEOUT_MINUTES,
    warningMinutes: env.AUTH_IDLE_WARNING_MINUTES,
    absoluteTimeoutMs: env.AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS * 3_600_000,
    cacheTtlMs: env.AUTH_SESSION_CACHE_TTL_MS,
    activityThrottleMs: env.AUTH_SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS * 1000,
    presenceThrottleMs: env.AUTH_SESSION_PRESENCE_WRITE_THROTTLE_SECONDS * 1000,
  };
}

function toMs(value) {
  if (value == null) return NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function codeForEndReason(endReason) {
  if (endReason === SESSION_END_REASONS.IDLE_TIMEOUT) return AUTH_ERROR_CODES.SESSION_IDLE_TIMEOUT;
  if (endReason === SESSION_END_REASONS.ABSOLUTE_EXPIRY) return AUTH_ERROR_CODES.SESSION_ABSOLUTE_EXPIRED;
  return AUTH_ERROR_CODES.SESSION_ENDED;
}

/**
 * Pure session validity check (no I/O).
 * @returns {{ ok: true } | { ok: false, code: string, endReason?: string, needsEnding: boolean, expiredAt?: Date }}
 */
function evaluateSession(row, now = new Date(), cfg = sessionConfig()) {
  if (!row) return { ok: false, code: AUTH_ERROR_CODES.SESSION_NOT_FOUND, needsEnding: false };
  if (row.ended_at || row.is_active === false) {
    return { ok: false, code: codeForEndReason(row.end_reason), endReason: row.end_reason || null, needsEnding: false };
  }
  const nowMs = toMs(now);
  const absoluteMs = toMs(row.absolute_expires_at);
  if (Number.isFinite(absoluteMs) && nowMs >= absoluteMs) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.SESSION_ABSOLUTE_EXPIRED,
      endReason: SESSION_END_REASONS.ABSOLUTE_EXPIRY,
      needsEnding: true,
      expiredAt: new Date(absoluteMs),
    };
  }
  const lastActivityMs = toMs(row.last_activity_at);
  if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs >= cfg.idleTimeoutMs) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.SESSION_IDLE_TIMEOUT,
      endReason: SESSION_END_REASONS.IDLE_TIMEOUT,
      needsEnding: true,
      expiredAt: new Date(lastActivityMs + cfg.idleTimeoutMs),
    };
  }
  return { ok: true };
}

/** Client-facing timing info (no ids beyond what the client already holds). */
function describeSession(row, now = new Date(), cfg = sessionConfig()) {
  const lastActivityMs = toMs(row.last_activity_at);
  return {
    serverNow: new Date(now).toISOString(),
    lastActivityAt: new Date(lastActivityMs).toISOString(),
    idleExpiresAt: new Date(lastActivityMs + cfg.idleTimeoutMs).toISOString(),
    absoluteExpiresAt: new Date(toMs(row.absolute_expires_at)).toISOString(),
    idleTimeoutMinutes: cfg.idleTimeoutMinutes,
    warningMinutes: cfg.warningMinutes,
  };
}

// ── store (swappable for tests) ─────────────────────────────────────────────

const dbStore = {
  async findById(id) {
    return prisma.auth_sessions.findUnique({ where: { id }, select: SESSION_SELECT });
  },
  async create(data) {
    return prisma.auth_sessions.create({ data, select: SESSION_SELECT });
  },
  /** @returns {Promise<boolean>} true when this call ended the session */
  async endIfOpen(id, { endReason, endedAt }) {
    const res = await prisma.auth_sessions.updateMany({
      where: { id, ended_at: null },
      data: { is_active: false, ended_at: endedAt, end_reason: endReason },
    });
    return res.count === 1;
  },
  /**
   * Record human activity. Never revives an ended session.
   * @returns {Promise<{ updated: boolean, firstActivity: boolean }>}
   */
  async touchActivity(id, at) {
    const rows = await prisma.$queryRaw`
      WITH prev AS (
        SELECT id, last_activity_at, created_at FROM auth_sessions
        WHERE id = ${id}::uuid AND ended_at IS NULL AND is_active = true
        FOR UPDATE
      )
      UPDATE auth_sessions s
      SET last_activity_at = ${at}, last_seen_at = GREATEST(s.last_seen_at, ${at})
      FROM prev
      WHERE s.id = prev.id
      RETURNING (prev.last_activity_at = prev.created_at) AS first_activity`;
    if (!rows.length) return { updated: false, firstActivity: false };
    return { updated: true, firstActivity: Boolean(rows[0].first_activity) };
  },
  async touchPresence(id, at) {
    const res = await prisma.auth_sessions.updateMany({
      where: { id, ended_at: null, is_active: true },
      data: { last_seen_at: at },
    });
    return res.count === 1;
  },
  async findExpiredOpen(now, idleCutoff, limit) {
    return prisma.auth_sessions.findMany({
      where: {
        ended_at: null,
        OR: [{ last_activity_at: { lte: idleCutoff } }, { absolute_expires_at: { lte: now } }],
      },
      select: SESSION_SELECT,
      take: limit,
    });
  },
  async listForUser(userId, { take = 20 } = {}) {
    return prisma.auth_sessions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take,
      select: { ...SESSION_SELECT, ip_address: false, user_agent: false, created_by_login_method: true },
    });
  },
};

let store = dbStore;
/** Test hook: replace persistence (in-memory store). */
function setAuthSessionStoreForTests(fakeStore) {
  store = fakeStore || dbStore;
  sessionCache.clear();
}
function resetAuthSessionStoreForTests() {
  store = dbStore;
  sessionCache.clear();
}

// ── cache ──────────────────────────────────────────────────────────────────

const SESSION_CACHE_MAX = 10_000;
/** sid → { row, fetchedAt, lastPresenceWriteMs } */
const sessionCache = new Map();

function cachePut(row, nowMs) {
  if (!row) return;
  if (sessionCache.size >= SESSION_CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value);
  const prev = sessionCache.get(row.id);
  sessionCache.set(row.id, {
    row: { ...row },
    fetchedAt: nowMs,
    lastPresenceWriteMs: prev?.lastPresenceWriteMs ?? toMs(row.last_seen_at),
  });
}

function cacheGetFresh(sid, nowMs, ttlMs) {
  const hit = sessionCache.get(sid);
  if (!hit || ttlMs <= 0) return null;
  if (nowMs - hit.fetchedAt > ttlMs) return null;
  return hit;
}

function invalidateSessionCache(sid) {
  if (sid) sessionCache.delete(sid);
}

// ── lifecycle ───────────────────────────────────────────────────────────────

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Create a session for a successful login. Returns the row (id → JWT `sid`).
 */
async function createSession({ userId, ipAddress, userAgent, portalType, loginMethod = 'PASSWORD', now = new Date() }) {
  const cfg = sessionConfig();
  const row = await store.create({
    user_id: userId,
    created_at: now,
    last_seen_at: now,
    last_activity_at: now,
    absolute_expires_at: new Date(toMs(now) + cfg.absoluteTimeoutMs),
    ip_address: ipAddress ? String(ipAddress).slice(0, 64) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    created_by_login_method: loginMethod,
    portal_type: portalType || null,
    is_active: true,
  });
  cachePut(row, toMs(now));
  await recordAudit({
    userId,
    subjectUserId: userId,
    sessionId: row.id,
    actionType: 'AUTH_SESSION_CREATED',
    entityType: 'auth_session',
    entityId: row.id,
    newValues: {
      loginMethod,
      portalType: portalType || null,
      idleTimeoutMinutes: cfg.idleTimeoutMinutes,
      absoluteExpiresAt: new Date(toMs(row.absolute_expires_at)).toISOString(),
    },
  });
  return row;
}

const END_ACTION_BY_REASON = Object.freeze({
  [SESSION_END_REASONS.USER_LOGOUT]: 'USER_LOGOUT',
  [SESSION_END_REASONS.IDLE_TIMEOUT]: 'AUTH_SESSION_IDLE_TIMEOUT',
  [SESSION_END_REASONS.ABSOLUTE_EXPIRY]: 'AUTH_SESSION_ENDED',
  [SESSION_END_REASONS.ADMIN_REVOKED]: 'AUTH_SESSION_ENDED',
});

/**
 * End a session exactly once and write the matching audit event.
 * @returns {Promise<boolean>} true if this call ended it
 */
async function endSession(row, endReason, { now = new Date(), actorUserId, detectedBy = 'server', endedAt } = {}) {
  if (!row?.id) return false;
  const cfg = sessionConfig();
  const effectiveEndedAt = endedAt || now;
  let ended = false;
  try {
    ended = await store.endIfOpen(row.id, { endReason, endedAt: effectiveEndedAt });
  } finally {
    invalidateSessionCache(row.id);
  }
  if (!ended) return false;

  const lastActivityAt = row.last_activity_at ? new Date(toMs(row.last_activity_at)).toISOString() : null;
  const newValues = {
    endReason,
    endedAt: new Date(toMs(effectiveEndedAt)).toISOString(),
    lastActivityAt,
    detectedBy,
  };
  if (endReason === SESSION_END_REASONS.IDLE_TIMEOUT) newValues.idleMinutes = cfg.idleTimeoutMinutes;
  await recordAudit({
    userId: actorUserId || row.user_id,
    subjectUserId: row.user_id,
    sessionId: row.id,
    actionType: END_ACTION_BY_REASON[endReason] || 'AUTH_SESSION_ENDED',
    entityType: 'auth_session',
    entityId: row.id,
    newValues,
  });
  return true;
}

/**
 * Validate the session referenced by a JWT `sid` for every protected request.
 * Uses a short in-process cache; any cached "expired" verdict is re-checked against the DB
 * before the session is ended, so activity recorded by another process is respected.
 *
 * @returns {Promise<{ ok: true, session: object } | { ok: false, code: string }>}
 */
async function validateSession({ sid, userId, now = new Date() }) {
  if (!isUuid(sid)) return { ok: false, code: AUTH_ERROR_CODES.SESSION_NOT_FOUND };
  const cfg = sessionConfig();
  const nowMs = toMs(now);

  let fromCache = true;
  let row = cacheGetFresh(sid, nowMs, cfg.cacheTtlMs)?.row || null;
  if (!row) {
    fromCache = false;
    row = await store.findById(sid);
    if (row) cachePut(row, nowMs);
  }
  if (!row || row.user_id !== userId) return { ok: false, code: AUTH_ERROR_CODES.SESSION_NOT_FOUND };

  let verdict = evaluateSession(row, now, cfg);
  if (!verdict.ok && verdict.needsEnding && fromCache) {
    row = await store.findById(sid);
    if (row) cachePut(row, nowMs);
    if (!row || row.user_id !== userId) return { ok: false, code: AUTH_ERROR_CODES.SESSION_NOT_FOUND };
    verdict = evaluateSession(row, now, cfg);
  }
  if (!verdict.ok) {
    if (verdict.needsEnding) {
      await endSession(row, verdict.endReason, { now, endedAt: verdict.expiredAt, detectedBy: 'request' });
    }
    return { ok: false, code: verdict.code };
  }
  return { ok: true, session: row };
}

/**
 * Presence: background requests / visible-tab pings. Throttled; never touches last_activity_at.
 */
async function recordPresence(session, { now = new Date() } = {}) {
  const cfg = sessionConfig();
  const nowMs = toMs(now);
  const hit = sessionCache.get(session.id);
  const lastWrite = hit?.lastPresenceWriteMs ?? toMs(session.last_seen_at);
  if (Number.isFinite(lastWrite) && nowMs - lastWrite < cfg.presenceThrottleMs) return false;
  if (hit) {
    hit.lastPresenceWriteMs = nowMs;
    hit.row.last_seen_at = new Date(nowMs);
  }
  return store.touchPresence(session.id, new Date(nowMs));
}

/** Fire-and-forget presence bump used by the auth middleware. */
function notePresenceInBackground(session) {
  recordPresence(session).catch((err) => {
    logger.warn('AUTH_SESSION_PRESENCE_WRITE_FAILED', { error: String(err?.message || err).slice(0, 200) });
  });
}

/**
 * Real human activity (explicit client ping). Throttled server-side; cannot revive
 * a session that is already idle/ended (validateSession runs first in the middleware).
 */
async function recordActivity(session, { now = new Date() } = {}) {
  const cfg = sessionConfig();
  const nowMs = toMs(now);
  const lastActivityMs = toMs(session.last_activity_at);
  if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs < cfg.activityThrottleMs) {
    return { updated: false, session };
  }
  const result = await store.touchActivity(session.id, new Date(nowMs));
  if (!result.updated) {
    invalidateSessionCache(session.id);
    return { updated: false, session };
  }
  const nextRow = { ...session, last_activity_at: new Date(nowMs), last_seen_at: new Date(nowMs) };
  cachePut(nextRow, nowMs);
  const hit = sessionCache.get(session.id);
  if (hit) hit.lastPresenceWriteMs = nowMs;
  if (result.firstActivity) {
    await recordAudit({
      userId: session.user_id,
      subjectUserId: session.user_id,
      sessionId: session.id,
      actionType: 'AUTH_SESSION_ACTIVITY_STARTED',
      entityType: 'auth_session',
      entityId: session.id,
    });
  }
  return { updated: true, session: nextRow };
}

/**
 * Close idle / absolute-expired sessions nobody is calling with anymore so the
 * idle timeout is recorded even if the user simply closed the browser.
 */
async function sweepExpiredSessions({ now = new Date(), limit = 500 } = {}) {
  const cfg = sessionConfig();
  const idleCutoff = new Date(toMs(now) - cfg.idleTimeoutMs);
  const rows = await store.findExpiredOpen(now, idleCutoff, limit);
  let ended = 0;
  for (const row of rows) {
    const verdict = evaluateSession(row, now, cfg);
    if (verdict.ok || !verdict.needsEnding) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await endSession(row, verdict.endReason, { now, endedAt: verdict.expiredAt, detectedBy: 'sweeper' })) {
      ended += 1;
    }
  }
  return { scanned: rows.length, ended };
}

let sweepTimer = null;
function startSessionSweeper() {
  const interval = env.AUTH_SESSION_SWEEP_INTERVAL_MS;
  if (!interval || env.NODE_ENV === 'test' || sweepTimer) return null;
  sweepTimer = setInterval(() => {
    sweepExpiredSessions().catch((err) => {
      logger.error('AUTH_SESSION_SWEEP_FAILED', { error: String(err?.message || err).slice(0, 300) });
    });
  }, interval);
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
  return sweepTimer;
}

function stopSessionSweeper() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

async function getSessionById(sid) {
  if (!isUuid(sid)) return null;
  return store.findById(sid);
}

async function listSessionsForUser(userId, options) {
  return store.listForUser(userId, options);
}

module.exports = {
  AUDIT_OUTCOMES,
  SESSION_END_REASONS,
  sessionConfig,
  evaluateSession,
  describeSession,
  createSession,
  endSession,
  validateSession,
  recordPresence,
  notePresenceInBackground,
  recordActivity,
  sweepExpiredSessions,
  startSessionSweeper,
  stopSessionSweeper,
  getSessionById,
  listSessionsForUser,
  invalidateSessionCache,
  codeForEndReason,
  setAuthSessionStoreForTests,
  resetAuthSessionStoreForTests,
  defaultAuthSessionStore: dbStore,
};

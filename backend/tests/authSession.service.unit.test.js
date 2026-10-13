'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { installAuditCapture } = require('./helpers/auditCapture');
const authSessions = require('../src/modules/auth/authSession.service');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SID = '33333333-3333-4333-8333-333333333333';
const MIN = 60_000;
const T0 = new Date('2026-10-13T08:00:00.000Z');

function at(minutes) {
  return new Date(T0.getTime() + minutes * MIN);
}

/** Faithful in-memory port of the DB store semantics (conditional end, no revive). */
function makeStore() {
  const rows = new Map();
  const calls = { presence: 0, activity: 0 };
  return {
    rows,
    calls,
    async findById(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async create(data) {
      const row = { id: SID, ended_at: null, end_reason: null, ...data };
      rows.set(row.id, row);
      return { ...row };
    },
    async endIfOpen(id, { endReason, endedAt }) {
      const r = rows.get(id);
      if (!r || r.ended_at) return false;
      Object.assign(r, { ended_at: endedAt, end_reason: endReason, is_active: false });
      return true;
    },
    async touchActivity(id, when) {
      calls.activity += 1;
      const r = rows.get(id);
      if (!r || r.ended_at || r.is_active === false) return { updated: false, firstActivity: false };
      const first = r.last_activity_at.getTime() === r.created_at.getTime();
      r.last_activity_at = when;
      r.last_seen_at = when;
      return { updated: true, firstActivity: first };
    },
    async touchPresence(id, when) {
      calls.presence += 1;
      const r = rows.get(id);
      if (!r || r.ended_at) return false;
      r.last_seen_at = when;
      return true;
    },
    async findExpiredOpen(now, idleCutoff) {
      return [...rows.values()]
        .filter((r) => !r.ended_at && (r.last_activity_at <= idleCutoff || r.absolute_expires_at <= now))
        .map((r) => ({ ...r }));
    },
    async listForUser(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId);
    },
  };
}

describe('auth sessions — idle timeout policy', () => {
  let audit;
  let store;

  before(() => {
    audit = installAuditCapture();
  });
  after(() => {
    audit.restore();
    authSessions.resetAuthSessionStoreForTests();
  });
  beforeEach(async () => {
    audit.clear();
    store = makeStore();
    authSessions.setAuthSessionStoreForTests(store);
    await authSessions.createSession({ userId: USER, portalType: 'UNIVERSITY', now: T0 });
  });

  it('idle timeout is 30 minutes by default', () => {
    assert.equal(authSessions.sessionConfig().idleTimeoutMinutes, 30);
  });

  it('login creates a session and an AUTH_SESSION_CREATED audit row (no secrets)', () => {
    const created = audit.byAction('AUTH_SESSION_CREATED');
    assert.equal(created.length, 1);
    assert.equal(created[0].subject_user_id, USER);
    const json = JSON.stringify(created[0]);
    assert.doesNotMatch(json, /"password"\s*:|password_hash|eyJ[A-Za-z0-9_-]{10,}/i);
  });

  it('evaluateSession: valid at 29m59s, idle at 30m, absolute expiry wins', () => {
    const row = { id: SID, user_id: USER, last_activity_at: T0, absolute_expires_at: at(12 * 60), ended_at: null };
    assert.equal(authSessions.evaluateSession(row, new Date(at(30).getTime() - 1000)).ok, true);
    const idle = authSessions.evaluateSession(row, at(30));
    assert.equal(idle.ok, false);
    assert.equal(idle.code, 'SESSION_IDLE_TIMEOUT');
    assert.equal(idle.endReason, 'IDLE_TIMEOUT');
    assert.deepEqual(idle.expiredAt, at(30));
    const abs = authSessions.evaluateSession({ ...row, last_activity_at: at(12 * 60 - 1) }, at(12 * 60));
    assert.equal(abs.code, 'SESSION_ABSOLUTE_EXPIRED');
    assert.equal(authSessions.evaluateSession(null).code, 'SESSION_NOT_FOUND');
    assert.equal(
      authSessions.evaluateSession({ ...row, ended_at: at(1), end_reason: 'USER_LOGOUT' }).code,
      'SESSION_ENDED'
    );
  });

  it('presence (background traffic) never extends the idle window', async () => {
    for (let m = 1; m <= 29; m += 1) {
      const session = (await authSessions.validateSession({ sid: SID, userId: USER, now: at(m) })).session;
      await authSessions.recordPresence(session, { now: at(m) });
    }
    assert.ok(store.calls.presence > 0, 'presence was written');
    assert.deepEqual(store.rows.get(SID).last_activity_at, T0, 'last_activity_at untouched');
    const verdict = await authSessions.validateSession({ sid: SID, userId: USER, now: at(30) });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'SESSION_IDLE_TIMEOUT');
  });

  it('human activity extends the window; first activity audited once', async () => {
    let session = (await authSessions.validateSession({ sid: SID, userId: USER, now: at(10) })).session;
    await authSessions.recordActivity(session, { now: at(10) });
    session = (await authSessions.validateSession({ sid: SID, userId: USER, now: at(20) })).session;
    await authSessions.recordActivity(session, { now: at(20) });
    assert.equal(audit.byAction('AUTH_SESSION_ACTIVITY_STARTED').length, 1);
    const stillValid = await authSessions.validateSession({ sid: SID, userId: USER, now: at(45) });
    assert.equal(stillValid.ok, true);
    const idle = await authSessions.validateSession({ sid: SID, userId: USER, now: at(50) });
    assert.equal(idle.code, 'SESSION_IDLE_TIMEOUT');
  });

  it('activity pings are throttled server-side (no DB write per request)', async () => {
    const session = (await authSessions.validateSession({ sid: SID, userId: USER, now: at(5) })).session;
    await authSessions.recordActivity(session, { now: at(5) });
    const after = (await authSessions.validateSession({ sid: SID, userId: USER, now: at(5.1) })).session;
    await authSessions.recordActivity(after, { now: at(5.1) });
    assert.equal(store.calls.activity, 1);
  });

  it('idle timeout ends the session exactly once with idleMinutes/lastActivityAt/endedAt', async () => {
    const a = await authSessions.validateSession({ sid: SID, userId: USER, now: at(31) });
    const b = await authSessions.validateSession({ sid: SID, userId: USER, now: at(32) });
    await authSessions.sweepExpiredSessions({ now: at(40) });
    assert.equal(a.code, 'SESSION_IDLE_TIMEOUT');
    assert.equal(b.code, 'SESSION_IDLE_TIMEOUT');
    const rows = audit.byAction('AUTH_SESSION_IDLE_TIMEOUT');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].new_values.idleMinutes, 30);
    assert.equal(rows[0].new_values.lastActivityAt, T0.toISOString());
    assert.equal(rows[0].new_values.endedAt, at(30).toISOString());
    assert.equal(rows[0].category, 'AUTH');
    assert.equal(rows[0].subject_user_id, USER);
    assert.equal(store.rows.get(SID).end_reason, 'IDLE_TIMEOUT');
    assert.equal(store.rows.get(SID).is_active, false);
  });

  it('activity cannot revive an idle-ended session', async () => {
    await authSessions.validateSession({ sid: SID, userId: USER, now: at(31) });
    const row = store.rows.get(SID);
    const result = await authSessions.recordActivity({ ...row }, { now: at(31) });
    assert.equal(result.updated, false);
    const again = await authSessions.validateSession({ sid: SID, userId: USER, now: at(31) });
    assert.equal(again.code, 'SESSION_IDLE_TIMEOUT');
  });

  it('sweeper records the timeout when the browser was simply closed', async () => {
    const out = await authSessions.sweepExpiredSessions({ now: at(35) });
    assert.deepEqual(out, { scanned: 1, ended: 1 });
    assert.equal(audit.byAction('AUTH_SESSION_IDLE_TIMEOUT').length, 1);
    assert.equal(audit.byAction('AUTH_SESSION_IDLE_TIMEOUT')[0].new_values.detectedBy, 'sweeper');
  });

  it('logout ends the session (USER_LOGOUT once) and the old sid is rejected', async () => {
    const row = await authSessions.getSessionById(SID);
    assert.equal(await authSessions.endSession(row, 'USER_LOGOUT', { now: at(3) }), true);
    assert.equal(await authSessions.endSession(row, 'USER_LOGOUT', { now: at(4) }), false);
    assert.equal(audit.byAction('USER_LOGOUT').length, 1);
    const verdict = await authSessions.validateSession({ sid: SID, userId: USER, now: at(5) });
    assert.equal(verdict.code, 'SESSION_ENDED');
  });

  it('admin revoke → AUTH_SESSION_ENDED with ADMIN_REVOKED', async () => {
    const row = await authSessions.getSessionById(SID);
    await authSessions.endSession(row, 'ADMIN_REVOKED', { now: at(2), actorUserId: OTHER });
    const ended = audit.byAction('AUTH_SESSION_ENDED');
    assert.equal(ended.length, 1);
    assert.equal(ended[0].user_id, OTHER);
    assert.equal(ended[0].subject_user_id, USER);
    assert.equal(ended[0].new_values.endReason, 'ADMIN_REVOKED');
  });

  it('a session cannot be used by another user or with a malformed sid', async () => {
    assert.equal((await authSessions.validateSession({ sid: SID, userId: OTHER, now: at(1) })).code, 'SESSION_NOT_FOUND');
    assert.equal((await authSessions.validateSession({ sid: 'nope', userId: USER, now: at(1) })).code, 'SESSION_NOT_FOUND');
    assert.equal((await authSessions.validateSession({ sid: undefined, userId: USER, now: at(1) })).code, 'SESSION_NOT_FOUND');
  });
});

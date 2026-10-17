'use strict';

const { randomUUID } = require('node:crypto');

/**
 * In-memory port of src/modules/auth/mfa/mfa.store.js: same conditional-update semantics
 * (single-use codes/challenges, replay-safe time steps), no database.
 * `users` maps id → { id, email, status, password_hash, roles, assignmentRoleCodes, isGlobal }.
 */
function makeFakeMfaStore({ users = {} } = {}) {
  const methods = new Map();
  const codes = [];
  const challenges = new Map();
  const clone = (x) => (x ? { ...x } : null);
  const openMethod = (m) => !m.disabled_at;

  return {
    methods,
    codes,
    challenges,
    users,

    async findActiveMethod(userId) {
      const list = [...methods.values()].filter((m) => m.user_id === userId && m.enabled_at && openMethod(m));
      list.sort((a, b) => b.enabled_at - a.enabled_at);
      return clone(list[0]);
    },
    async findPendingMethod(userId) {
      const list = [...methods.values()].filter((m) => m.user_id === userId && !m.enabled_at && openMethod(m));
      list.sort((a, b) => b.created_at - a.created_at);
      return clone(list[0]);
    },
    async deletePendingMethods(userId) {
      for (const [id, m] of methods) if (m.user_id === userId && !m.enabled_at && !m.disabled_at) methods.delete(id);
    },
    async createMethod({ userId, secretEncrypted, now }) {
      const row = {
        id: randomUUID(),
        user_id: userId,
        type: 'TOTP',
        secret_encrypted: secretEncrypted,
        created_at: now,
        updated_at: now,
        verified_at: null,
        enabled_at: null,
        disabled_at: null,
        disabled_reason: null,
        last_used_at: null,
        last_used_step: null,
        failed_attempts: 0,
        locked_until: null,
      };
      methods.set(row.id, row);
      return clone(row);
    },
    async enableMethod(id, userId, { now, timeStep }) {
      const m = methods.get(id);
      if (!m || m.user_id !== userId || m.enabled_at || m.disabled_at) return false;
      Object.assign(m, { verified_at: now, enabled_at: now, last_used_at: now, last_used_step: timeStep, failed_attempts: 0, locked_until: null });
      for (const other of methods.values()) {
        if (other.user_id === userId && other.id !== id && !other.disabled_at) {
          Object.assign(other, { disabled_at: now, disabled_reason: 'REPLACED' });
        }
      }
      return true;
    },
    async recordTotpSuccess(id, { now, timeStep }) {
      const m = methods.get(id);
      if (!m || m.disabled_at) return false;
      if (m.last_used_step != null && !(m.last_used_step < timeStep)) return false;
      Object.assign(m, { last_used_step: timeStep, last_used_at: now, failed_attempts: 0, locked_until: null });
      return true;
    },
    async recordRecoverySuccess(id, { now }) {
      const m = methods.get(id);
      if (m && !m.disabled_at) Object.assign(m, { last_used_at: now, failed_attempts: 0, locked_until: null });
    },
    async incrementMethodFailures(id) {
      const m = methods.get(id);
      m.failed_attempts += 1;
      return m.failed_attempts;
    },
    async lockMethod(id, { lockedUntil }) {
      methods.get(id).locked_until = lockedUntil;
    },
    async disableMethods(userId, { reason, now }) {
      let n = 0;
      for (const m of methods.values()) {
        if (m.user_id === userId && !m.disabled_at) {
          Object.assign(m, { disabled_at: now, disabled_reason: reason });
          n += 1;
        }
      }
      return n;
    },

    async replaceRecoveryCodes(userId, hashes, { now }) {
      let revoked = 0;
      for (const c of codes) {
        if (c.user_id === userId && !c.used_at && !c.revoked_at) {
          c.revoked_at = now;
          revoked += 1;
        }
      }
      for (const code_hash of hashes) codes.push({ id: randomUUID(), user_id: userId, code_hash, created_at: now, used_at: null, revoked_at: null });
      return revoked;
    },
    async consumeRecoveryCode(userId, codeHash, { now }) {
      const c = codes.find((x) => x.user_id === userId && x.code_hash === codeHash && !x.used_at && !x.revoked_at);
      if (!c) return false;
      c.used_at = now;
      return true;
    },
    async countRemainingRecoveryCodes(userId) {
      return codes.filter((c) => c.user_id === userId && !c.used_at && !c.revoked_at).length;
    },
    async revokeRecoveryCodes(userId, { now }) {
      let n = 0;
      for (const c of codes) {
        if (c.user_id === userId && !c.used_at && !c.revoked_at) {
          c.revoked_at = now;
          n += 1;
        }
      }
      return n;
    },

    async createChallenge(data) {
      const row = { id: randomUUID(), verified_at: null, completed_at: null, ...data };
      challenges.set(row.id, row);
      return clone(row);
    },
    async findChallengeByTokenHash(tokenHash) {
      return clone([...challenges.values()].find((c) => c.token_hash === tokenHash));
    },
    async incrementChallengeAttempts(id) {
      const c = challenges.get(id);
      if (!c || !['PENDING', 'VERIFIED'].includes(c.status)) return null;
      c.attempts += 1;
      return c.attempts;
    },
    async transitionChallenge(id, fromStatuses, data) {
      const c = challenges.get(id);
      if (!c || !fromStatuses.includes(c.status)) return false;
      Object.assign(c, data);
      return true;
    },
    async cancelOpenChallenges(userId, { now }) {
      let n = 0;
      for (const c of challenges.values()) {
        if (c.user_id === userId && ['PENDING', 'VERIFIED'].includes(c.status)) {
          Object.assign(c, { status: 'CANCELLED', completed_at: now });
          n += 1;
        }
      }
      return n;
    },

    async findUserBasics(userId) {
      const u = users[userId];
      return u ? { id: u.id, email: u.email, status: u.status, password_hash: u.password_hash } : null;
    },
    async loadPolicySubject(userId) {
      const u = users[userId] || {};
      return { roles: u.roles || [], assignmentRoleCodes: u.assignmentRoleCodes || [], isGlobal: Boolean(u.isGlobal) };
    },
  };
}

/** Minimal in-memory auth-session store (create / end / mark MFA / list). */
function makeFakeSessionStore() {
  const rows = new Map();
  return {
    rows,
    async findById(id) {
      return clone(rows.get(id));
    },
    async create(data) {
      const row = { id: randomUUID(), ended_at: null, end_reason: null, ...data };
      rows.set(row.id, row);
      return { ...row };
    },
    async listOpenForUser(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId && !r.ended_at).map((r) => ({ ...r }));
    },
    async endIfOpen(id, { endReason, endedAt }) {
      const r = rows.get(id);
      if (!r || r.ended_at) return false;
      Object.assign(r, { ended_at: endedAt, end_reason: endReason, is_active: false });
      return true;
    },
    async touchActivity() {
      return { updated: false, firstActivity: false };
    },
    async touchPresence() {
      return true;
    },
    async findExpiredOpen() {
      return [];
    },
    async listForUser(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId);
    },
    async listForOwner(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId).map((r) => ({ ...r }));
    },
    async markMfaVerified(id, at) {
      const r = rows.get(id);
      if (!r || r.ended_at || r.is_active === false) return false;
      Object.assign(r, { authentication_level: 'MFA', mfa_verified_at: at });
      return true;
    },
  };
}

function clone(x) {
  return x ? { ...x } : null;
}

module.exports = { makeFakeMfaStore, makeFakeSessionStore };

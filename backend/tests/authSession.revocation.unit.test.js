'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../src/config/db');
const { installAuditCapture } = require('./helpers/auditCapture');
const authSessions = require('../src/modules/auth/authSession.service');
const otpRepository = require('../src/modules/auth/passwordResetOtp.repository');
const { hashPasswordResetToken } = require('../src/utils/passwordResetToken');
const { resetPasswordWithToken } = require('../src/modules/auth/passwordReset.service');

const USER = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'student@example.test';

function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async findById(id) { return rows.has(id) ? { ...rows.get(id) } : null; },
    async create(data) {
      const row = { id: randomUUID(), ended_at: null, end_reason: null, ...data };
      rows.set(row.id, row);
      return { ...row };
    },
    async endIfOpen(id, { endReason, endedAt }) {
      const r = rows.get(id);
      if (!r || r.ended_at) return false;
      Object.assign(r, { ended_at: endedAt, end_reason: endReason, is_active: false });
      return true;
    },
    async touchActivity() { return { updated: false, firstActivity: false }; },
    async touchPresence() { return true; },
    async findExpiredOpen() { return []; },
    async listOpenForUser(userId) {
      return [...rows.values()].filter((r) => r.user_id === userId && !r.ended_at).map((r) => ({ ...r }));
    },
    async listForUser() { return []; },
  };
}

describe('password reset revokes every open session', () => {
  let audit;
  let store;
  const originals = {};

  before(() => {
    audit = installAuditCapture();
    store = memoryStore();
    authSessions.setAuthSessionStoreForTests(store);
    originals.findValid = otpRepository.findValidResetSession;
    originals.markCompleted = otpRepository.markResetCompleted;
    originals.usersFindUnique = prisma.users.findUnique;
    originals.transaction = prisma.$transaction;
  });

  after(() => {
    otpRepository.findValidResetSession = originals.findValid;
    otpRepository.markResetCompleted = originals.markCompleted;
    prisma.users.findUnique = originals.usersFindUnique;
    prisma.$transaction = originals.transaction;
    authSessions.resetAuthSessionStoreForTests();
    audit.restore();
  });

  it('ends all sessions with PASSWORD_RESET; old JWT sids are rejected afterwards', async () => {
    const laptop = await authSessions.createSession({ userId: USER, portalType: 'UNIVERSITY' });
    const phone = await authSessions.createSession({ userId: USER, portalType: 'UNIVERSITY' });
    audit.clear();

    const resetToken = 'reset-token-value';
    otpRepository.findValidResetSession = async () => ({
      id: 'otp-row',
      reset_token_hash: hashPasswordResetToken(resetToken, EMAIL),
    });
    otpRepository.markResetCompleted = async () => {};
    prisma.users.findUnique = async () => ({ id: USER, email: EMAIL, status: 'active', email_verified_at: new Date() });
    prisma.$transaction = async (fn) => fn({ users: { update: async () => ({}) } });

    await resetPasswordWithToken({ email: EMAIL, resetToken, newPassword: 'N3w-Strong-Passw0rd!' });

    for (const s of [laptop, phone]) {
      const verdict = await authSessions.validateSession({ sid: s.id, userId: USER });
      assert.equal(verdict.code, 'SESSION_ENDED');
      assert.equal(store.rows.get(s.id).end_reason, 'PASSWORD_RESET');
    }
    const ended = audit.byAction('AUTH_SESSION_REVOKED');
    assert.equal(ended.length, 2);
    assert.ok(ended.every((r) => r.new_values.endReason === 'PASSWORD_RESET'));
    const json = JSON.stringify(audit.rows);
    assert.equal(json.includes(resetToken), false, 'reset token never audited');
    assert.equal(json.includes('N3w-Strong-Passw0rd!'), false, 'password never audited');
  });
});

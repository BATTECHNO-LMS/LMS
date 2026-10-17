'use strict';

/**
 * Persistence for MFA factors, recovery codes and pre-session challenges.
 * Every state transition that matters for security is a conditional update
 * (single use, no replay, no revival), so concurrent requests cannot both succeed.
 * Swappable for unit tests via setMfaStoreForTests().
 */

const { prisma } = require('../../../config/db');
const { canonicalizeRoleCode, normalizeRoleCodes } = require('../../../utils/roleCanon');
const { env } = require('../../../config/env');

const METHOD_SELECT = Object.freeze({
  id: true,
  user_id: true,
  type: true,
  secret_encrypted: true,
  created_at: true,
  verified_at: true,
  enabled_at: true,
  disabled_at: true,
  last_used_at: true,
  last_used_step: true,
  failed_attempts: true,
  locked_until: true,
});

const CHALLENGE_SELECT = Object.freeze({
  id: true,
  user_id: true,
  purpose: true,
  status: true,
  portal_type: true,
  ip_address: true,
  user_agent: true,
  attempts: true,
  created_at: true,
  expires_at: true,
  verified_at: true,
  completed_at: true,
});

function toMethod(row) {
  if (!row) return null;
  return { ...row, last_used_step: row.last_used_step == null ? null : Number(row.last_used_step) };
}

const dbStore = {
  async findActiveMethod(userId) {
    const row = await prisma.user_mfa_methods.findFirst({
      where: { user_id: userId, enabled_at: { not: null }, disabled_at: null },
      orderBy: { enabled_at: 'desc' },
      select: METHOD_SELECT,
    });
    return toMethod(row);
  },
  async findPendingMethod(userId) {
    const row = await prisma.user_mfa_methods.findFirst({
      where: { user_id: userId, enabled_at: null, disabled_at: null },
      orderBy: { created_at: 'desc' },
      select: METHOD_SELECT,
    });
    return toMethod(row);
  },
  /** Pending (never verified) enrollments carry no security state: replaced on restart. */
  async deletePendingMethods(userId) {
    await prisma.user_mfa_methods.deleteMany({ where: { user_id: userId, enabled_at: null, disabled_at: null } });
  },
  async createMethod({ userId, secretEncrypted, now }) {
    const row = await prisma.user_mfa_methods.create({
      data: { user_id: userId, type: 'TOTP', secret_encrypted: secretEncrypted, created_at: now, updated_at: now },
      select: METHOD_SELECT,
    });
    return toMethod(row);
  },
  /** Pending → enabled, once. Any previously enabled factor is retired. */
  async enableMethod(id, userId, { now, timeStep }) {
    return prisma.$transaction(async (tx) => {
      const res = await tx.user_mfa_methods.updateMany({
        where: { id, user_id: userId, enabled_at: null, disabled_at: null },
        data: {
          verified_at: now,
          enabled_at: now,
          last_used_at: now,
          last_used_step: BigInt(timeStep),
          failed_attempts: 0,
          locked_until: null,
          updated_at: now,
        },
      });
      if (res.count !== 1) return false;
      await tx.user_mfa_methods.updateMany({
        where: { user_id: userId, id: { not: id }, disabled_at: null },
        data: { disabled_at: now, disabled_reason: 'REPLACED', updated_at: now },
      });
      return true;
    });
  },
  /** Accept a TOTP step only if it is newer than the last accepted one (replay-safe under concurrency). */
  async recordTotpSuccess(id, { now, timeStep }) {
    const res = await prisma.user_mfa_methods.updateMany({
      where: {
        id,
        disabled_at: null,
        OR: [{ last_used_step: null }, { last_used_step: { lt: BigInt(timeStep) } }],
      },
      data: { last_used_step: BigInt(timeStep), last_used_at: now, failed_attempts: 0, locked_until: null, updated_at: now },
    });
    return res.count === 1;
  },
  async recordRecoverySuccess(id, { now }) {
    await prisma.user_mfa_methods.updateMany({
      where: { id, disabled_at: null },
      data: { last_used_at: now, failed_attempts: 0, locked_until: null, updated_at: now },
    });
  },
  /** @returns {Promise<number>} consecutive failures after this one */
  async incrementMethodFailures(id, { now }) {
    const row = await prisma.user_mfa_methods.update({
      where: { id },
      data: { failed_attempts: { increment: 1 }, updated_at: now },
      select: { failed_attempts: true },
    });
    return row.failed_attempts;
  },
  async lockMethod(id, { lockedUntil, now }) {
    await prisma.user_mfa_methods.update({ where: { id }, data: { locked_until: lockedUntil, updated_at: now } });
  },
  /** @returns {Promise<number>} factors disabled */
  async disableMethods(userId, { reason, now }) {
    const res = await prisma.user_mfa_methods.updateMany({
      where: { user_id: userId, disabled_at: null },
      data: { disabled_at: now, disabled_reason: reason, updated_at: now },
    });
    return res.count;
  },

  /** Revoke every unused code, then store the new hashes — one transaction. */
  async replaceRecoveryCodes(userId, hashes, { now }) {
    return prisma.$transaction(async (tx) => {
      const revoked = await tx.user_mfa_recovery_codes.updateMany({
        where: { user_id: userId, used_at: null, revoked_at: null },
        data: { revoked_at: now },
      });
      await tx.user_mfa_recovery_codes.createMany({
        data: hashes.map((code_hash) => ({ user_id: userId, code_hash, created_at: now })),
      });
      return revoked.count;
    });
  },
  /** Single use: only one concurrent request can flip used_at. */
  async consumeRecoveryCode(userId, codeHash, { now }) {
    const res = await prisma.user_mfa_recovery_codes.updateMany({
      where: { user_id: userId, code_hash: codeHash, used_at: null, revoked_at: null },
      data: { used_at: now },
    });
    return res.count === 1;
  },
  async countRemainingRecoveryCodes(userId) {
    return prisma.user_mfa_recovery_codes.count({ where: { user_id: userId, used_at: null, revoked_at: null } });
  },
  async revokeRecoveryCodes(userId, { now }) {
    const res = await prisma.user_mfa_recovery_codes.updateMany({
      where: { user_id: userId, used_at: null, revoked_at: null },
      data: { revoked_at: now },
    });
    return res.count;
  },

  async createChallenge(data) {
    return prisma.auth_mfa_challenges.create({ data, select: CHALLENGE_SELECT });
  },
  async findChallengeByTokenHash(tokenHash) {
    return prisma.auth_mfa_challenges.findUnique({ where: { token_hash: tokenHash }, select: CHALLENGE_SELECT });
  },
  /** @returns {Promise<number|null>} attempts after increment, or null if no longer open */
  async incrementChallengeAttempts(id) {
    const res = await prisma.auth_mfa_challenges.updateMany({
      where: { id, status: { in: ['PENDING', 'VERIFIED'] } },
      data: { attempts: { increment: 1 } },
    });
    if (res.count !== 1) return null;
    const row = await prisma.auth_mfa_challenges.findUnique({ where: { id }, select: { attempts: true } });
    return row?.attempts ?? null;
  },
  /** Conditional status transition; false when another request got there first. */
  async transitionChallenge(id, fromStatuses, data) {
    const res = await prisma.auth_mfa_challenges.updateMany({
      where: { id, status: { in: fromStatuses } },
      data,
    });
    return res.count === 1;
  },
  async cancelOpenChallenges(userId, { now }) {
    const res = await prisma.auth_mfa_challenges.updateMany({
      where: { user_id: userId, status: { in: ['PENDING', 'VERIFIED'] } },
      data: { status: 'CANCELLED', completed_at: now },
    });
    return res.count;
  },

  async findUserBasics(userId) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, password_hash: true },
    });
  },
  /** Roles + active assignment roles for MFA policy decisions about another user. */
  async loadPolicySubject(userId) {
    const [links, assignments] = await Promise.all([
      prisma.user_roles.findMany({ where: { user_id: userId }, select: { role_id: true } }),
      prisma.user_organization_assignments.findMany({
        where: { user_id: userId, is_active: true },
        select: { role_code: true },
      }),
    ]);
    const roleRows = links.length
      ? await prisma.roles.findMany({ where: { id: { in: links.map((l) => l.role_id) } }, select: { code: true } })
      : [];
    const roles = normalizeRoleCodes(roleRows.map((r) => r.code));
    const superCode = String(env.SUPER_ADMIN_ROLE_CODE || 'super_admin').toLowerCase();
    return {
      roles,
      assignmentRoleCodes: assignments.map((a) => canonicalizeRoleCode(a.role_code)).filter(Boolean),
      isGlobal: roles.includes(superCode),
    };
  },
};

let store = dbStore;

function getMfaStore() {
  return store;
}

function setMfaStoreForTests(fake) {
  store = fake || dbStore;
}

function resetMfaStoreForTests() {
  store = dbStore;
}

module.exports = { getMfaStore, setMfaStoreForTests, resetMfaStoreForTests, defaultMfaStore: dbStore };

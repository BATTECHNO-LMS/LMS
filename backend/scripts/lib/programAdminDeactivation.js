'use strict';

/**
 * Phase 2 program_admin deprecation — deactivate active program_admin-only users.
 * Non-destructive: status only; user_roles and university links are never modified.
 */

const crypto = require('crypto');

const PROGRAM_ADMIN_CODE = 'program_admin';
const SUPER_ADMIN_CODE = 'super_admin';
const ACTIVE = 'active';
const INACTIVE = 'inactive';

const ACTION_DEACTIVATE = 'MAINTENANCE_PROGRAM_ADMIN_DEACTIVATE';
const ACTION_ROLLBACK = 'MAINTENANCE_PROGRAM_ADMIN_REACTIVATE';
const ENTITY_TYPE = 'user';
const MAINTENANCE_REASON =
  'Phase 2 program_admin deprecation: deactivate unused program_admin-only accounts';
const SCRIPT_SOURCE = 'deactivate-program-admin-only-users.js';

function maskId(id) {
  if (!id || typeof id !== 'string') return null;
  return `${id.slice(0, 8)}…`;
}

function uniqueUniversityCount(candidates) {
  return new Set(candidates.map((c) => c.universityId).filter(Boolean)).size;
}

function buildMaskedReport(partial) {
  return {
    mode: partial.mode,
    success: partial.success,
    batchId: partial.batchId ?? null,
    candidateCount: partial.candidateCount ?? 0,
    updatedCount: partial.updatedCount ?? 0,
    skippedCount: partial.skippedCount ?? 0,
    universityCount: partial.universityCount ?? 0,
    activeProgramAdminAnyCount: partial.activeProgramAdminAnyCount ?? 0,
    maskedUserIds: (partial.candidates || []).map((c) => maskId(c.userId)),
    message: partial.message ?? null,
    error: partial.error ?? null,
  };
}

/**
 * Load active users whose only role is program_admin.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function discoverProgramAdminOnlyCandidates(prisma) {
  const paRole = await prisma.roles.findUnique({
    where: { code: PROGRAM_ADMIN_CODE },
    select: { id: true, code: true },
  });
  if (!paRole) {
    return {
      candidates: [],
      activeProgramAdminAnyCount: 0,
      errors: ['program_admin role row not found'],
    };
  }

  const saRole = await prisma.roles.findUnique({
    where: { code: SUPER_ADMIN_CODE },
    select: { id: true },
  });

  const paLinks = await prisma.user_roles.findMany({
    where: { role_id: paRole.id },
    select: { user_id: true },
  });
  const paUserIds = [...new Set(paLinks.map((l) => l.user_id))];

  if (!paUserIds.length) {
    return { candidates: [], activeProgramAdminAnyCount: 0, errors: [] };
  }

  const users = await prisma.users.findMany({
    where: { id: { in: paUserIds } },
    select: {
      id: true,
      status: true,
      primary_university_id: true,
    },
  });

  const allLinks = await prisma.user_roles.findMany({
    where: { user_id: { in: paUserIds } },
    select: { user_id: true, role_id: true },
  });

  const roleIds = [...new Set(allLinks.map((l) => l.role_id))];
  const roleRows = roleIds.length
    ? await prisma.roles.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, code: true },
      })
    : [];
  const codeByRoleId = new Map(roleRows.map((r) => [r.id, r.code]));

  const rolesByUser = new Map();
  for (const link of allLinks) {
    const codes = rolesByUser.get(link.user_id) || [];
    codes.push(String(codeByRoleId.get(link.role_id) || '').toLowerCase());
    rolesByUser.set(link.user_id, codes);
  }

  let activeProgramAdminAnyCount = 0;
  const candidates = [];
  const errors = [];

  for (const user of users) {
    const codes = [...new Set(rolesByUser.get(user.id) || [])].filter(Boolean);
    const hasPa = codes.includes(PROGRAM_ADMIN_CODE);
    const hasSa = codes.includes(SUPER_ADMIN_CODE);
    if (user.status === ACTIVE && hasPa) {
      activeProgramAdminAnyCount += 1;
    }

    if (user.status !== ACTIVE) continue;
    if (!hasPa) continue;

    if (hasSa) {
      errors.push(`candidate ${maskId(user.id)} holds super_admin`);
      continue;
    }
    if (codes.length !== 1 || codes[0] !== PROGRAM_ADMIN_CODE) {
      errors.push(`candidate ${maskId(user.id)} is not program_admin-only`);
      continue;
    }
    if (!user.primary_university_id) {
      errors.push(`candidate ${maskId(user.id)} missing primary university`);
      continue;
    }

    candidates.push({
      userId: user.id,
      status: user.status,
      universityId: user.primary_university_id,
      roleCode: PROGRAM_ADMIN_CODE,
      roleCodes: codes,
    });
  }

  // Safety: any active PA holder that is not PA-only must abort the whole batch.
  if (activeProgramAdminAnyCount !== candidates.length) {
    errors.push(
      `active program_admin holders (${activeProgramAdminAnyCount}) exceed PA-only candidates (${candidates.length})`
    );
  }

  // Defensive: sa role id present but somehow linked — already covered via codes.
  void saRole;

  return { candidates, activeProgramAdminAnyCount, errors };
}

/**
 * Validate discovered set against expected count and hard rules.
 */
function assertCandidateSetValid(discovery, expectedCount) {
  if (discovery.errors?.length) {
    const err = new Error(discovery.errors.join('; '));
    err.code = 'CANDIDATE_VALIDATION_FAILED';
    throw err;
  }
  const count = discovery.candidates.length;
  if (count !== expectedCount) {
    const err = new Error(
      `Candidate count mismatch: found ${count}, expected ${expectedCount}`
    );
    err.code = 'CANDIDATE_COUNT_MISMATCH';
    throw err;
  }
  for (const c of discovery.candidates) {
    if (c.status !== ACTIVE) {
      const err = new Error(`Candidate ${maskId(c.userId)} is not active`);
      err.code = 'CANDIDATE_VALIDATION_FAILED';
      throw err;
    }
    if (c.roleCode !== PROGRAM_ADMIN_CODE || c.roleCodes.length !== 1) {
      const err = new Error(`Candidate ${maskId(c.userId)} role set invalid`);
      err.code = 'CANDIDATE_VALIDATION_FAILED';
      throw err;
    }
    if (!c.universityId) {
      const err = new Error(`Candidate ${maskId(c.userId)} missing university`);
      err.code = 'CANDIDATE_VALIDATION_FAILED';
      throw err;
    }
  }
}

/**
 * @param {{
 *   prisma: import('@prisma/client').PrismaClient,
 *   apply?: boolean,
 *   expectedCount: number,
 *   batchId?: string,
 *   now?: Date,
 * }} opts
 */
async function runProgramAdminDeactivation(opts) {
  const {
    prisma,
    apply = false,
    expectedCount,
    batchId = crypto.randomUUID(),
    now = new Date(),
  } = opts;

  if (typeof expectedCount !== 'number' || !Number.isInteger(expectedCount) || expectedCount < 0) {
    throw new Error('EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT must be a non-negative integer');
  }

  const discovery = await discoverProgramAdminOnlyCandidates(prisma);

  // Idempotent apply: zero candidates → no writes, success.
  if (discovery.candidates.length === 0 && !discovery.errors?.length) {
    return buildMaskedReport({
      mode: apply ? 'apply' : 'dry-run',
      success: true,
      batchId: null,
      candidateCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      universityCount: 0,
      activeProgramAdminAnyCount: discovery.activeProgramAdminAnyCount,
      candidates: [],
      message: apply
        ? 'No active program_admin-only candidates; nothing to update (idempotent)'
        : 'Dry-run: zero active program_admin-only candidates',
    });
  }

  try {
    assertCandidateSetValid(discovery, expectedCount);
  } catch (err) {
    return buildMaskedReport({
      mode: apply ? 'apply' : 'dry-run',
      success: false,
      batchId: null,
      candidateCount: discovery.candidates.length,
      updatedCount: 0,
      skippedCount: 0,
      universityCount: uniqueUniversityCount(discovery.candidates),
      activeProgramAdminAnyCount: discovery.activeProgramAdminAnyCount,
      candidates: discovery.candidates,
      error: err.message,
      message: 'Aborted before writes',
    });
  }

  if (!apply) {
    return buildMaskedReport({
      mode: 'dry-run',
      success: true,
      batchId: null,
      candidateCount: discovery.candidates.length,
      updatedCount: 0,
      skippedCount: 0,
      universityCount: uniqueUniversityCount(discovery.candidates),
      activeProgramAdminAnyCount: discovery.activeProgramAdminAnyCount,
      candidates: discovery.candidates,
      message: 'Dry-run only; no writes performed',
    });
  }

  const candidates = discovery.candidates;

  try {
    await prisma.$transaction(async (tx) => {
      // Recheck inside transaction
      const recheck = await discoverProgramAdminOnlyCandidates(tx);
      assertCandidateSetValid(recheck, expectedCount);
      const idSet = new Set(recheck.candidates.map((c) => c.userId));
      for (const c of candidates) {
        if (!idSet.has(c.userId)) {
          throw new Error('Candidate set changed during transaction');
        }
      }

      for (const c of recheck.candidates) {
        await tx.audit_logs.create({
          data: {
            user_id: null,
            university_id: c.universityId,
            action_type: ACTION_DEACTIVATE,
            entity_type: ENTITY_TYPE,
            entity_id: c.userId,
            old_values: {
              status: c.status,
              role_code: c.roleCode,
              batch_id: batchId,
              university_id: c.universityId,
            },
            new_values: {
              status: INACTIVE,
              batch_id: batchId,
              reason: MAINTENANCE_REASON,
              source: SCRIPT_SOURCE,
              action: 'deactivate',
            },
            ip_address: null,
          },
        });

        const updated = await tx.users.updateMany({
          where: {
            id: c.userId,
            status: ACTIVE,
          },
          data: {
            status: INACTIVE,
            updated_at: now,
          },
        });
        if (updated.count !== 1) {
          throw new Error(`Failed to deactivate ${maskId(c.userId)}`);
        }
      }
    });
  } catch (err) {
    return buildMaskedReport({
      mode: 'apply',
      success: false,
      batchId,
      candidateCount: candidates.length,
      updatedCount: 0,
      skippedCount: 0,
      universityCount: uniqueUniversityCount(candidates),
      activeProgramAdminAnyCount: discovery.activeProgramAdminAnyCount,
      candidates,
      error: err.message,
      message: 'Transaction rolled back',
    });
  }

  return buildMaskedReport({
    mode: 'apply',
    success: true,
    batchId,
    candidateCount: candidates.length,
    updatedCount: candidates.length,
    skippedCount: 0,
    universityCount: uniqueUniversityCount(candidates),
    activeProgramAdminAnyCount: 0,
    candidates,
    message: 'Deactivation applied; user_roles and university links unchanged',
  });
}

/**
 * Load deactivate audit rows for a batch.
 */
async function loadDeactivateAuditRows(prisma, batchId) {
  const rows = await prisma.audit_logs.findMany({
    where: { action_type: ACTION_DEACTIVATE, entity_type: ENTITY_TYPE },
    select: {
      id: true,
      entity_id: true,
      university_id: true,
      old_values: true,
      new_values: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
  });
  return rows.filter((r) => {
    const nv = r.new_values && typeof r.new_values === 'object' ? r.new_values : {};
    const ov = r.old_values && typeof r.old_values === 'object' ? r.old_values : {};
    return nv.batch_id === batchId || ov.batch_id === batchId;
  });
}

/**
 * @param {{
 *   prisma: import('@prisma/client').PrismaClient,
 *   apply?: boolean,
 *   batchId: string,
 *   now?: Date,
 * }} opts
 */
async function runProgramAdminDeactivationRollback(opts) {
  const { prisma, apply = false, batchId, now = new Date() } = opts;
  if (!batchId || typeof batchId !== 'string') {
    throw new Error('Rollback requires PROGRAM_ADMIN_DEACTIVATION_BATCH_ID');
  }

  const auditRows = await loadDeactivateAuditRows(prisma, batchId);
  if (!auditRows.length) {
    return buildMaskedReport({
      mode: apply ? 'rollback-apply' : 'rollback-dry-run',
      success: false,
      batchId,
      candidateCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      universityCount: 0,
      candidates: [],
      error: 'No deactivate audit rows found for batch',
      message: 'Aborted',
    });
  }

  const eligible = [];
  const skipped = [];

  for (const row of auditRows) {
    const userId = row.entity_id;
    if (!userId) {
      skipped.push({ reason: 'missing entity_id' });
      continue;
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true, primary_university_id: true },
    });
    if (!user) {
      skipped.push({ reason: 'user missing', maskedUserId: maskId(userId) });
      continue;
    }

    const links = await prisma.user_roles.findMany({
      where: { user_id: userId },
      select: { role_id: true },
    });
    const roleIds = links.map((l) => l.role_id);
    const roles = roleIds.length
      ? await prisma.roles.findMany({
          where: { id: { in: roleIds } },
          select: { code: true },
        })
      : [];
    const codes = roles.map((r) => String(r.code).toLowerCase());
    if (!codes.includes(PROGRAM_ADMIN_CODE)) {
      skipped.push({
        reason: 'program_admin relationship missing',
        maskedUserId: maskId(userId),
      });
      continue;
    }

    // Later admin status change superseded this maintenance action.
    if (user.status !== INACTIVE) {
      skipped.push({
        reason: 'status no longer inactive (superseded)',
        maskedUserId: maskId(userId),
      });
      continue;
    }

    const ov = row.old_values && typeof row.old_values === 'object' ? row.old_values : {};
    if (ov.status && ov.status !== ACTIVE) {
      skipped.push({
        reason: 'audit previous status was not active',
        maskedUserId: maskId(userId),
      });
      continue;
    }

    eligible.push({
      userId,
      universityId: user.primary_university_id,
      roleCode: PROGRAM_ADMIN_CODE,
      auditId: row.id,
    });
  }

  if (!apply) {
    return buildMaskedReport({
      mode: 'rollback-dry-run',
      success: true,
      batchId,
      candidateCount: eligible.length,
      updatedCount: 0,
      skippedCount: skipped.length,
      universityCount: uniqueUniversityCount(eligible),
      candidates: eligible,
      message: 'Rollback dry-run; no writes performed',
    });
  }

  if (!eligible.length) {
    return buildMaskedReport({
      mode: 'rollback-apply',
      success: true,
      batchId,
      candidateCount: 0,
      updatedCount: 0,
      skippedCount: skipped.length,
      universityCount: 0,
      candidates: [],
      message: 'Nothing eligible to reactivate',
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const c of eligible) {
        const current = await tx.users.findUnique({
          where: { id: c.userId },
          select: { status: true, primary_university_id: true },
        });
        if (!current || current.status !== INACTIVE) {
          throw new Error(`Rollback recheck failed for ${maskId(c.userId)}`);
        }

        const links = await tx.user_roles.findMany({
          where: { user_id: c.userId },
          select: { role_id: true },
        });
        const roleIds = links.map((l) => l.role_id);
        const roles = roleIds.length
          ? await tx.roles.findMany({
              where: { id: { in: roleIds } },
              select: { code: true },
            })
          : [];
        if (!roles.some((r) => String(r.code).toLowerCase() === PROGRAM_ADMIN_CODE)) {
          throw new Error(`Rollback: program_admin missing for ${maskId(c.userId)}`);
        }

        await tx.audit_logs.create({
          data: {
            user_id: null,
            university_id: current.primary_university_id,
            action_type: ACTION_ROLLBACK,
            entity_type: ENTITY_TYPE,
            entity_id: c.userId,
            old_values: {
              status: INACTIVE,
              batch_id: batchId,
              role_code: PROGRAM_ADMIN_CODE,
            },
            new_values: {
              status: ACTIVE,
              batch_id: batchId,
              reason: 'Rollback of Phase 2 program_admin deactivation',
              source: SCRIPT_SOURCE,
              action: 'rollback_reactivate',
              original_deactivate_audit_id: c.auditId,
            },
            ip_address: null,
          },
        });

        const updated = await tx.users.updateMany({
          where: { id: c.userId, status: INACTIVE },
          data: { status: ACTIVE, updated_at: now },
        });
        if (updated.count !== 1) {
          throw new Error(`Rollback update failed for ${maskId(c.userId)}`);
        }
      }
    });
  } catch (err) {
    return buildMaskedReport({
      mode: 'rollback-apply',
      success: false,
      batchId,
      candidateCount: eligible.length,
      updatedCount: 0,
      skippedCount: skipped.length,
      universityCount: uniqueUniversityCount(eligible),
      candidates: eligible,
      error: err.message,
      message: 'Rollback transaction rolled back',
    });
  }

  return buildMaskedReport({
    mode: 'rollback-apply',
    success: true,
    batchId,
    candidateCount: eligible.length,
    updatedCount: eligible.length,
    skippedCount: skipped.length,
    universityCount: uniqueUniversityCount(eligible),
    candidates: eligible,
    message: 'Rollback applied; audit history retained; roles/universities unchanged',
  });
}

function parseExpectedCount(envValue) {
  const n = Number(envValue);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT must be a non-negative integer');
  }
  return n;
}

function isTruthyEnv(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

module.exports = {
  PROGRAM_ADMIN_CODE,
  SUPER_ADMIN_CODE,
  ACTIVE,
  INACTIVE,
  ACTION_DEACTIVATE,
  ACTION_ROLLBACK,
  MAINTENANCE_REASON,
  SCRIPT_SOURCE,
  maskId,
  discoverProgramAdminOnlyCandidates,
  assertCandidateSetValid,
  runProgramAdminDeactivation,
  runProgramAdminDeactivationRollback,
  loadDeactivateAuditRows,
  parseExpectedCount,
  isTruthyEnv,
  buildMaskedReport,
};

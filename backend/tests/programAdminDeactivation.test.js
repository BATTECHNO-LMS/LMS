'use strict';

/**
 * Phase 2 program_admin deactivation — database-free unit tests (mocked Prisma).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  runProgramAdminDeactivation,
  runProgramAdminDeactivationRollback,
  discoverProgramAdminOnlyCandidates,
  assertCandidateSetValid,
  ACTION_DEACTIVATE,
  ACTION_ROLLBACK,
  parseExpectedCount,
  isTruthyEnv,
  maskId,
  PROGRAM_ADMIN_CODE,
} = require('../scripts/lib/programAdminDeactivation');

const PA_ROLE_ID = 'role-pa';
const SA_ROLE_ID = 'role-sa';
const STUDENT_ROLE_ID = 'role-student';
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNI_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UNI_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BATCH = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function makePrismaMock(state) {
  const auditCreates = [];
  const userUpdates = [];
  let failOnUserId = state.failOnUserId || null;

  const api = {
    roles: {
      findUnique: async ({ where }) => {
        if (where.code === 'program_admin') return { id: PA_ROLE_ID, code: 'program_admin' };
        if (where.code === 'super_admin') return { id: SA_ROLE_ID, code: 'super_admin' };
        return null;
      },
      findMany: async ({ where }) => {
        const ids = where.id?.in || [];
        const all = [
          { id: PA_ROLE_ID, code: 'program_admin' },
          { id: SA_ROLE_ID, code: 'super_admin' },
          { id: STUDENT_ROLE_ID, code: 'student' },
        ];
        return all.filter((r) => ids.includes(r.id));
      },
    },
    user_roles: {
      findMany: async ({ where }) => {
        if (where.role_id === PA_ROLE_ID) {
          return state.paLinks.map((user_id) => ({ user_id }));
        }
        if (where.user_id?.in) {
          return state.allLinks.filter((l) => where.user_id.in.includes(l.user_id));
        }
        if (where.user_id) {
          return state.allLinks.filter((l) => l.user_id === where.user_id);
        }
        return [];
      },
      deleteMany: async () => {
        throw new Error('user_roles must not be deleted');
      },
      create: async () => {
        throw new Error('user_roles must not be created');
      },
    },
    users: {
      findMany: async ({ where }) => {
        const ids = where.id?.in || [];
        return state.users.filter((u) => ids.includes(u.id));
      },
      findUnique: async ({ where }) => state.users.find((u) => u.id === where.id) || null,
      updateMany: async ({ where, data }) => {
        if (failOnUserId && where.id === failOnUserId) {
          throw new Error('simulated update failure');
        }
        const user = state.users.find((u) => u.id === where.id && u.status === where.status);
        if (!user) return { count: 0 };
        userUpdates.push({ id: where.id, data: { ...data } });
        user.status = data.status;
        user.updated_at = data.updated_at;
        return { count: 1 };
      },
    },
    audit_logs: {
      create: async ({ data }) => {
        auditCreates.push(data);
        return { id: `audit-${auditCreates.length}`, ...data };
      },
      findMany: async ({ where }) => {
        if (where.action_type !== ACTION_DEACTIVATE) return [];
        return (state.auditRows || []).filter((r) => r.action_type === ACTION_DEACTIVATE);
      },
    },
    $transaction: async (fn) => fn(api),
    _auditCreates: auditCreates,
    _userUpdates: userUpdates,
  };
  return api;
}

function twoValidCandidatesState() {
  return {
    paLinks: [U1, U2],
    allLinks: [
      { user_id: U1, role_id: PA_ROLE_ID },
      { user_id: U2, role_id: PA_ROLE_ID },
    ],
    users: [
      { id: U1, status: 'active', primary_university_id: UNI_A },
      { id: U2, status: 'active', primary_university_id: UNI_B },
    ],
  };
}

describe('program_admin Phase 2 deactivation', () => {
  it('dry run performs no writes', async () => {
    const prisma = makePrismaMock(twoValidCandidatesState());
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: false,
      expectedCount: 2,
    });
    assert.equal(report.success, true);
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.candidateCount, 2);
    assert.equal(report.updatedCount, 0);
    assert.equal(prisma._auditCreates.length, 0);
    assert.equal(prisma._userUpdates.length, 0);
  });

  it('apply mode requires explicit flag at CLI (library apply=false default)', async () => {
    const prisma = makePrismaMock(twoValidCandidatesState());
    const report = await runProgramAdminDeactivation({
      prisma,
      expectedCount: 2,
    });
    assert.equal(report.mode, 'dry-run');
    assert.equal(prisma._userUpdates.length, 0);
    assert.equal(isTruthyEnv(undefined), false);
    assert.equal(isTruthyEnv('true'), true);
  });

  it('candidate-count mismatch stops all writes', async () => {
    const prisma = makePrismaMock(twoValidCandidatesState());
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 1,
    });
    assert.equal(report.success, false);
    assert.match(report.error, /Candidate count mismatch/);
    assert.equal(prisma._userUpdates.length, 0);
    assert.equal(prisma._auditCreates.length, 0);
  });

  it('candidate with another role stops the operation', async () => {
    const state = twoValidCandidatesState();
    state.allLinks.push({ user_id: U1, role_id: STUDENT_ROLE_ID });
    const prisma = makePrismaMock(state);
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
    });
    assert.equal(report.success, false);
    assert.ok(report.error);
    assert.equal(prisma._userUpdates.length, 0);
  });

  it('candidate with super_admin stops the operation', async () => {
    const state = twoValidCandidatesState();
    state.allLinks = [
      { user_id: U1, role_id: PA_ROLE_ID },
      { user_id: U1, role_id: SA_ROLE_ID },
      { user_id: U2, role_id: PA_ROLE_ID },
    ];
    const prisma = makePrismaMock(state);
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
    });
    assert.equal(report.success, false);
    assert.equal(prisma._userUpdates.length, 0);
  });

  it('candidate without program_admin is not selected', async () => {
    const state = {
      paLinks: [],
      allLinks: [{ user_id: U1, role_id: STUDENT_ROLE_ID }],
      users: [{ id: U1, status: 'active', primary_university_id: UNI_A }],
    };
    const discovery = await discoverProgramAdminOnlyCandidates(makePrismaMock(state));
    assert.equal(discovery.candidates.length, 0);
  });

  it('already inactive user is not modified', async () => {
    const state = twoValidCandidatesState();
    state.users[0].status = 'inactive';
    const prisma = makePrismaMock(state);
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
    });
    assert.equal(report.success, false);
    assert.match(report.error, /mismatch|exceed/i);
    assert.equal(prisma._userUpdates.length, 0);
  });

  it('all valid candidates are handled in one transaction with audit before status change', async () => {
    const prisma = makePrismaMock(twoValidCandidatesState());
    const order = [];
    const origCreate = prisma.audit_logs.create;
    const origUpdate = prisma.users.updateMany;
    prisma.audit_logs.create = async (args) => {
      order.push('audit');
      return origCreate(args);
    };
    prisma.users.updateMany = async (args) => {
      order.push('update');
      return origUpdate(args);
    };

    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
      batchId: BATCH,
    });
    assert.equal(report.success, true);
    assert.equal(report.updatedCount, 2);
    assert.equal(report.batchId, BATCH);
    assert.equal(prisma._auditCreates.length, 2);
    assert.equal(prisma._userUpdates.length, 2);
    assert.deepEqual(order, ['audit', 'update', 'audit', 'update']);
    for (const a of prisma._auditCreates) {
      assert.equal(a.action_type, ACTION_DEACTIVATE);
      assert.equal(a.new_values.batch_id, BATCH);
      assert.equal(a.old_values.role_code, PROGRAM_ADMIN_CODE);
      assert.equal(a.new_values.status, 'inactive');
    }
    for (const u of prisma._userUpdates) {
      assert.equal(u.data.status, 'inactive');
      assert.equal(Object.keys(u.data).includes('primary_university_id'), false);
      assert.equal(Object.keys(u.data).includes('password_hash'), false);
    }
  });

  it('failure during one update rolls back all changes', async () => {
    const state = twoValidCandidatesState();
    state.failOnUserId = U2;
    const prisma = makePrismaMock(state);
    // Simulate transaction rollback by wrapping: our mock $transaction just calls fn;
    // emulate rollback by restoring state when error thrown.
    const usersSnapshot = JSON.stringify(state.users);
    prisma.$transaction = async (fn) => {
      try {
        return await fn(prisma);
      } catch (e) {
        state.users = JSON.parse(usersSnapshot);
        prisma._auditCreates.length = 0;
        prisma._userUpdates.length = 0;
        throw e;
      }
    };

    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
      batchId: BATCH,
    });
    assert.equal(report.success, false);
    assert.match(report.message, /rolled back/i);
    assert.equal(state.users[0].status, 'active');
    assert.equal(state.users[1].status, 'active');
    assert.equal(prisma._userUpdates.length, 0);
    assert.equal(prisma._auditCreates.length, 0);
  });

  it('no personal data appears in report output', async () => {
    const prisma = makePrismaMock(twoValidCandidatesState());
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: false,
      expectedCount: 2,
    });
    const text = JSON.stringify(report);
    assert.equal(text.includes('@'), false);
    assert.equal(text.includes('password'), false);
    assert.equal(text.includes(U1), false);
    assert.ok(report.maskedUserIds.every((m) => m.endsWith('…')));
  });

  it('repeated apply is idempotent when candidates already inactive', async () => {
    const prisma = makePrismaMock({
      paLinks: [U1, U2],
      allLinks: [
        { user_id: U1, role_id: PA_ROLE_ID },
        { user_id: U2, role_id: PA_ROLE_ID },
      ],
      users: [
        { id: U1, status: 'inactive', primary_university_id: UNI_A },
        { id: U2, status: 'inactive', primary_university_id: UNI_B },
      ],
    });
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
    });
    assert.equal(report.success, true);
    assert.equal(report.candidateCount, 0);
    assert.equal(report.updatedCount, 0);
    assert.equal(prisma._userUpdates.length, 0);
  });

  it('maskId shortens identifiers', () => {
    assert.equal(maskId(U1), 'aaaaaaaa…');
  });

  it('parseExpectedCount validates integers', () => {
    assert.equal(parseExpectedCount('2'), 2);
    assert.throws(() => parseExpectedCount('x'));
  });

  it('assertCandidateSetValid enforces expected count', () => {
    assert.throws(() =>
      assertCandidateSetValid({ candidates: [], errors: [], activeProgramAdminAnyCount: 0 }, 2)
    );
  });

  it('rollback requires exact batch ID and does not remove audit history', async () => {
    const state = {
      paLinks: [U1],
      allLinks: [{ user_id: U1, role_id: PA_ROLE_ID }],
      users: [{ id: U1, status: 'inactive', primary_university_id: UNI_A }],
      auditRows: [
        {
          id: 'aud-1',
          action_type: ACTION_DEACTIVATE,
          entity_id: U1,
          university_id: UNI_A,
          old_values: { status: 'active', batch_id: BATCH, role_code: 'program_admin' },
          new_values: { status: 'inactive', batch_id: BATCH },
          created_at: new Date(),
        },
      ],
    };
    const prisma = makePrismaMock(state);
    const missing = await runProgramAdminDeactivationRollback({
      prisma,
      apply: true,
      batchId: 'wrong-batch',
    });
    assert.equal(missing.success, false);

    const report = await runProgramAdminDeactivationRollback({
      prisma,
      apply: true,
      batchId: BATCH,
    });
    assert.equal(report.success, true);
    assert.equal(report.updatedCount, 1);
    assert.equal(state.users[0].status, 'active');
    assert.ok(prisma._auditCreates.some((a) => a.action_type === ACTION_ROLLBACK));
    assert.equal(state.auditRows.length, 1);
  });

  it('unrelated active users are untouched', async () => {
    const other = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const state = twoValidCandidatesState();
    state.users.push({ id: other, status: 'active', primary_university_id: UNI_A });
    const prisma = makePrismaMock(state);
    const report = await runProgramAdminDeactivation({
      prisma,
      apply: true,
      expectedCount: 2,
      batchId: BATCH,
    });
    assert.equal(report.success, true);
    assert.equal(state.users.find((u) => u.id === other).status, 'active');
    assert.equal(prisma._userUpdates.every((u) => u.id !== other), true);
  });

  it('script is not registered as an npm seed command', () => {
    const pkg = require('../package.json');
    const seedScripts = Object.entries(pkg.scripts || {})
      .filter(([k]) => k.startsWith('seed'))
      .map(([, v]) => v)
      .join('\n');
    assert.equal(seedScripts.includes('deactivate-program-admin'), false);
  });
});

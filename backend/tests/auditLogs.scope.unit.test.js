'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/config/db');
const svc = require('../src/modules/audit-logs/auditLogs.service');
const { clearAuditTenantCacheForTests } = require('../src/shared/services/audit.service');

const UNI_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNI_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ORG_X = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const STUDENT_A = '11111111-1111-4111-8111-111111111111';
const STUDENT_B = '22222222-2222-4222-8222-222222222222';

const superAdmin = { userId: 'x', roles: ['super_admin'], isGlobal: true };
const uniAdminA = { userId: 'y', roles: ['admin'], universityId: UNI_A, scope: { type: 'university', universityId: UNI_A, organizationId: ORG_A } };
const orgAdminX = { userId: 'z', roles: ['admin'], scope: { type: 'organization', organizationId: ORG_X } };

describe('activity log authorization scope', () => {
  it('super admin is global; university/org admins are tenant-scoped', () => {
    assert.deepEqual(svc.resolveAuditScope(superAdmin), { type: 'global' });
    assert.deepEqual(svc.resolveAuditScope(uniAdminA), { type: 'university', universityId: UNI_A, organizationId: ORG_A });
    assert.deepEqual(svc.resolveAuditScope(orgAdminX), { type: 'organization', organizationId: ORG_X });
  });

  it('missing scope never means global (students, instructors, unscoped admins)', () => {
    assert.equal(svc.resolveAuditScope(null), null);
    assert.equal(svc.resolveAuditScope({ userId: 's', roles: ['student'], universityId: UNI_A }), null);
    assert.equal(svc.resolveAuditScope({ userId: 'i', roles: ['instructor'], universityId: UNI_A }), null);
    assert.equal(svc.resolveAuditScope({ userId: 'a', roles: ['admin'], universityId: null, scope: {} }), null);
    assert.deepEqual(svc.scopeWhere(null), { id: { in: [] } });
  });

  it('cross-university isolation on single rows', () => {
    const scope = svc.resolveAuditScope(uniAdminA);
    assert.equal(svc.rowInScope({ university_id: UNI_A }, scope), true);
    assert.equal(svc.rowInScope({ university_id: UNI_B }, scope), false);
    assert.equal(svc.rowInScope({ university_id: null, organization_id: ORG_A }, scope), true);
    assert.equal(svc.rowInScope({ university_id: null, organization_id: null }, scope), false);
    const orgScope = svc.resolveAuditScope(orgAdminX);
    assert.equal(svc.rowInScope({ organization_id: ORG_X }, orgScope), true);
    assert.equal(svc.rowInScope({ university_id: UNI_A, organization_id: ORG_A }, orgScope), false);
  });

  it('list filter always includes the tenant restriction for scoped admins', async () => {
    const where = await svc.buildListWhere({ university_id: UNI_B }, uniAdminA);
    assert.deepEqual(where.AND[0], { OR: [{ university_id: UNI_A }, { university_id: null, organization_id: ORG_A }] });
    assert.deepEqual(where.AND[1], { university_id: UNI_B });
    const denied = await svc.buildListWhere({}, { userId: 's', roles: ['student'] });
    assert.deepEqual(denied, { id: { in: [] } });
  });

  it('detail and timeline reject out-of-scope access', async () => {
    const origFind = prisma.audit_logs.findUnique;
    const origUser = prisma.users.findUnique;
    const origAssign = prisma.user_organization_assignments.findFirst;
    const origUni = prisma.universities.findUnique;
    try {
      prisma.audit_logs.findUnique = async () => ({ id: 'r', university_id: UNI_B, action_type: 'USER_LOGIN_SUCCESS' });
      await assert.rejects(() => svc.getAuditLogById('r', uniAdminA), (e) => e.statusCode === 403);
      await assert.rejects(() => svc.getAuditLogById('r', { roles: ['student'] }), (e) => e.statusCode === 403);

      clearAuditTenantCacheForTests();
      prisma.users.findUnique = async ({ where }) =>
        where.id === STUDENT_B ? { id: STUDENT_B, primary_university_id: UNI_B } : null;
      prisma.user_organization_assignments.findFirst = async () => null;
      prisma.universities.findUnique = async () => ({ organization_id: null });
      await assert.rejects(
        () => svc.getStudentTimeline(STUDENT_B, { skip: 0, take: 25, page: 1, page_size: 25 }, uniAdminA),
        (e) => e.statusCode === 403
      );
      await assert.rejects(
        () => svc.listUserSessions(STUDENT_B, uniAdminA),
        (e) => e.statusCode === 403
      );
    } finally {
      prisma.audit_logs.findUnique = origFind;
      prisma.users.findUnique = origUser;
      prisma.user_organization_assignments.findFirst = origAssign;
      prisma.universities.findUnique = origUni;
      clearAuditTenantCacheForTests();
    }
  });

  it('technical metadata (IP, user agent, request/session ids) only for global scope; secrets redacted', async () => {
    const origFind = prisma.audit_logs.findUnique;
    const origUsers = prisma.users.findMany;
    const origUnis = prisma.universities.findMany;
    try {
      prisma.users.findMany = async () => [];
      prisma.universities.findMany = async () => [];
      prisma.audit_logs.findUnique = async () => ({
        id: 'r',
        user_id: STUDENT_A,
        university_id: UNI_A,
        action_type: 'USER_LOGIN_FAILED',
        entity_type: 'user',
        ip_address: '10.0.0.1',
        user_agent: 'UA',
        request_id: 'req-1',
        session_id: null,
        new_values: { reason: 'INVALID_PASSWORD', password: 'should-not-show', nested: { token: 'x' } },
        created_at: new Date(),
      });
      const asSuper = (await svc.getAuditLogById('r', superAdmin)).audit_log;
      assert.equal(asSuper.ip_address, '10.0.0.1');
      assert.equal(asSuper.request_id, 'req-1');
      assert.notEqual(asSuper.new_values.password, 'should-not-show');
      assert.notEqual(asSuper.new_values.nested.token, 'x');
      const asUniAdmin = (await svc.getAuditLogById('r', uniAdminA)).audit_log;
      assert.equal('ip_address' in asUniAdmin, false);
      assert.equal('user_agent' in asUniAdmin, false);
      assert.equal('request_id' in asUniAdmin, false);
      assert.equal('session_id' in asUniAdmin, false);
      assert.match(asUniAdmin.action_label, /[\u0600-\u06FF]/);
      assert.equal(asUniAdmin.category, 'AUTH');
    } finally {
      prisma.audit_logs.findUnique = origFind;
      prisma.users.findMany = origUsers;
      prisma.universities.findMany = origUnis;
    }
  });
});

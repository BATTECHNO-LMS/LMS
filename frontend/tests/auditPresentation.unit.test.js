import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_PAGE_SIZES,
  actionLabel,
  actorLabel,
  buildAuditQueryParams,
  countActiveFilters,
  describeValueChanges,
  outcomeVariant,
  severityVariant,
  sessionStatusLabel,
  subjectLabel,
} from '../src/features/auditLogs/auditPresentation.js';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('activity log presentation', () => {
  test('page sizes are 25 and 50 only', () => {
    assert.deepEqual([...AUDIT_PAGE_SIZES], [25, 50]);
    assert.equal(buildAuditQueryParams({}, { page: 1, pageSize: 1000 }).page_size, 25);
    assert.equal(buildAuditQueryParams({}, { page: 3, pageSize: 50 }).page_size, 50);
  });

  test('security filters map to the backend contract', () => {
    const params = buildAuditQueryParams(
      { securityCategory: 'RATE_LIMIT', severity: 'HIGH', securityOnly: true, ipAddress: ' 203.0.113.10 ', requestId: '' },
      { page: 1, pageSize: 25 }
    );
    assert.deepEqual(params, {
      page: 1,
      page_size: 25,
      security_category: 'RATE_LIMIT',
      severity: 'HIGH',
      security_only: 'true',
      ip_address: '203.0.113.10',
    });
  });

  test('blocked outcome and severities have badge variants', () => {
    assert.equal(outcomeVariant('BLOCKED'), 'danger');
    assert.equal(severityVariant('HIGH'), 'danger');
    assert.equal(severityVariant('WARNING'), 'warning');
    assert.equal(severityVariant('nonsense'), 'default');
  });

  test('query params drop empty values and invalid ids', () => {
    const params = buildAuditQueryParams(
      { category: 'AUTH', outcome: '', entityId: 'not-a-uuid', sessionId: UUID, search: '  ali ' },
      { page: 2, pageSize: 25 }
    );
    assert.deepEqual(params, { page: 2, page_size: 25, category: 'AUTH', session_id: UUID, search: 'ali' });
    assert.equal(countActiveFilters({ category: 'AUTH', outcome: '', search: ' ' }), 1);
  });

  test('Arabic action label preferred; raw code only when allowed', () => {
    assert.equal(actionLabel({ action_type: 'USER_LOGOUT', action_label: 'تسجيل الخروج' }), 'تسجيل الخروج');
    assert.equal(actionLabel({ action_type: 'SOMETHING_NEW', action_label: null }), 'نشاط على المنصة');
    assert.equal(actionLabel({ action_type: 'SOMETHING_NEW', action_label: null }, { showRaw: true }), 'SOMETHING_NEW');
  });

  test('actor vs subject', () => {
    const row = {
      user_id: 'a',
      subject_user_id: 'b',
      actor_role: 'instructor',
      user: { full_name: 'مشرف' },
      subject: { full_name: 'طالب' },
    };
    assert.equal(actorLabel(row), 'مشرف · مشرف / مدرّب');
    assert.equal(subjectLabel(row), 'طالب');
    assert.equal(subjectLabel({ ...row, subject_user_id: 'a' }), '');
    assert.equal(actorLabel({ user_id: null }), 'النظام');
  });

  test('value changes are whitelisted and hide ids', () => {
    const rows = describeValueChanges(
      { status: 'submitted', score: 60, student_id: UUID, password: 'x' },
      { status: 'graded', score: 85, opportunityId: UUID, token: 'secret' }
    );
    assert.deepEqual(
      rows.map((r) => [r.key, r.before, r.after]),
      [
        ['status', 'submitted', 'graded'],
        ['score', '60', '85'],
      ]
    );
  });

  test('outcome variants and session labels', () => {
    assert.equal(outcomeVariant('SUCCESS'), 'success');
    assert.equal(outcomeVariant('FAILED'), 'danger');
    assert.equal(outcomeVariant('DENIED'), 'warning');
    assert.equal(sessionStatusLabel({ is_active: true }), 'نشطة');
    assert.equal(sessionStatusLabel({ is_active: false, end_reason: 'IDLE_TIMEOUT' }), 'انتهت لعدم النشاط');
    assert.equal(sessionStatusLabel({ is_active: false, end_reason: 'ADMIN_REVOKED' }), 'إنهاء من الإدارة');
    assert.equal(sessionStatusLabel({ is_active: false, end_reason: 'PASSWORD_RESET' }), 'إنهاء بعد إعادة تعيين كلمة المرور');
    assert.equal(sessionStatusLabel({ is_active: false, end_reason: 'SECURITY_REVOKED' }), 'إنهاء أمني');
  });

  test('end reason detail is shown in Arabic, never as a raw code', () => {
    const rows = describeValueChanges({}, { endReason: 'PASSWORD_RESET' });
    assert.deepEqual(rows.map((r) => [r.key, r.after]), [['endReason', 'إنهاء بعد إعادة تعيين كلمة المرور']]);
  });
});

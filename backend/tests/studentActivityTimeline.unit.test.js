'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  presentRow,
  summarizeDetails,
  tenantWhere,
  buildTimelineWhere,
  EXCLUDED_ACTIONS,
} = require('../src/shared/audit/studentActivityTimeline.service');

const STUDENT = '11111111-1111-4111-8111-111111111111';
const STAFF = '22222222-2222-4222-8222-222222222222';
const UUID_ANY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('student activity timeline', () => {
  it('presents staff actions on the student with actor, outcome and readable details', () => {
    const ev = presentRow(
      {
        id: 'row-1',
        user_id: STAFF,
        subject_user_id: STUDENT,
        action_type: 'TRAINING_TASK_GRADED',
        category: null,
        outcome: null,
        actor_role: 'instructor',
        old_values: { status: 'submitted' },
        new_values: { originalScore: 60, newScore: 85, taskTitle: 'تقرير الأسبوع الأول', applicationId: STUDENT },
        created_at: new Date('2026-10-01T09:30:00Z'),
        ip_address: '10.1.2.3',
        user_agent: 'Mozilla/5.0',
        session_id: STAFF,
        request_id: 'req-xyz',
      },
      { full_name: 'د. مشرف' },
      STUDENT
    );
    assert.equal(ev.actor.name, 'د. مشرف');
    assert.equal(ev.actor.is_self, false);
    assert.equal(ev.actor.role, 'مشرف / مدرّب');
    assert.equal(ev.category, 'ASSIGNMENT');
    assert.equal(ev.outcome, 'SUCCESS');
    assert.ok(ev.action_label && /[\u0600-\u06FF]/.test(ev.action_label));
    assert.match(ev.details, /الدرجة: 60 ← 85/);
    assert.match(ev.details, /تقرير الأسبوع الأول/);
    const visible = JSON.stringify({ ...ev, id: undefined });
    assert.doesNotMatch(visible, UUID_ANY, 'no UUIDs');
    assert.doesNotMatch(visible, /10\.1\.2\.3|Mozilla|req-xyz/, 'no IP / UA / request id');
    assert.equal('ip_address' in ev, false);
    assert.equal('new_values' in ev, false);
    assert.ok(ev.at_label);
  });

  it('student own action shows as self', () => {
    const ev = presentRow(
      { id: 'r', user_id: STUDENT, action_type: 'USER_LOGIN_SUCCESS', created_at: new Date() },
      null,
      STUDENT
    );
    assert.equal(ev.actor.is_self, true);
    assert.equal(ev.category, 'AUTH');
  });

  it('idle timeout reads naturally', () => {
    assert.match(
      summarizeDetails({ action_type: 'AUTH_SESSION_IDLE_TIMEOUT', new_values: { idleMinutes: 30 } }),
      /بعد 30 دقيقة من عدم النشاط/
    );
  });

  it('technical session/navigation noise is excluded', () => {
    for (const a of ['AUTH_SESSION_CREATED', 'AUTH_SESSION_ACTIVITY_STARTED', 'report.read']) {
      assert.equal(EXCLUDED_ACTIONS.has(a), true, a);
    }
  });

  it('tenant restriction: missing scope → nothing; global → unrestricted', () => {
    assert.deepEqual(tenantWhere(null), { id: { in: [] } });
    assert.equal(tenantWhere({ type: 'global' }), null);
    assert.deepEqual(tenantWhere({ type: 'university', universityId: 'u' }), {
      OR: [{ university_id: null, organization_id: null }, { university_id: 'u' }],
    });
  });

  it('timeline where includes subject OR actor, hides security events by default', async () => {
    const where = await buildTimelineWhere({ studentId: STUDENT, organizationScope: { type: 'global' } });
    assert.deepEqual(where.AND[0], { OR: [{ subject_user_id: STUDENT }, { user_id: STUDENT }] });
    const excluded = where.AND[1].action_type.notIn;
    assert.ok(excluded.includes('USER_LOGIN_FAILED'));
    assert.ok(excluded.includes('AUTH_SESSION_CREATED'));
    const withSec = await buildTimelineWhere({
      studentId: STUDENT,
      organizationScope: { type: 'global' },
      includeSecurityEvents: true,
    });
    assert.equal(withSec.AND[1].action_type.notIn.includes('USER_LOGIN_FAILED'), false);
  });
});

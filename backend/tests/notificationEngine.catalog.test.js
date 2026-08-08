'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  NOTIFICATION_EVENTS,
  isKnownEvent,
  getEventMeta,
  ALLOWED_TEMPLATE_VARS,
  CATEGORIES,
} = require('../src/modules/notificationEngine/notificationEvents.catalog');
const {
  renderTemplate,
  validateTemplateVariables,
  mapPriorityToLegacyType,
  buildDeduplicationKey,
  assertNotificationAdmin,
  OFFICIAL_ROLES,
} = require('../src/modules/notificationEngine/notificationEngine.shared');
const { ApiError } = require('../src/utils/apiError');

describe('notificationEngine catalog', () => {
  it('includes core domain events', () => {
    assert.ok(NOTIFICATION_EVENTS.includes('ACCOUNT_PENDING_ACTIVATION'));
    assert.ok(NOTIFICATION_EVENTS.includes('ATTENDANCE_WINDOW_OPENED'));
    assert.ok(NOTIFICATION_EVENTS.includes('TASK_SUBMITTED'));
    assert.ok(NOTIFICATION_EVENTS.includes('CERTIFICATE_ISSUED'));
    assert.ok(isKnownEvent('SESSION_CREATED'));
    assert.equal(isKnownEvent('NOT_A_REAL_EVENT'), false);
  });

  it('returns meta with critical flags for key events', () => {
    const meta = getEventMeta('ATTENDANCE_WINDOW_OPENED');
    assert.equal(meta.category, 'ATTENDANCE');
    assert.equal(meta.priority, 'URGENT');
    assert.equal(meta.isCritical, true);
    assert.equal(getEventMeta('UNKNOWN'), null);
  });

  it('exposes categories and template vars', () => {
    assert.ok(CATEGORIES.includes('ACCOUNT'));
    assert.ok(ALLOWED_TEMPLATE_VARS.includes('student_name'));
    assert.ok(ALLOWED_TEMPLATE_VARS.includes('session_date'));
  });
});

describe('notificationEngine shared', () => {
  it('renders templates without undefined', () => {
    const out = renderTemplate('مرحبا {{student_name}} — {{missing}}', {
      student_name: 'أحمد',
    });
    assert.equal(out, 'مرحبا أحمد — ');
    assert.ok(!out.includes('undefined'));
  });

  it('rejects unknown template variables', () => {
    const bad = validateTemplateVariables('{{student_name}} {{hack_var}}');
    assert.equal(bad.ok, false);
    assert.deepEqual(bad.unknown, ['hack_var']);
    assert.equal(validateTemplateVariables('{{student_name}}').ok, true);
  });

  it('maps priority to legacy type', () => {
    assert.equal(mapPriorityToLegacyType('URGENT'), 'danger');
    assert.equal(mapPriorityToLegacyType('HIGH'), 'warning');
    assert.equal(mapPriorityToLegacyType('NORMAL'), 'info');
  });

  it('builds stable dedupe keys', () => {
    const key = buildDeduplicationKey({
      eventType: 'TASK_SUBMITTED',
      recipientId: 'u1',
      entityType: 'task',
      entityId: 't1',
      ruleId: 'r1',
    });
    assert.equal(key, 'TASK_SUBMITTED:u1:task:t1:r1');
  });

  it('allows only official roles and notification admins', () => {
    assert.deepEqual(OFFICIAL_ROLES, [
      'super_admin',
      'admin',
      'instructor',
      'trainer',
      'trainee',
      'student',
      'reviewer',
    ]);
    assert.doesNotThrow(() => assertNotificationAdmin({ roles: ['admin'] }));
    assert.throws(
      () => assertNotificationAdmin({ roles: ['student'] }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

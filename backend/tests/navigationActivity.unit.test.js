'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/config/db');
const { installAuditCapture } = require('./helpers/auditCapture');
const { recordNavigation, resetNavigationDedupeForTests } = require('../src/modules/activity/activity.service');

const USER = '11111111-1111-4111-8111-111111111111';
const COURSE = '55555555-5555-4555-8555-555555555555';
const SID = '66666666-6666-4666-8666-666666666666';

describe('navigation activity (COURSE_OPENED …)', () => {
  let audit;
  let origFindFirst;
  before(() => {
    audit = installAuditCapture();
    origFindFirst = prisma.audit_logs.findFirst;
    prisma.audit_logs.findFirst = async () => null;
  });
  after(() => {
    prisma.audit_logs.findFirst = origFindFirst;
    audit.restore();
  });
  beforeEach(() => {
    audit.clear();
    resetNavigationDedupeForTests();
  });

  it('records one COURSE_OPENED per session/entity within the dedupe window', async () => {
    const t0 = new Date('2026-10-13T10:00:00Z');
    const first = await recordNavigation({ userId: USER, sessionId: SID, module: 'COURSE', entityId: COURSE }, { now: t0 });
    const again = await recordNavigation({ userId: USER, sessionId: SID, module: 'COURSE', entityId: COURSE }, { now: new Date(t0.getTime() + 60_000) });
    assert.equal(first.recorded, true);
    assert.equal(again.recorded, false);
    const rows = audit.byAction('COURSE_OPENED');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entity_type, 'training_program');
    assert.equal(rows[0].subject_user_id, USER);
    assert.equal(rows[0].category, 'COURSE');
  });

  it('unknown modules are ignored; invalid entity types fall back to the default', async () => {
    assert.deepEqual(await recordNavigation({ userId: USER, module: 'KEYSTROKE' }), { recorded: false, action: null });
    await recordNavigation({ userId: USER, sessionId: SID, module: 'ASSIGNMENT', entityId: COURSE, entityType: 'users' });
    assert.equal(audit.byAction('ASSIGNMENT_OPENED')[0].entity_type, 'training_task');
  });
});

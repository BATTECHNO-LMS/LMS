const test = require('node:test');
const assert = require('node:assert');
const {
  classifyMarkAllPresentTargets,
  MARK_ALL_PRESENT_SAFE_STATUSES,
  MARK_ALL_PRESENT_REPLACE_STATUSES,
} = require('../src/modules/fieldTraining/fieldTraining.attendanceWindow.service');
const {
  canManageFieldTraining,
  isAssignedInstructor,
} = require('../src/modules/fieldTraining/fieldTraining.access');
const { markAllPresentBodySchema } = require('../src/modules/fieldTraining/fieldTraining.validation');

function app(id) {
  return { id, student_id: `student-${id}` };
}

function att(applicationId, status) {
  return { id: `att-${applicationId}`, application_id: applicationId, status };
}

test('safe mode updates only missing and unconfirmed rows', () => {
  const apps = [app('1'), app('2'), app('3'), app('4'), app('5')];
  const map = new Map([
    ['2', att('2', 'unconfirmed')],
    ['3', att('3', 'absent')],
    ['4', att('4', 'present')],
    ['5', att('5', 'excused')],
  ]);
  const result = classifyMarkAllPresentTargets(apps, map, 'safe');
  assert.deepStrictEqual(
    result.toCreate.map((a) => a.id),
    ['1']
  );
  assert.deepStrictEqual(
    result.toUpdate.map((x) => x.app.id),
    ['2']
  );
  assert.deepStrictEqual(
    result.alreadyPresent.map((x) => x.app.id),
    ['4']
  );
  assert.deepStrictEqual(
    result.skipped.map((x) => x.app.id).sort(),
    ['3', '5']
  );
});

test('replace_all mode updates absent late excused and unconfirmed', () => {
  const apps = [app('1'), app('2'), app('3'), app('4'), app('5'), app('6')];
  const map = new Map([
    ['2', att('2', 'unconfirmed')],
    ['3', att('3', 'absent')],
    ['4', att('4', 'late')],
    ['5', att('5', 'excused')],
    ['6', att('6', 'present')],
  ]);
  const result = classifyMarkAllPresentTargets(apps, map, 'replace_all');
  assert.deepStrictEqual(
    result.toCreate.map((a) => a.id),
    ['1']
  );
  assert.deepStrictEqual(
    result.toUpdate.map((x) => x.app.id).sort(),
    ['2', '3', '4', '5']
  );
  assert.deepStrictEqual(
    result.alreadyPresent.map((x) => x.app.id),
    ['6']
  );
  assert.strictEqual(result.skipped.length, 0);
});

test('already present never creates duplicate targets', () => {
  const apps = [app('1'), app('1')];
  const map = new Map([['1', att('1', 'present')]]);
  const result = classifyMarkAllPresentTargets([app('1')], map, 'replace_all');
  assert.strictEqual(result.toCreate.length, 0);
  assert.strictEqual(result.toUpdate.length, 0);
  assert.strictEqual(result.alreadyPresent.length, 1);
});

test('safe and replace status sets are distinct', () => {
  assert.deepStrictEqual([...MARK_ALL_PRESENT_SAFE_STATUSES], ['unconfirmed']);
  assert.ok(MARK_ALL_PRESENT_REPLACE_STATUSES.includes('absent'));
  assert.ok(MARK_ALL_PRESENT_REPLACE_STATUSES.includes('late'));
  assert.ok(MARK_ALL_PRESENT_REPLACE_STATUSES.includes('excused'));
  assert.ok(MARK_ALL_PRESENT_REPLACE_STATUSES.includes('unconfirmed'));
});

test('markAllPresentBodySchema requires reason and defaults mode to safe', () => {
  const parsed = markAllPresentBodySchema.parse({
    reason: 'تم اعتماد الحضور الكامل للجلسة من قبل المدرس',
  });
  assert.strictEqual(parsed.mode, 'safe');
  assert.throws(() => markAllPresentBodySchema.parse({ mode: 'replace_all' }));
});

test('permissions: assigned instructor and admins can manage; unassigned instructor cannot', () => {
  const opp = { university_id: 'u1', assigned_instructor_id: 'inst-1' };
  const assigned = { userId: 'inst-1', roles: ['instructor'], isGlobal: false };
  const other = { userId: 'inst-2', roles: ['instructor'], isGlobal: false };
  const admin = { userId: 'a1', roles: ['admin'], isGlobal: false, universityId: 'u1' };
  const superAdmin = { userId: 'sa', roles: ['super_admin'], isGlobal: true };
  const student = { userId: 's1', roles: ['student'], isGlobal: false };
  const reviewer = { userId: 'r1', roles: ['reviewer'], isGlobal: false, universityId: 'u1' };

  assert.strictEqual(isAssignedInstructor(assigned, opp), true);
  assert.strictEqual(isAssignedInstructor(other, opp), false);
  assert.strictEqual(canManageFieldTraining(assigned, opp), true);
  assert.strictEqual(canManageFieldTraining(other, opp), false);
  assert.strictEqual(canManageFieldTraining(superAdmin, opp), true);
  assert.strictEqual(canManageFieldTraining(admin, opp), true);
  assert.strictEqual(canManageFieldTraining(student, opp), false);
  assert.strictEqual(canManageFieldTraining(reviewer, opp), false);
});

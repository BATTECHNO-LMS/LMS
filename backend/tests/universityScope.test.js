const test = require('node:test');
const assert = require('node:assert');
const {
  resolveUniversityIdFilter,
  isSystemWideAdmin,
  assertUniversityRecordAccess,
} = require('../src/utils/universityScope');
const { ApiError } = require('../src/utils/apiError');

test('isSystemWideAdmin returns true for isGlobal', () => {
  assert.strictEqual(isSystemWideAdmin({ isGlobal: true, roles: [] }), true);
});

test('isSystemWideAdmin returns true for program_admin', () => {
  assert.strictEqual(isSystemWideAdmin({ isGlobal: false, roles: ['program_admin'] }), true);
});

test('resolveUniversityIdFilter forces university for scoped user', () => {
  const uni = '11111111-1111-1111-1111-111111111111';
  assert.strictEqual(
    resolveUniversityIdFilter({ isGlobal: false, roles: ['university_admin'], universityId: uni }, null),
    uni
  );
});

test('resolveUniversityIdFilter rejects cross-university query', () => {
  const uni = '11111111-1111-1111-1111-111111111111';
  const other = '22222222-2222-2222-2222-222222222222';
  assert.throws(
    () => resolveUniversityIdFilter({ isGlobal: false, roles: ['university_admin'], universityId: uni }, other),
    (err) => err instanceof ApiError && err.statusCode === 403
  );
});

test('assertUniversityRecordAccess allows system-wide admin', () => {
  assert.doesNotThrow(() =>
    assertUniversityRecordAccess({ isGlobal: true, roles: ['super_admin'] }, 'any-id')
  );
});

test('assertUniversityRecordAccess denies wrong university', () => {
  const uni = '11111111-1111-1111-1111-111111111111';
  const other = '22222222-2222-2222-2222-222222222222';
  assert.throws(
    () => assertUniversityRecordAccess({ isGlobal: false, roles: ['university_admin'], universityId: uni }, other),
    (err) => err instanceof ApiError && err.statusCode === 403
  );
});

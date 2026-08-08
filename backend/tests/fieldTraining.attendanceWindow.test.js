const test = require('node:test');
const assert = require('node:assert');
const {
  generateAttendanceCode,
  hashAttendanceCode,
  ALLOWED_DURATIONS,
} = require('../src/modules/fieldTraining/fieldTraining.attendanceWindow.service');

test('attendance code is hashed (not reversible plaintext)', () => {
  const code = 'AB12CD';
  const hash = hashAttendanceCode(code);
  assert.notEqual(hash, code);
  assert.equal(hash, hashAttendanceCode('ab12cd'));
  assert.notEqual(hash, hashAttendanceCode('ZZZZZZ'));
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('generated attendance codes are alphanumeric without ambiguous chars', () => {
  for (let i = 0; i < 20; i += 1) {
    const code = generateAttendanceCode();
    assert.match(code, /^[A-Z0-9]{6}$/);
    assert.doesNotMatch(code, /[01OI]/);
  }
});

test('allowed attendance window durations include default 120s', () => {
  assert.ok(ALLOWED_DURATIONS.includes(60));
  assert.ok(ALLOWED_DURATIONS.includes(120));
  assert.ok(ALLOWED_DURATIONS.includes(180));
  assert.ok(ALLOWED_DURATIONS.includes(300));
  assert.equal(ALLOWED_DURATIONS.includes(90), false);
});

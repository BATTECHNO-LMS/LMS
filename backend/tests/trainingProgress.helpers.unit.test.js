'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeHoursStatus,
  computeAttendanceStatus,
} = require('../src/modules/trainingPrograms/trainingProgress.helpers');

describe('computeHoursStatus', () => {
  it('returns ok true when sessionCount is 0 even with required hours', () => {
    const result = computeHoursStatus({ sessionCount: 0, hoursCompleted: 0, hoursRequired: 15 });
    assert.equal(result.ok, true);
    assert.equal(result.required, 15);
    assert.equal(result.value, 0);
  });

  it('returns ok false when sessions exist and below threshold', () => {
    const result = computeHoursStatus({ sessionCount: 5, hoursCompleted: 10, hoursRequired: 15 });
    assert.equal(result.ok, false);
  });

  it('returns ok true when sessions exist and meets threshold', () => {
    const result = computeHoursStatus({ sessionCount: 5, hoursCompleted: 15, hoursRequired: 15 });
    assert.equal(result.ok, true);
  });

  it('returns ok true when hoursRequired is 0 with sessions', () => {
    const result = computeHoursStatus({ sessionCount: 3, hoursCompleted: 0, hoursRequired: 0 });
    assert.equal(result.ok, true);
  });
});

describe('computeAttendanceStatus', () => {
  it('returns ok true when sessionCount is 0 even with required attendance', () => {
    const result = computeAttendanceStatus({ sessionCount: 0, attendancePct: 0, requiredAttendance: 80 });
    assert.equal(result.ok, true);
    assert.equal(result.required, 80);
    assert.equal(result.value, 0);
  });

  it('returns ok false when sessions exist and below threshold', () => {
    const result = computeAttendanceStatus({ sessionCount: 10, attendancePct: 50, requiredAttendance: 80 });
    assert.equal(result.ok, false);
  });

  it('returns ok true when sessions exist and meets threshold', () => {
    const result = computeAttendanceStatus({ sessionCount: 10, attendancePct: 85, requiredAttendance: 80 });
    assert.equal(result.ok, true);
  });

  it('returns ok true when requiredAttendance is 0 with sessions', () => {
    const result = computeAttendanceStatus({ sessionCount: 5, attendancePct: 0, requiredAttendance: 0 });
    assert.equal(result.ok, true);
  });
});

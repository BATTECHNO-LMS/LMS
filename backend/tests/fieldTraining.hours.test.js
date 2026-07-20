const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildHoursSummary,
  validateCompletedHoursReplacement,
  validateRequiredHoursValue,
} = require('../src/modules/fieldTraining/fieldTraining.hours');

describe('fieldTraining.hours', () => {
  describe('buildHoursSummary', () => {
    it('returns nulls when neither required nor completed set', () => {
      const summary = buildHoursSummary({}, {});
      assert.equal(summary.required_training_hours, null);
      assert.equal(summary.completed_training_hours, null);
      assert.equal(summary.remaining_training_hours, null);
      assert.equal(summary.hours_progress_percentage, null);
      assert.equal(summary.hours_configured, false);
      assert.equal(summary.hours_recorded, false);
    });

    it('computes remaining and capped progress', () => {
      const summary = buildHoursSummary(
        { completed_training_hours: 90 },
        { required_training_hours: 100 }
      );
      assert.equal(summary.remaining_training_hours, 10);
      assert.equal(summary.hours_progress_percentage, 90);
    });

    it('caps progress at 100', () => {
      const summary = buildHoursSummary(
        { completed_training_hours: 120 },
        { required_training_hours: 100 }
      );
      assert.equal(summary.hours_progress_percentage, 100);
      assert.equal(summary.remaining_training_hours, 0);
    });
  });

  describe('validateCompletedHoursReplacement', () => {
    it('rejects negative hours', () => {
      const result = validateCompletedHoursReplacement(-1, 40);
      assert.equal(result.ok, false);
      assert.equal(result.code, 'HOURS_NEGATIVE');
    });

    it('rejects non-integer precision', () => {
      const result = validateCompletedHoursReplacement(4.5, 40);
      assert.equal(result.ok, false);
      assert.equal(result.code, 'HOURS_INVALID_PRECISION');
    });

    it('rejects exceeding required hours', () => {
      const result = validateCompletedHoursReplacement(50, 40);
      assert.equal(result.ok, false);
      assert.equal(result.code, 'HOURS_EXCEED_REQUIRED');
    });

    it('allows completed when required is null', () => {
      const result = validateCompletedHoursReplacement(50, null);
      assert.equal(result.ok, true);
      assert.equal(result.value, 50);
    });

    it('allows zero completed hours', () => {
      const result = validateCompletedHoursReplacement(0, 40);
      assert.equal(result.ok, true);
      assert.equal(result.value, 0);
    });
  });

  describe('validateRequiredHoursValue', () => {
    it('allows clearing with null', () => {
      assert.deepEqual(validateRequiredHoursValue(null), { ok: true, value: null });
    });

    it('rejects zero required hours', () => {
      const result = validateRequiredHoursValue(0);
      assert.equal(result.ok, false);
      assert.equal(result.code, 'REQUIRED_HOURS_NOT_POSITIVE');
    });

    it('accepts positive required hours', () => {
      assert.deepEqual(validateRequiredHoursValue(120), { ok: true, value: 120 });
    });
  });
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sessionDurationMinutes,
  buildHoursProgress,
  sumCompletedMinutesFromRecords,
  HOURS_STATUS,
  buildHoursSummary,
  validateCompletedHoursReplacement,
  validateRequiredHoursValue,
} = require('../src/modules/fieldTraining/fieldTraining.hours');
const {
  opportunityBodySchema,
  updateOpportunityBodySchema,
} = require('../src/modules/fieldTraining/fieldTraining.validation');

test('sessionDurationMinutes derives duration from start/end times', () => {
  assert.equal(sessionDurationMinutes('09:00', '11:00'), 120);
  assert.equal(sessionDurationMinutes('09:00', '10:30'), 90);
  assert.equal(sessionDurationMinutes('11:00', '09:00'), null);
  assert.equal(sessionDurationMinutes('09:00', '09:00'), null);
});

test('buildHoursProgress statuses and capped percentage', () => {
  assert.deepEqual(buildHoursProgress({ requiredHours: null, completedMinutes: 120 }), {
    required_training_hours: null,
    completed_training_hours: 2,
    remaining_training_hours: null,
    excess_training_hours: 0,
    hours_completion_percentage: null,
    hours_completion_status: null,
  });

  const notStarted = buildHoursProgress({ requiredHours: 160, completedMinutes: 0 });
  assert.equal(notStarted.hours_completion_status, HOURS_STATUS.NOT_STARTED);
  assert.equal(notStarted.hours_completion_percentage, 0);

  const inProgress = buildHoursProgress({ requiredHours: 160, completedMinutes: 72 * 60 });
  assert.equal(inProgress.hours_completion_status, HOURS_STATUS.IN_PROGRESS);
  assert.equal(inProgress.completed_training_hours, 72);
  assert.equal(inProgress.remaining_training_hours, 88);
  assert.equal(inProgress.hours_completion_percentage, 45);

  const completed = buildHoursProgress({ requiredHours: 160, completedMinutes: 200 * 60 });
  assert.equal(completed.hours_completion_status, HOURS_STATUS.COMPLETED);
  assert.equal(completed.hours_completion_percentage, 100);
  assert.equal(completed.excess_training_hours, 40);
  assert.equal(completed.remaining_training_hours, 0);
});

test('sumCompletedMinutesFromRecords counts attended only once per session', () => {
  const records = [
    {
      session_id: 's1',
      status: 'present',
      field_training_sessions: { id: 's1', start_time: '09:00', end_time: '11:00' },
    },
    {
      session_id: 's1',
      status: 'present',
      field_training_sessions: { id: 's1', start_time: '09:00', end_time: '11:00' },
    },
    {
      session_id: 's2',
      status: 'absent',
      field_training_sessions: { id: 's2', start_time: '09:00', end_time: '11:00' },
    },
    {
      session_id: 's3',
      status: 'late',
      field_training_sessions: { id: 's3', start_time: '10:00', end_time: '11:00' },
    },
    {
      session_id: 's4',
      status: 'excused',
      field_training_sessions: { id: 's4', start_time: '08:00', end_time: '10:00' },
    },
  ];
  // present 120 + late 60 + excused 120 = 300; duplicate s1 ignored; absent ignored
  assert.equal(sumCompletedMinutesFromRecords(records), 300);
});

test('opportunityBodySchema requires positive integer hours on create', () => {
  const base = {
    title: 'Opportunity',
    specialty_id: '00000000-0000-4000-8000-000000000001',
    eligibility: [
      {
        university_id: '00000000-0000-4000-8000-000000000002',
        university_specialty_id: '00000000-0000-4000-8000-000000000003',
      },
    ],
    location: 'Amman',
    training_mode: 'onsite',
  };

  assert.equal(opportunityBodySchema.safeParse({ ...base, required_training_hours: 160 }).success, true);
  assert.equal(opportunityBodySchema.safeParse({ ...base, required_training_hours: 0 }).success, false);
  assert.equal(opportunityBodySchema.safeParse({ ...base, required_training_hours: -5 }).success, false);
  assert.equal(opportunityBodySchema.safeParse({ ...base, required_training_hours: 'abc' }).success, false);
  assert.equal(opportunityBodySchema.safeParse(base).success, false);
});

test('updateOpportunityBodySchema allows null hours for legacy compatibility', () => {
  const parsed = updateOpportunityBodySchema.safeParse({ required_training_hours: null });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.required_training_hours, null);

  assert.equal(updateOpportunityBodySchema.safeParse({ required_training_hours: 120 }).success, true);
  assert.equal(updateOpportunityBodySchema.safeParse({ required_training_hours: 0 }).success, false);
});

test('fieldTraining.hours Model A — buildHoursSummary', async (t) => {
  await t.test('returns nulls when neither required nor completed set', () => {
    const summary = buildHoursSummary({}, {});
    assert.equal(summary.required_training_hours, null);
    assert.equal(summary.completed_training_hours, null);
    assert.equal(summary.remaining_training_hours, null);
    assert.equal(summary.hours_progress_percentage, null);
    assert.equal(summary.hours_configured, false);
    assert.equal(summary.hours_recorded, false);
  });

  await t.test('computes remaining and capped progress', () => {
    const summary = buildHoursSummary(
      { completed_training_hours: 90 },
      { required_training_hours: 100 }
    );
    assert.equal(summary.remaining_training_hours, 10);
    assert.equal(summary.hours_progress_percentage, 90);
  });

  await t.test('caps progress at 100', () => {
    const summary = buildHoursSummary(
      { completed_training_hours: 120 },
      { required_training_hours: 100 }
    );
    assert.equal(summary.hours_progress_percentage, 100);
    assert.equal(summary.remaining_training_hours, 0);
  });
});

test('fieldTraining.hours Model A — validateCompletedHoursReplacement', async (t) => {
  await t.test('rejects negative hours', () => {
    const result = validateCompletedHoursReplacement(-1, 40);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'HOURS_NEGATIVE');
  });

  await t.test('rejects non-integer precision', () => {
    const result = validateCompletedHoursReplacement(4.5, 40);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'HOURS_INVALID_PRECISION');
  });

  await t.test('rejects exceeding required hours', () => {
    const result = validateCompletedHoursReplacement(50, 40);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'HOURS_EXCEED_REQUIRED');
  });

  await t.test('allows completed when required is null', () => {
    const result = validateCompletedHoursReplacement(50, null);
    assert.equal(result.ok, true);
    assert.equal(result.value, 50);
  });

  await t.test('allows zero completed hours', () => {
    const result = validateCompletedHoursReplacement(0, 40);
    assert.equal(result.ok, true);
    assert.equal(result.value, 0);
  });
});

test('fieldTraining.hours Model A — validateRequiredHoursValue', async (t) => {
  await t.test('allows clearing with null', () => {
    assert.deepEqual(validateRequiredHoursValue(null), { ok: true, value: null });
  });

  await t.test('rejects zero required hours', () => {
    const result = validateRequiredHoursValue(0);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'REQUIRED_HOURS_NOT_POSITIVE');
  });

  await t.test('accepts positive required hours', () => {
    assert.deepEqual(validateRequiredHoursValue(120), { ok: true, value: 120 });
  });
});

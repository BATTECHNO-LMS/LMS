const {
  CASE_TYPES,
  SEVERITIES,
  STATUSES,
  ACTIONS,
  RESOLUTIONS,
  ACTIVE_STATUSES,
} = require('../src/modules/fieldTraining/fieldTraining.intervention.service');

describe('fieldTraining intervention constants', () => {
  test('controlled case types include LOW_ATTENDANCE', () => {
    expect(CASE_TYPES).toContain('LOW_ATTENDANCE');
    expect(CASE_TYPES).toContain('STUDENT_SUPPORT');
  });

  test('severity and status lifecycles are controlled', () => {
    expect(SEVERITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(STATUSES).toContain('OPEN');
    expect(STATUSES).toContain('RESOLVED');
    expect(STATUSES).toContain('CLOSED');
    expect(ACTIVE_STATUSES).toEqual(['OPEN', 'IN_PROGRESS', 'MONITORING']);
  });

  test('timeline actions and resolutions are controlled enums', () => {
    expect(ACTIONS).toContain('CASE_OPENED');
    expect(ACTIONS).toContain('FOLLOW_UP_ADDED');
    expect(ACTIONS).toContain('REOPENED');
    expect(RESOLUTIONS).toContain('IMPROVED');
    expect(RESOLUTIONS).toContain('TRAINING_ENDED');
  });
});

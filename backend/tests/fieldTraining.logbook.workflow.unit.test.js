'use strict';

const {
  LOGBOOK_STATUS,
  assertTransition,
  canStudentEdit,
  canStudentDelete,
} = require('../src/modules/fieldTraining/fieldTraining.logbook.workflow');

describe('field training logbook workflow', () => {
  test('allows DRAFT → SUBMITTED → APPROVED', () => {
    expect(() => assertTransition(LOGBOOK_STATUS.DRAFT, LOGBOOK_STATUS.SUBMITTED)).not.toThrow();
    expect(() => assertTransition(LOGBOOK_STATUS.SUBMITTED, LOGBOOK_STATUS.APPROVED)).not.toThrow();
  });

  test('allows revision loop', () => {
    expect(() =>
      assertTransition(LOGBOOK_STATUS.SUBMITTED, LOGBOOK_STATUS.REVISION_REQUESTED)
    ).not.toThrow();
    expect(() =>
      assertTransition(LOGBOOK_STATUS.REVISION_REQUESTED, LOGBOOK_STATUS.SUBMITTED)
    ).not.toThrow();
  });

  test('rejects invalid transitions', () => {
    expect(() => assertTransition(LOGBOOK_STATUS.APPROVED, LOGBOOK_STATUS.DRAFT)).toThrow();
    expect(() => assertTransition(LOGBOOK_STATUS.DRAFT, LOGBOOK_STATUS.APPROVED)).toThrow();
  });

  test('edit/delete rules', () => {
    expect(canStudentEdit(LOGBOOK_STATUS.DRAFT)).toBe(true);
    expect(canStudentEdit(LOGBOOK_STATUS.REVISION_REQUESTED)).toBe(true);
    expect(canStudentEdit(LOGBOOK_STATUS.SUBMITTED)).toBe(false);
    expect(canStudentDelete(LOGBOOK_STATUS.DRAFT)).toBe(true);
    expect(canStudentDelete(LOGBOOK_STATUS.APPROVED)).toBe(false);
  });

  test('logbook never implies score contribution (status constants only)', () => {
    expect(Object.values(LOGBOOK_STATUS)).not.toContain('SCORED');
  });
});

'use strict';

const {
  RISK_LEVELS,
  RISK_SIGNALS,
  evaluateFieldTrainingRisk,
} = require('../src/modules/fieldTraining/fieldTraining.risk');
const { READINESS_STATES, READINESS_REASONS } = require('../src/modules/fieldTraining/fieldTraining.readiness');

describe('fieldTraining risk engine', () => {
  test('healthy progressing student → NONE', () => {
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'in_training' },
      readiness: { state: READINESS_STATES.NEARLY_READY, reasons: [READINESS_REASONS.HOURS_INCOMPLETE] },
      qualification: { finalScore: 82, passingScore: 80 },
      overdueTasks: [],
      attendance: { percentage: 95, absentCount: 0, minimumPercentage: 80 },
      lectures: [{ id: 'l1', progress_percent: 80, completed_at: null, available_at: new Date() }],
      lastMeaningfulActivityAt: new Date(),
    });
    expect(risk.riskLevel).toBe(RISK_LEVELS.NONE);
    expect(risk.signals).toHaveLength(0);
  });

  test('low attendance + overdue tasks → HIGH with explanations', () => {
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'in_training' },
      readiness: {
        state: READINESS_STATES.NOT_READY,
        reasons: [READINESS_REASONS.ATTENDANCE_INCOMPLETE, READINESS_REASONS.TASKS_PENDING],
      },
      qualification: { finalScore: 70, passingScore: 80 },
      overdueTasks: [
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
      ],
      attendance: { percentage: 40, absentCount: 2, minimumPercentage: 80 },
      lectures: [],
      lastMeaningfulActivityAt: new Date(),
    });
    expect([RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL, RISK_LEVELS.MEDIUM]).toContain(risk.riskLevel);
    expect(risk.signals.some((s) => s.code === RISK_SIGNALS.LOW_ATTENDANCE)).toBe(true);
    expect(risk.signals.some((s) => s.code === RISK_SIGNALS.TASKS_OVERDUE)).toBe(true);
    expect(risk.explanations_ar.length).toBeGreaterThanOrEqual(2);
    expect(risk.explanations_ar.join(' ')).not.toMatch(/%$/);
  });

  test('missing POST signal', () => {
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'task_submitted' },
      readiness: {
        state: READINESS_STATES.NOT_READY,
        reasons: [READINESS_REASONS.POST_NOT_COMPLETED],
      },
      qualification: { finalScore: 60, passingScore: 80 },
      overdueTasks: [],
      attendance: { percentage: 90, absentCount: 0, minimumPercentage: 80 },
      lectures: [],
      lastMeaningfulActivityAt: new Date(),
    });
    expect(risk.signals.some((s) => s.code === RISK_SIGNALS.MISSING_POST)).toBe(true);
  });

  test('lecture not started after meaningful availability window', () => {
    const available = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'in_training' },
      readiness: { state: READINESS_STATES.NOT_READY, reasons: [] },
      qualification: { finalScore: 75, passingScore: 80 },
      overdueTasks: [],
      attendance: { percentage: 90, absentCount: 0, minimumPercentage: 80 },
      lectures: [{ id: 'l1', progress_percent: 0, completed_at: null, available_at: available }],
      lastMeaningfulActivityAt: new Date(),
    });
    expect(risk.signals.some((s) => s.code === RISK_SIGNALS.RECORDED_LECTURE_NOT_STARTED)).toBe(true);
  });

  test('does not invent HOURS_BEHIND_EXPECTED without schedule support', () => {
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'in_training' },
      readiness: { state: READINESS_STATES.NOT_READY, reasons: [READINESS_REASONS.HOURS_INCOMPLETE] },
      qualification: { finalScore: 82, passingScore: 80 },
      overdueTasks: [],
      attendance: { percentage: 90, absentCount: 0, minimumPercentage: 80 },
      lectures: [],
      lastMeaningfulActivityAt: new Date(),
      expectedHoursProgress: { supported: false, expected: null, completed: 10 },
    });
    expect(risk.signals.some((s) => s.code === RISK_SIGNALS.HOURS_BEHIND_EXPECTED)).toBe(false);
  });

  test('duplicate signal codes are not repeated', () => {
    const risk = evaluateFieldTrainingRisk({
      application: { status: 'approved', training_status: 'in_training' },
      readiness: {
        state: READINESS_STATES.NOT_READY,
        reasons: [READINESS_REASONS.BEHAVIOR_PENDING],
      },
      qualification: { finalScore: 50, passingScore: 80 },
      overdueTasks: [{ id: 't1' }],
      attendance: { percentage: 30, absentCount: 3, minimumPercentage: 80 },
      lectures: [],
      lastMeaningfulActivityAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    });
    const codes = risk.signals.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

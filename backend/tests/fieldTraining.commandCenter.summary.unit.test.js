'use strict';

const { buildSummary } = require('../src/modules/fieldTraining/fieldTraining.commandCenter.service');
const { RISK_LEVELS } = require('../src/modules/fieldTraining/fieldTraining.risk');

describe('command center summary', () => {
  test('summary counts reflect full population independent of pagination', () => {
    const rows = [
      {
        risk: {
          riskLevel: RISK_LEVELS.HIGH,
          signals: [{ code: 'LOW_ATTENDANCE' }, { code: 'TASKS_OVERDUE' }],
        },
        readiness: { reasons: ['POST_NOT_COMPLETED'] },
        flags: { near_completion: false, ready_to_complete: false, blocked: true },
      },
      {
        risk: {
          riskLevel: RISK_LEVELS.NONE,
          signals: [],
        },
        readiness: { reasons: [] },
        flags: { near_completion: true, ready_to_complete: false, blocked: false },
      },
      {
        risk: {
          riskLevel: RISK_LEVELS.MEDIUM,
          signals: [{ code: 'RECORDED_LECTURE_NOT_STARTED' }],
        },
        readiness: { reasons: [] },
        flags: { near_completion: false, ready_to_complete: true, blocked: false },
      },
    ];

    const summary = buildSummary(rows);
    expect(summary.total_scoped).toBe(3);
    expect(summary.needs_attention).toBe(2);
    expect(summary.low_attendance).toBe(1);
    expect(summary.tasks_overdue).toBe(1);
    expect(summary.lectures_incomplete).toBe(1);
    expect(summary.post_incomplete).toBe(1);
    expect(summary.near_completion).toBe(1);
    expect(summary.ready_to_complete).toBe(1);
    expect(summary.blocked).toBe(1);
  });
});

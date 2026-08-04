'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeImprovement,
  computeNps,
  computeAttendanceBreakdown,
  buildEnrollmentFunnel,
  buildIndividualRecommendation,
  privacySafeGroup,
  buildScopeKey,
  average,
} = require('../src/modules/trainingPrograms/trainingReportMetrics.service');

describe('trainingReportMetrics.computeImprovement', () => {
  it('computes percentage-point and relative improvement', () => {
    const out = computeImprovement(55, 85);
    assert.equal(out.percentagePointDifference, 30);
    assert.equal(out.relativeImprovementPct, 54.55);
    assert.equal(out.direction, 'improved');
  });

  it('marks decreased performance without positive language', () => {
    const out = computeImprovement(80, 60);
    assert.equal(out.direction, 'decreased');
    assert.equal(out.percentagePointDifference, -20);
  });

  it('returns unavailable when a score is missing', () => {
    const out = computeImprovement(null, 80);
    assert.equal(out.percentagePointDifference, null);
    assert.equal(out.direction, 'unavailable');
  });

  it('returns null relative improvement when pre is zero', () => {
    const out = computeImprovement(0, 50);
    assert.equal(out.percentagePointDifference, 50);
    assert.equal(out.relativeImprovementPct, null);
  });
});

describe('trainingReportMetrics.computeNps', () => {
  it('calculates NPS as promoters% - detractors% not an average', () => {
    // 2 promoters (10,9), 1 passive (7), 1 detractor (3) => (50-25)=25
    const out = computeNps([10, 9, 7, 3]);
    assert.equal(out.promoters, 2);
    assert.equal(out.passives, 1);
    assert.equal(out.detractors, 1);
    assert.equal(out.index, 25);
    assert.equal(out.totalResponses, 4);
  });

  it('returns null index when empty', () => {
    const out = computeNps([]);
    assert.equal(out.index, null);
    assert.equal(out.totalResponses, 0);
  });
});

describe('trainingReportMetrics.computeAttendanceBreakdown', () => {
  it('does not invent zero percentage when no sessions exist', () => {
    const out = computeAttendanceBreakdown([], []);
    assert.equal(out.totalSessions, 0);
    assert.equal(out.attendancePct, null);
    assert.equal(out.attendancePctLabel, 'غير متوفر');
  });

  it('counts present/late/excused toward attendance', () => {
    const sessions = [{ id: 's1', hours: 2 }, { id: 's2', hours: 2 }];
    const records = [
      { session_id: 's1', status: 'present' },
      { session_id: 's2', status: 'late' },
    ];
    const out = computeAttendanceBreakdown(sessions, records);
    assert.equal(out.attendancePct, 100);
    assert.equal(out.hoursCompleted, 4);
  });
});

describe('trainingReportMetrics.buildEnrollmentFunnel', () => {
  it('builds staged counts', () => {
    const funnel = buildEnrollmentFunnel([
      { status: 'ACTIVE' },
      { status: 'COMPLETED' },
      { status: 'WITHDRAWN' },
    ]);
    assert.ok(funnel.length >= 5);
    assert.equal(funnel[0].count, 3);
  });
});

describe('trainingReportMetrics.buildIndividualRecommendation', () => {
  it('mentions improvement and completion when earned', () => {
    const text = buildIndividualRecommendation({
      improvement: { direction: 'improved', percentagePointDifference: 30 },
      attendancePct: 90,
      completedAllRequirements: true,
      certificateIssued: true,
      missingRequirements: [],
    });
    assert.match(text, /30/);
    assert.match(text, /90%/);
    assert.match(text, /الشهادة/);
  });

  it('does not claim improvement when scores decreased', () => {
    const text = buildIndividualRecommendation({
      improvement: { direction: 'decreased', percentagePointDifference: -10 },
      attendancePct: 50,
      completedAllRequirements: false,
      certificateIssued: false,
      missingRequirements: ['متطلب الحضور'],
    });
    assert.match(text, /انخفض/);
    assert.doesNotMatch(text, /حقق المتدرب تحسنًا/);
  });
});

describe('trainingReportMetrics helpers', () => {
  it('privacySafeGroup respects threshold', () => {
    assert.equal(privacySafeGroup(4), false);
    assert.equal(privacySafeGroup(5), true);
  });

  it('buildScopeKey is deterministic', () => {
    assert.equal(buildScopeKey({ cohortId: 'c1' }), 'c1|none|none');
    assert.equal(buildScopeKey({}), 'none|none|none');
  });

  it('average ignores nulls', () => {
    assert.equal(average([1, null, 3]), 2);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const m = require('../src/modules/fieldTraining/fieldTrainingReport.metrics');

describe('fieldTrainingReport.metrics', () => {
  it('does not coerce missing values to zero', () => {
    assert.equal(m.average([]), null);
    assert.equal(m.average([null, undefined, '']), null);
    assert.equal(m.median([]), null);
    assert.equal(m.sum([]), null);
    assert.equal(m.minOf([]), null);
    assert.equal(m.maxOf([]), null);
    assert.equal(m.rate(null, 10), null);
    assert.equal(m.rate(5, 0), null);
    assert.equal(m.rate(5, null), null);
    assert.equal(m.displayMetric(null), 'غير متوفر');
    assert.equal(m.displayMetric(null, { missing: m.NOT_REQUIRED }), 'غير مطلوب');
  });

  it('computes rates, averages, and medians from known values only', () => {
    assert.equal(m.rate(12, 30), 40);
    assert.equal(m.average([10, 20, 30]), 20);
    assert.equal(m.median([1, 3, 2]), 2);
    assert.equal(m.median([1, 2, 3, 4]), 2.5);
    assert.equal(m.average([10, null, 20]), 15);
  });

  it('never returns NaN or Infinity', () => {
    const values = [m.rate(1, 0), m.relativeImprovement(0, 50), m.average([Number.NaN])];
    for (const v of values) {
      assert.equal(v, null);
      assert.equal(Number.isNaN(v), false);
      assert.equal(v === Infinity, false);
    }
  });

  it('computes pre/post difference without claiming causation', () => {
    assert.equal(m.prePostDelta(60, 82), 22);
    assert.equal(m.relativeImprovement(60, 82), 36.67);
    assert.equal(m.classifyPrePost(60, 82), 'improved');
    assert.equal(m.classifyPrePost(80, 80), 'unchanged');
    assert.equal(m.classifyPrePost(80, 60), 'decreased');
    assert.equal(m.prePostDelta(null, 82), null);

    const summary = m.summarizePrePostPairs([
      { pre: 60, post: 82 },
      { pre: 50, post: 50 },
      { pre: 70, post: 60 },
      { pre: null, post: 90 },
    ]);
    assert.equal(summary.sample_size, 3);
    assert.equal(summary.improved, 1);
    assert.equal(summary.unchanged, 1);
    assert.equal(summary.decreased, 1);
    assert.match(summary.observation, /الفرق الملحوظ بين نتائج القياس القبلي والبعدي/);
    assert.match(summary.caveat, /لا يُفسَّر/);
  });

  it('returns an empty-state observation when no pre/post pairs exist', () => {
    const summary = m.summarizePrePostPairs([]);
    assert.equal(summary.average_pre, null);
    assert.equal(summary.average_pp, null);
    assert.match(summary.observation, /لا توجد نتائج/);
  });

  it('buckets progress and keeps missing separate', () => {
    const dist = m.progressDistribution([10, 40, 60, 80, 100, null]);
    assert.equal(dist.known, 5);
    assert.equal(dist.missing, 1);
    assert.equal(dist.buckets.find((b) => b.key === '100').count, 1);
    assert.equal(dist.buckets.find((b) => b.key === '0-24').percentage, 20);
  });

  it('counts attendance statuses including unconfirmed', () => {
    const counts = m.countAttendanceStatuses(['present', 'absent', 'late', 'excused', 'unconfirmed', 'present']);
    assert.equal(counts.present, 2);
    assert.equal(counts.unconfirmed, 1);
    assert.equal(counts.absent, 1);
  });

  it('maps requirement states to Arabic labels without using 0%', () => {
    assert.equal(m.requirementLabel(m.requirementState({ required: false })), 'غير مطلوب');
    assert.equal(m.requirementLabel(m.requirementState({ required: true, complete: true })), 'مكتمل');
    assert.equal(m.requirementLabel(m.requirementState({ required: true, complete: false })), 'غير مكتمل');
    assert.equal(m.requirementLabel(m.requirementState({ required: true, pending: true })), 'بانتظار التقييم');
  });

  it('builds rules-based university recommendations from evidence', () => {
    const rows = m.buildUniversityRecommendations({
      specialtyAttendance: [{ label: 'أمن سيبراني', below_threshold: 12, students: 30 }],
      hoursBelow: 4,
      attendanceBelow: 12,
      pendingGrading: 3,
      atRisk: 2,
      completionRate: 40,
      incompleteAttendanceRecords: 8,
    });
    assert.ok(rows.some((r) => r.finding.includes('أمن سيبراني') && r.evidence.includes('12/30')));
    assert.ok(rows.some((r) => r.evidence.includes('8')));
  });
});

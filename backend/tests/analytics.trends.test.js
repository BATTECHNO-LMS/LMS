const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const repo = require('../src/modules/analytics/analytics.repository');

function buildTrendMetrics(currentKpis, previousKpis) {
  return Object.fromEntries(
    Object.keys(currentKpis).map((key) => {
      const current = currentKpis[key];
      if (!previousKpis) {
        return [key, { current, previous: null, trendPct: null }];
      }
      const previous = previousKpis[key] ?? 0;
      if (previous === 0 && current > 0) {
        return [key, { current, previous, trendPct: 100, label: 'new' }];
      }
      const trendPct = Math.round(((current - previous) / Math.max(previous, 1)) * 10000) / 100;
      return [key, { current, previous, trendPct }];
    })
  );
}

describe('analytics trend period helpers', () => {
  it('computePreviousPeriodFilters returns equivalent prior window', () => {
    const filters = {
      university_id: undefined,
      from: new Date('2025-05-01T00:00:00.000Z'),
      to: new Date('2025-05-30T00:00:00.000Z'),
    };
    const prev = repo.computePreviousPeriodFilters(filters);
    assert.ok(prev);
    assert.equal(prev.from.toISOString().slice(0, 10), '2025-04-01');
    assert.equal(prev.to.toISOString().slice(0, 10), '2025-04-30');
  });

  it('computePreviousPeriodFilters returns null without dates', () => {
    assert.equal(repo.computePreviousPeriodFilters({ from: null, to: null }), null);
  });

  it('buildTrendMetrics calculates period-over-period change', () => {
    const trends = buildTrendMetrics({ enrolledStudents: 115 }, { enrolledStudents: 100 });
    assert.equal(trends.enrolledStudents.trendPct, 15);
    assert.equal(trends.enrolledStudents.current, 115);
    assert.equal(trends.enrolledStudents.previous, 100);
  });

  it('buildTrendMetrics marks new growth when previous is zero', () => {
    const trends = buildTrendMetrics({ certificatesIssued: 3 }, { certificatesIssued: 0 });
    assert.equal(trends.certificatesIssued.label, 'new');
    assert.equal(trends.certificatesIssued.trendPct, 100);
  });
});

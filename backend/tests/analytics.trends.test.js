'use strict';

/**
 * Analytics trends contract tests (DB-free).
 *
 * History: an earlier test called `repo.computePreviousPeriodFilters`, but that
 * helper was never implemented or exported. Overview `kpiTrends` is a stub:
 * each KPI maps to `{ pct: 0 }`. Frontend reads `trends?.<kpi>?.pct`.
 *
 * These tests cover the shipped stub helper and query date-filter validation.
 * They do not invent previous-period comparison semantics.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildKpiTrendsStub } = require('../src/modules/analytics/analytics.kpiTrends');
const { analyticsQuerySchema } = require('../src/modules/analytics/analytics.validation');

describe('buildKpiTrendsStub (public kpiTrends shape)', () => {
  it('maps each KPI key to { pct: 0 }', () => {
    const trends = buildKpiTrendsStub({
      enrolledStudents: 115,
      certificatesIssued: 3,
    });
    assert.deepEqual(trends, {
      enrolledStudents: { pct: 0 },
      certificatesIssued: { pct: 0 },
    });
  });

  it('returns empty object for empty KPIs', () => {
    assert.deepEqual(buildKpiTrendsStub({}), {});
  });

  it('treats nullish KPIs as empty', () => {
    assert.deepEqual(buildKpiTrendsStub(null), {});
    assert.deepEqual(buildKpiTrendsStub(undefined), {});
  });

  it('does not use KPI values for trend magnitude (stub always 0)', () => {
    const trends = buildKpiTrendsStub({ enrolledStudents: 999 });
    assert.equal(trends.enrolledStudents.pct, 0);
    assert.equal(Object.keys(trends.enrolledStudents).length, 1);
  });

  it('does not mutate the input KPI object', () => {
    const kpis = { enrolledStudents: 10 };
    const snapshot = { ...kpis };
    buildKpiTrendsStub(kpis);
    assert.deepEqual(kpis, snapshot);
  });
});

describe('analyticsQuerySchema date filters', () => {
  it('parses explicit ISO start and end dates', () => {
    const parsed = analyticsQuerySchema.parse({
      from: '2025-05-01T00:00:00.000Z',
      to: '2025-05-30T00:00:00.000Z',
    });
    assert.ok(parsed.from instanceof Date);
    assert.ok(parsed.to instanceof Date);
    assert.equal(parsed.from.toISOString(), '2025-05-01T00:00:00.000Z');
    assert.equal(parsed.to.toISOString(), '2025-05-30T00:00:00.000Z');
  });

  it('accepts date-only strings as Date instances (UTC midnight for YYYY-MM-DD)', () => {
    const parsed = analyticsQuerySchema.parse({
      from: '2025-05-01',
      to: '2025-05-30',
    });
    assert.equal(parsed.from.toISOString(), '2025-05-01T00:00:00.000Z');
    assert.equal(parsed.to.toISOString(), '2025-05-30T00:00:00.000Z');
  });

  it('allows empty / missing optional date filters', () => {
    const parsed = analyticsQuerySchema.parse({});
    assert.equal(parsed.from, undefined);
    assert.equal(parsed.to, undefined);
  });

  it('drops invalid date strings instead of throwing', () => {
    const parsed = analyticsQuerySchema.parse({
      from: 'not-a-date',
      to: 'also-bad',
    });
    assert.equal(parsed.from, undefined);
    assert.equal(parsed.to, undefined);
  });

  it('does not reject end before start (current contract allows it)', () => {
    const parsed = analyticsQuerySchema.parse({
      from: '2025-06-01T00:00:00.000Z',
      to: '2025-05-01T00:00:00.000Z',
    });
    assert.ok(parsed.from > parsed.to);
  });

  it('accepts only from or only to', () => {
    const fromOnly = analyticsQuerySchema.parse({ from: '2025-05-01T00:00:00.000Z' });
    assert.ok(fromOnly.from instanceof Date);
    assert.equal(fromOnly.to, undefined);

    const toOnly = analyticsQuerySchema.parse({ to: '2025-05-30T00:00:00.000Z' });
    assert.equal(toOnly.from, undefined);
    assert.ok(toOnly.to instanceof Date);
  });

  it('does not mutate the raw query object', () => {
    const raw = { from: '2025-05-01T00:00:00.000Z', to: '2025-05-30T00:00:00.000Z' };
    const before = { ...raw };
    analyticsQuerySchema.parse(raw);
    assert.deepEqual(raw, before);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { safePercent, periodChange, intCount, round } = require('../src/modules/analytics/analytics.percent');
const { resolvePeriod } = require('../src/modules/analytics/analytics.period');
const { resolveAnalyticsScope } = require('../src/modules/analytics/analytics.scope');
const { commandCenterQuerySchema } = require('../src/modules/analytics/analytics.validation');
const { ApiError } = require('../src/utils/apiError');

const UNI = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('analytics.percent', () => {
  it('returns null for zero denominator and never Infinity/NaN', () => {
    assert.equal(safePercent(10, 0), null);
    assert.equal(safePercent(10, null), null);
    assert.equal(safePercent(undefined, 5), null);
    assert.equal(safePercent(1, 4), 25);
  });

  it('previous-period comparison handles new / none / delta', () => {
    assert.equal(periodChange(10, 5).changePercent, 100);
    assert.equal(periodChange(10, 0).kind, 'new');
    assert.equal(periodChange(10, 0).changePercent, null);
    assert.equal(periodChange(0, 0).kind, 'none');
    assert.equal(periodChange(8, 4, { hasPreviousPeriod: false }).kind, 'none');
  });

  it('intCount floors invalid to 0', () => {
    assert.equal(intCount(-1), 0);
    assert.equal(intCount('3.9'), 4);
    assert.equal(round(91.238493, 1), 91.2);
  });
});

describe('analytics.period', () => {
  it('resolves today / 7d / 30d in Asia/Amman with previous window', () => {
    const now = new Date('2026-09-14T12:00:00.000Z');
    const today = resolvePeriod({ period: 'today' }, now);
    assert.equal(today.timezone, 'Asia/Amman');
    assert.equal(today.aggregation, 'hourly');
    assert.ok(today.previousEnd.getTime() === today.periodStart.getTime());
    assert.ok(today.periodEnd.getTime() >= today.periodStart.getTime());

    const d7 = resolvePeriod({ period: '7d' }, now);
    assert.equal(d7.aggregation, 'daily');
    const span = d7.periodEnd - d7.periodStart;
    assert.ok(Math.abs(span - (d7.previousEnd - d7.previousStart)) < 2);

    const d30 = resolvePeriod({ period: '30d' }, now);
    assert.equal(d30.aggregation, 'daily');
  });

  it('rejects inverted or overly long custom ranges', () => {
    assert.throws(
      () => resolvePeriod({ period: 'custom', dateFrom: '2026-09-10', dateTo: '2026-09-01' }),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
    assert.throws(
      () => resolvePeriod({ period: 'custom', dateFrom: '2020-01-01', dateTo: '2026-09-01' }),
      (err) => err instanceof ApiError && err.code === 'ANALYTICS_DATE_RANGE_TOO_LONG'
    );
  });
});

describe('analytics.scope', () => {
  it('super admin may view global or requested university', () => {
    const scope = resolveAnalyticsScope(
      { isGlobal: true, roles: ['super_admin'] },
      { universityId: UNI }
    );
    assert.equal(scope.isGlobal, true);
    assert.equal(scope.universityId, UNI);
    assert.equal(scope.modules.fieldTraining, true);
    assert.equal(scope.modules.systemHealth, true);
  });

  it('university admin is forced to own university and denied another', () => {
    const requester = {
      isGlobal: false,
      roles: ['admin'],
      universityId: UNI,
      organizationId: UNI,
      organizationType: 'UNIVERSITY',
    };
    const own = resolveAnalyticsScope(requester, {});
    assert.equal(own.universityId, UNI);
    assert.equal(own.modules.fieldTraining, true);
    assert.throws(
      () => resolveAnalyticsScope(requester, { universityId: OTHER }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('institution admin cannot see Field Training and cannot switch org', () => {
    const requester = {
      isGlobal: false,
      roles: ['admin'],
      organizationId: OTHER,
      organizationType: 'INSTITUTION',
    };
    const scope = resolveAnalyticsScope(requester, {});
    assert.equal(scope.modules.fieldTraining, false);
    assert.equal(scope.modules.recordedLectures, false);
    assert.equal(scope.modules.trainingPrograms, true);
    assert.throws(
      () => resolveAnalyticsScope(requester, { organizationId: UNI }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('student / instructor cannot access command center', () => {
    assert.throws(
      () => resolveAnalyticsScope({ isGlobal: false, roles: ['student'] }, {}),
      (err) => err.statusCode === 403
    );
    assert.throws(
      () => resolveAnalyticsScope({ isGlobal: false, roles: ['instructor'] }, {}),
      (err) => err.statusCode === 403
    );
    assert.throws(
      () => resolveAnalyticsScope({ isGlobal: false, roles: ['reviewer'], universityId: UNI }, {}),
      (err) => err.statusCode === 403
    );
  });
});

describe('commandCenterQuerySchema', () => {
  it('accepts period and uuid filters', () => {
    const parsed = commandCenterQuerySchema.parse({
      period: '7d',
      organizationId: UNI,
      organizationType: 'UNIVERSITY',
    });
    assert.equal(parsed.period, '7d');
    assert.equal(parsed.organizationId, UNI);
  });

  it('rejects malformed ids', () => {
    const r = commandCenterQuerySchema.safeParse({ organizationId: 'not-a-uuid' });
    assert.equal(r.success, false);
  });
});

describe('field training funnel percentages', () => {
  it('uses applications as cohort denominator', () => {
    const applications = 1240;
    const eligible = 688;
    assert.equal(safePercent(eligible, applications, 0), 55);
    assert.equal(safePercent(0, 0), null);
  });
});

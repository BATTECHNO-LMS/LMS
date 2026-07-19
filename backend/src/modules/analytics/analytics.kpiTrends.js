'use strict';

/**
 * Overview analytics currently stubs period-over-period KPI trends.
 * Public response shape under `kpiTrends`: `{ [kpiKey]: { pct: number } }`.
 *
 * Real previous-period comparison (including any `computePreviousPeriodFilters`
 * helper) was never shipped; `pct` is always `0` until a deliberate product change.
 */
function buildKpiTrendsStub(kpis) {
  return Object.fromEntries(Object.keys(kpis || {}).map((k) => [k, { pct: 0 }]));
}

module.exports = {
  buildKpiTrendsStub,
};

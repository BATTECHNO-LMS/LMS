import * as ph from './analytics.placeholder.js';

/**
 * Empty analytics shell — no fabricated KPIs (default until API exists).
 * @param {object} [filters]
 */
export function buildEmptyAnalyticsPayload(filters = {}) {
  return {
    filters,
    mode: 'empty',
    chartsEnabled: false,
    kpis: null,
    kpiTrends: null,
    universitiesOverview: [],
    enrollmentGrowth: [],
    cohortStatus: [],
    assessmentHealth: [],
    attendanceTrend: [],
    evidenceAnalytics: [],
    qaIntegrityBar: [],
    recognitionFunnel: [],
    certificatesByMonth: [],
    certificatesByUniversity: [],
    certificatesByCredential: [],
    modules: null,
    insightKeys: [],
    alerts: [],
  };
}

/**
 * @param {object} filters — forwarded for future API query params
 */
export async function fetchAnalytics(filters = {}) {
  if (import.meta.env.VITE_ANALYTICS_PLACEHOLDER === 'true') {
    await Promise.resolve();
    return {
      mode: 'demo',
      chartsEnabled: true,
      filters,
      kpis: { ...ph.MOCK_KPIS },
      kpiTrends: { ...ph.MOCK_KPI_TRENDS },
      universitiesOverview: [...ph.MOCK_UNIVERSITIES_OVERVIEW],
      enrollmentGrowth: [...ph.MOCK_ENROLLMENT_GROWTH],
      cohortStatus: [...ph.MOCK_COHORT_STATUS],
      assessmentHealth: [...ph.MOCK_ASSESSMENT_HEALTH],
      attendanceTrend: [...ph.MOCK_ATTENDANCE_TREND],
      evidenceAnalytics: [...ph.MOCK_EVIDENCE_ANALYTICS],
      qaIntegrityBar: [...ph.MOCK_QA_INTEGRITY_BAR],
      recognitionFunnel: [...ph.MOCK_RECOGNITION_FUNNEL],
      certificatesByMonth: [...ph.MOCK_CERTIFICATES_BY_MONTH],
      certificatesByUniversity: [...ph.MOCK_CERTIFICATES_BY_UNIVERSITY],
      certificatesByCredential: [...ph.MOCK_CERTIFICATES_BY_CREDENTIAL],
      modules: JSON.parse(JSON.stringify(ph.MOCK_MODULE_SUMMARIES)),
      insightKeys: [...ph.MOCK_INSIGHT_KEYS],
      alerts: [...ph.MOCK_ALERTS],
    };
  }
  return buildEmptyAnalyticsPayload(filters);
}

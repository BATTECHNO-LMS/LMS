import * as mock from './mockAnalytics.js';

/**
 * Analytics facade — swap implementation for API calls later.
 * @param {object} filters — placeholder for university, track, credential, cohort, timePreset
 */
export async function fetchAnalytics(filters = {}) {
  // Simulate async boundary for future API
  await Promise.resolve();
  return buildAnalyticsPayload(filters);
}

export function buildAnalyticsPayload(filters = {}) {
  return {
    filters,
    kpis: { ...mock.MOCK_KPIS },
    kpiTrends: { ...mock.MOCK_KPI_TRENDS },
    universitiesOverview: [...mock.MOCK_UNIVERSITIES_OVERVIEW],
    enrollmentGrowth: [...mock.MOCK_ENROLLMENT_GROWTH],
    cohortStatus: [...mock.MOCK_COHORT_STATUS],
    assessmentHealth: [...mock.MOCK_ASSESSMENT_HEALTH],
    attendanceTrend: [...mock.MOCK_ATTENDANCE_TREND],
    evidenceAnalytics: [...mock.MOCK_EVIDENCE_ANALYTICS],
    qaIntegrityBar: [...mock.MOCK_QA_INTEGRITY_BAR],
    recognitionFunnel: [...mock.MOCK_RECOGNITION_FUNNEL],
    certificatesByMonth: [...mock.MOCK_CERTIFICATES_BY_MONTH],
    certificatesByUniversity: [...mock.MOCK_CERTIFICATES_BY_UNIVERSITY],
    certificatesByCredential: [...mock.MOCK_CERTIFICATES_BY_CREDENTIAL],
    modules: JSON.parse(JSON.stringify(mock.MOCK_MODULE_SUMMARIES)),
    insightKeys: [...mock.MOCK_INSIGHT_KEYS],
    alerts: [...mock.MOCK_ALERTS],
  };
}

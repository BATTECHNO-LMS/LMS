/**
 * Mock analytics dataset — replace with API via analytics.service.js when backend exists.
 * System-wide (super admin) view; not tenant-filtered in mock.
 */

export const TIME_PRESETS = ['last7', 'last30', 'thisTerm', 'thisYear', 'all'];

/** @typedef {{ id: string; nameAr: string; nameEn: string }} UniRef */

export const MOCK_UNIVERSITIES_REF = [
  { id: 'uni-1', nameAr: 'جامعة اليرموك', nameEn: 'Yarmouk University' },
  { id: 'uni-2', nameAr: 'الجامعة الأردنية', nameEn: 'University of Jordan' },
  { id: 'uni-3', nameAr: 'جامعة الأميرة سمية للتكنولوجيا', nameEn: 'Princess Sumaya University' },
];

export const MOCK_KPIS = {
  universities: 3,
  microCredentials: 24,
  activeCohorts: 18,
  enrolledStudents: 842,
  attendanceRatePct: 91.4,
  delayedAssessments: 14,
  missingEvidence: 9,
  recognitionReady: 7,
  openQaIssues: 11,
  openIntegrityCases: 4,
  certificatesIssued: 312,
  activeUsers: 156,
};

export const MOCK_KPI_TRENDS = {
  universities: { pct: 0 },
  microCredentials: { pct: 4.2 },
  activeCohorts: { pct: -1.1 },
  enrolledStudents: { pct: 6.8 },
  attendanceRatePct: { pct: 0.5 },
  delayedAssessments: { pct: -8 },
  missingEvidence: { pct: -12 },
  recognitionReady: { pct: 3 },
  openQaIssues: { pct: -5 },
  openIntegrityCases: { pct: 0 },
  certificatesIssued: { pct: 12 },
  activeUsers: { pct: 2.1 },
};

/** Stacked/grouped bar: cohorts, students, recognition per university */
export const MOCK_UNIVERSITIES_OVERVIEW = MOCK_UNIVERSITIES_REF.map((u, i) => ({
  ...u,
  cohorts: [8, 6, 4][i],
  students: [380, 290, 172][i],
  recognitionRequests: [12, 9, 6][i],
}));

export const MOCK_ENROLLMENT_GROWTH = [
  { monthKey: '2025-09', enrollments: 120 },
  { monthKey: '2025-10', enrollments: 145 },
  { monthKey: '2025-11', enrollments: 168 },
  { monthKey: '2025-12', enrollments: 190 },
  { monthKey: '2026-01', enrollments: 210 },
  { monthKey: '2026-02', enrollments: 235 },
  { monthKey: '2026-03', enrollments: 268 },
  { monthKey: '2026-04', enrollments: 290 },
];

/** Cohort status distribution */
export const MOCK_COHORT_STATUS = [
  { statusKey: 'planned', count: 5, fill: '#9ca3af' },
  { statusKey: 'openEnrollment', count: 3, fill: '#60a5fa' },
  { statusKey: 'active', count: 18, fill: '#6a73fa' },
  { statusKey: 'completed', count: 12, fill: '#34d399' },
  { statusKey: 'closed', count: 4, fill: '#a78bfa' },
  { statusKey: 'cancelled', count: 1, fill: '#f87171' },
];

export const MOCK_ASSESSMENT_HEALTH = [
  { key: 'total', value: 186 },
  { key: 'pendingGrading', value: 42 },
  { key: 'overdue', value: 14 },
  { key: 'graded', value: 130 },
];

export const MOCK_ATTENDANCE_TREND = [
  { weekKey: 'W1', rate: 88.2, present: 720, absent: 96 },
  { weekKey: 'W2', rate: 89.5, present: 735, absent: 81 },
  { weekKey: 'W3', rate: 90.1, present: 742, absent: 74 },
  { weekKey: 'W4', rate: 91.4, present: 751, absent: 65 },
];

export const MOCK_EVIDENCE_ANALYTICS = [
  { key: 'complete', value: 142, fill: '#34d399' },
  { key: 'missing', value: 9, fill: '#f87171' },
  { key: 'doc', value: 98, fill: '#6a73fa' },
  { key: 'media', value: 44, fill: '#673bb7' },
];

export const MOCK_QA_INTEGRITY_BAR = [
  { key: 'openQa', value: 11 },
  { key: 'correctiveProgress', value: 6 },
  { key: 'riskCases', value: 19 },
  { key: 'integrityCases', value: 4 },
];

export const MOCK_RECOGNITION_FUNNEL = [
  { statusKey: 'draft', count: 4 },
  { statusKey: 'inPreparation', count: 6 },
  { statusKey: 'readyForSubmission', count: 7 },
  { statusKey: 'submitted', count: 5 },
  { statusKey: 'underReview', count: 8 },
  { statusKey: 'approved', count: 14 },
  { statusKey: 'rejected', count: 2 },
  { statusKey: 'needsRevision', count: 3 },
];

export const MOCK_CERTIFICATES_BY_MONTH = [
  { monthKey: '2026-01', count: 28 },
  { monthKey: '2026-02', count: 34 },
  { monthKey: '2026-03', count: 41 },
  { monthKey: '2026-04', count: 38 },
];

export const MOCK_CERTIFICATES_BY_UNIVERSITY = MOCK_UNIVERSITIES_REF.map((u, i) => ({
  ...u,
  count: [140, 98, 74][i],
}));

export const MOCK_CERTIFICATES_BY_CREDENTIAL = [
  { nameAr: 'أساسيات الذكاء الاصطناعي', nameEn: 'AI fundamentals', count: 86 },
  { nameAr: 'أمن المعلومات', nameEn: 'Information security', count: 72 },
  { nameAr: 'تحليل الأعمال', nameEn: 'Business analysis', count: 54 },
];

export const MOCK_MODULE_SUMMARIES = {
  users: {
    total: 420,
    active: 156,
    byRole: [
      { roleKey: 'instructor', count: 48 },
      { roleKey: 'student', count: 280 },
      { roleKey: 'reviewer', count: 12 },
      { roleKey: 'admin', count: 80 },
    ],
    recentAdds: 9,
  },
  universities: { total: 3, activePartnerships: 3, topActivityNameAr: 'جامعة اليرموك', topActivityNameEn: 'Yarmouk University' },
  tracks: { total: 14, topActiveAr: 'مسار تحليل البيانات', topActiveEn: 'Data analysis track' },
  microCredentials: { total: 24, active: 20, archived: 4, topDeliveredAr: 'أساسيات الذكاء الاصطناعي', topDeliveredEn: 'AI fundamentals' },
  cohorts: {
    total: 43,
    active: 18,
    completed: 12,
    byUniversity: MOCK_UNIVERSITIES_OVERVIEW.map((u) => ({
      id: u.id,
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      count: u.cohorts,
    })),
  },
  sessions: { total: 512, documented: 468, undocumented: 44 },
  attendance: { overallRate: 91.4, lowAttendanceCohorts: 3, hotspotAr: 'دفعة خريف 2025 — أردنية', hotspotEn: 'Fall 2025 cohort — UJ' },
  assessments: { total: 186, pendingGrading: 42, overdue: 14, topTypes: ['quiz', 'assignment', 'lab'] },
  rubrics: { total: 38, usageRatePct: 82 },
  submissions: { total: 1240, onTime: 980, late: 260 },
  grades: { completionRatePct: 88, avgScore: 76.4, pass: 1080, fail: 160 },
  evidence: { totalFiles: 151, missing: 9, completionRatePct: 94 },
  qa: { totalReviews: 64, openCases: 11, unresolvedCorrective: 5 },
  riskCases: { totalAtRisk: 27, trendKey: 'stable' },
  integrityCases: { total: 12, underInvestigation: 4, resolved: 8 },
  recognition: { total: 49, readyForSubmission: 7, approvedRatePct: 68 },
  certificates: { totalIssued: 312, issuedThisMonth: 38, byUniversity: MOCK_CERTIFICATES_BY_UNIVERSITY, byCredential: MOCK_CERTIFICATES_BY_CREDENTIAL },
  reportsAudit: { reportsGeneratedPlaceholder: 124, sensitiveActivitiesPlaceholder: 18 },
};

export const MOCK_INSIGHT_KEYS = [
  { key: 'topUniversity', params: { name: 'جامعة اليرموك' } },
  { key: 'topTrack', params: { name: 'مسار تحليل البيانات' } },
  { key: 'lowAttendance', params: { name: 'دفعة خريف 2025 — أردنية' } },
  { key: 'criticalLateAssessments', params: { count: 14 } },
  { key: 'recognitionReady', params: { count: 7 } },
];

export const MOCK_ALERTS = [
  { severity: 'warning', key: 'missingEvidence', params: { count: 9 } },
  { severity: 'danger', key: 'integrityOpen', params: { count: 4 } },
  { severity: 'warning', key: 'qaOpen', params: { count: 11 } },
  { severity: 'warning', key: 'assessmentsLate', params: { count: 14 } },
];

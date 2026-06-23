const landingStatsRepository = require('./landingStats.repository');

/**
 * Run a metric query; return fallback on failure so one bad query does not break the endpoint.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function safeMetric(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Aggregate public landing metrics (no PII).
 * Increments homepage visits once per API request.
 */
async function getLandingStats() {
  const [
    visitsCount,
    usersCount,
    universitiesCount,
    microCredentialsCount,
    cohortsCount,
    assessmentsCount,
    certificatesCount,
    issuedCertificatesCount,
    attendanceRate,
    sessionsThisWeekCount,
    openAssessmentsCount,
    qaCompletionRate,
  ] = await Promise.all([
    safeMetric(() => landingStatsRepository.incrementLandingVisits(), 0),
    safeMetric(() => landingStatsRepository.countUsers(), 0),
    safeMetric(() => landingStatsRepository.countUniversities(), 0),
    safeMetric(() => landingStatsRepository.countMicroCredentials(), 0),
    safeMetric(() => landingStatsRepository.countCohorts(), 0),
    safeMetric(() => landingStatsRepository.countAssessments(), 0),
    safeMetric(() => landingStatsRepository.countCertificates(), 0),
    safeMetric(() => landingStatsRepository.countIssuedCertificates(), 0),
    safeMetric(() => landingStatsRepository.getAttendanceRate(), 0),
    safeMetric(() => landingStatsRepository.countSessionsThisWeek(), 0),
    safeMetric(() => landingStatsRepository.countOpenAssessments(), 0),
    safeMetric(() => landingStatsRepository.getQaCompletionRate(), 0),
  ]);

  return {
    usersCount,
    visitsCount,
    universitiesCount,
    microCredentialsCount,
    cohortsCount,
    assessmentsCount,
    certificatesCount,
    attendanceRate,
    sessionsThisWeekCount,
    openAssessmentsCount,
    issuedCertificatesCount,
    activePrograms: [
      {
        label: 'تحليل البيانات التعليمية',
        progress: attendanceRate,
      },
      {
        label: 'إدارة الجودة الأكاديمية',
        progress: qaCompletionRate,
      },
    ],
  };
}

module.exports = { getLandingStats };

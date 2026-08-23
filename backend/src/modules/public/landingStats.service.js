const landingStatsRepository = require('./landingStats.repository');

const LANDING_STATS_TTL_MS = 60_000;

let landingStatsCache = { expiresAt: 0, payload: null };

function _resetLandingStatsCache() {
  landingStatsCache = { expiresAt: 0, payload: null };
}

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

function bumpCachedVisits() {
  if (!landingStatsCache.payload) return;
  landingStatsCache.payload = {
    ...landingStatsCache.payload,
    visitsCount: Number(landingStatsCache.payload.visitsCount || 0) + 1,
  };
}

/**
 * Aggregate public landing metrics (no PII).
 * Increments homepage visits once per API request.
 * Metric queries are cached for 60s so the homepage does not hit Neon 12 times per view.
 *
 * @param {typeof landingStatsRepository} [repository]
 */
async function getLandingStats(repository = landingStatsRepository) {
  const now = Date.now();
  if (landingStatsCache.payload && now < landingStatsCache.expiresAt) {
    bumpCachedVisits();
    repository.incrementLandingVisits().catch(() => {});
    return { ...landingStatsCache.payload };
  }

  const [
    visitsCount,
    usersCount,
    universitiesCount,
    microCredentialsCount,
    cohortsCount,
    assessmentsCount,
    certificatesCount,
    attendanceRate,
    sessionsThisWeekCount,
    openAssessmentsCount,
  ] = await Promise.all([
    safeMetric(() => repository.incrementLandingVisits(), 0),
    safeMetric(() => repository.countUsers(), 0),
    safeMetric(() => repository.countUniversities(), 0),
    safeMetric(() => repository.countMicroCredentials(), 0),
    safeMetric(() => repository.countCohorts(), 0),
    safeMetric(() => repository.countAssessments(), 0),
    safeMetric(() => repository.countCertificates(), 0),
    safeMetric(() => repository.getAttendanceRate(), 0),
    safeMetric(() => repository.countSessionsThisWeek(), 0),
    safeMetric(() => repository.countOpenAssessments(), 0),
  ]);

  const credentialRate =
    microCredentialsCount > 0
      ? Math.min(100, Math.round((certificatesCount / microCredentialsCount) * 100))
      : 0;

  const payload = {
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
    issuedCertificatesCount: certificatesCount,
    activePrograms: [
      {
        label: 'الدورات التدريبية',
        progress: attendanceRate,
      },
      {
        label: 'الشهادات المصغرة',
        progress: credentialRate,
      },
    ],
  };

  landingStatsCache = { expiresAt: now + LANDING_STATS_TTL_MS, payload };
  return { ...payload };
}

module.exports = {
  getLandingStats,
  _resetLandingStatsCache,
  LANDING_STATS_TTL_MS,
};

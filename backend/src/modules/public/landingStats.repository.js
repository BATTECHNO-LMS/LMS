const { prisma } = require('../../config/db');

const LANDING_VISITS_KEY = 'landing_page_visits';

/**
 * Atomically increment homepage visit counter in system_settings.
 * @returns {Promise<number>}
 */
async function incrementLandingVisits() {
  const rows = await prisma.$queryRaw`
    INSERT INTO system_settings (id, setting_key, setting_value, created_at, updated_at)
    VALUES (gen_random_uuid(), ${LANDING_VISITS_KEY}, '1'::jsonb, NOW(), NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = to_jsonb(COALESCE((system_settings.setting_value #>> '{}')::bigint, 0) + 1),
      updated_at = NOW()
    RETURNING (setting_value #>> '{}')::int AS count
  `;
  return Number(rows[0]?.count ?? 1);
}

/** @returns {Promise<number>} */
async function countUsers() {
  return prisma.users.count({ where: { status: 'active' } });
}

/** @returns {Promise<number>} */
async function countUniversities() {
  return prisma.universities.count({ where: { status: 'active' } });
}

/** @returns {Promise<number>} */
async function countMicroCredentials() {
  return prisma.micro_credentials.count();
}

/** @returns {Promise<number>} */
async function countCohorts() {
  return prisma.cohorts.count();
}

/** @returns {Promise<number>} */
async function countAssessments() {
  return prisma.assessments.count();
}

/** @returns {Promise<number>} */
async function countCertificates() {
  return prisma.certificates.count({ where: { status: 'issued' } });
}

/** @returns {Promise<number>} */
async function countIssuedCertificates() {
  return prisma.certificates.count({ where: { status: 'issued' } });
}

/**
 * Present + late records / total attendance records × 100 (rounded).
 * @returns {Promise<number>}
 */
async function getAttendanceRate() {
  const [attendedCount, totalCount] = await Promise.all([
    prisma.attendance_records.count({
      where: { attendance_status: { in: ['present', 'late'] } },
    }),
    prisma.attendance_records.count(),
  ]);

  if (totalCount === 0) return 0;
  return Math.round((attendedCount / totalCount) * 100);
}

/**
 * Sessions with session_date in the current calendar week (Mon–Sun, server local time).
 * @returns {Promise<number>}
 */
async function countSessionsThisWeek() {
  const { weekStart, weekEnd } = getCurrentWeekBounds();
  return prisma.sessions.count({
    where: {
      session_date: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
  });
}

/**
 * Assessments currently open for students (published or open status).
 * @returns {Promise<number>}
 */
async function countOpenAssessments() {
  return prisma.assessments.count({
    where: { status: { in: ['open', 'published'] } },
  });
}

/**
 * QA reviews marked resolved or closed / total reviews × 100 (rounded).
 * @returns {Promise<number>}
 */
async function getQaCompletionRate() {
  const [completedCount, totalCount] = await Promise.all([
    prisma.qa_reviews.count({ where: { status: { in: ['resolved', 'closed'] } } }),
    prisma.qa_reviews.count(),
  ]);

  if (totalCount === 0) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

function getCurrentWeekBounds() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

module.exports = {
  incrementLandingVisits,
  countUsers,
  countUniversities,
  countMicroCredentials,
  countCohorts,
  countAssessments,
  countCertificates,
  countIssuedCertificates,
  getAttendanceRate,
  countSessionsThisWeek,
  countOpenAssessments,
  getQaCompletionRate,
};

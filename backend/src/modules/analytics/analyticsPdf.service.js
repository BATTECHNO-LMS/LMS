const fs = require('fs');
const path = require('path');
const analyticsService = require('./analytics.service');
const repo = require('./analytics.repository');
const { buildAnalyticsReportHtml } = require('./analyticsReport.template');
const { renderHtmlToPdf } = require('./pdfRenderer');
const { prisma } = require('../../config/db');

function loadLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../../../../frontend/src/assets/images/battechno-lms-logo-transparent.png'),
    path.join(__dirname, '../../../assets/battechno-lms-logo-transparent.png'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function resolveUniversityName(universityId) {
  if (!universityId) return null;
  const row = await prisma.universities.findUnique({
    where: { id: universityId },
    select: { name: true },
  });
  return row?.name ?? null;
}

async function resolveGeneratorProfile(userId) {
  if (!userId) return { name: null, role: null };
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { full_name: true, email: true },
  });
  if (!user) return { name: null, role: null };
  const userRoles = await prisma.user_roles.findMany({
    where: { user_id: userId },
    select: { role_id: true },
  });
  const roleIds = userRoles.map((r) => r.role_id);
  const roleRows = roleIds.length
    ? await prisma.roles.findMany({ where: { id: { in: roleIds } }, select: { code: true, name: true } })
    : [];
  const primaryRole = roleRows[0]?.name || roleRows[0]?.code || null;
  return { name: user.full_name || user.email, role: primaryRole };
}

function buildFilename(lang) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `BATTECHNO-LMS-Analytics-Report-${stamp}.pdf`;
}

/**
 * @param {import('./analytics.validation').AnalyticsFilters} filters
 * @param {{ userId?: string }} authUser
 * @param {'ar'|'en'} [lang]
 */
async function generateAnalyticsPdf(filters, authUser = {}, lang = 'ar') {
  const safeLang = lang === 'en' ? 'en' : 'ar';

  const [overview, universitiesReport, enrollmentStatus, fieldTraining, generator] = await Promise.all([
    analyticsService.getOverviewAnalytics(filters),
    repo.getUniversitiesReportRows(filters),
    repo.getEnrollmentStatusDistribution(filters),
    repo.getFieldTrainingAnalytics(filters),
    resolveGeneratorProfile(authUser.userId),
  ]);

  const universityScopeName = filters.university_id
    ? await resolveUniversityName(filters.university_id)
    : null;

  const attendanceFull = await repo.getAttendanceAnalytics(filters);
  const certificatesFull = await repo.getCertificatesAnalytics(filters);

  if (attendanceFull.lowAttendanceCohorts?.length) {
    const cohortIds = attendanceFull.lowAttendanceCohorts.map((r) => r.cohort_id);
    const cohortRows = await prisma.cohorts.findMany({
      where: { id: { in: cohortIds } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(cohortRows.map((c) => [c.id, c.title]));
    attendanceFull.lowAttendanceCohorts = attendanceFull.lowAttendanceCohorts.map((r) => ({
      ...r,
      cohortTitle: titleMap.get(r.cohort_id) || r.cohort_id,
    }));
  }

  const html = buildAnalyticsReportHtml({
    lang: safeLang,
    logoDataUri: loadLogoDataUri(),
    generatedAt: new Date(),
    generator,
    filters,
    universityScopeName,
    overview,
    universitiesReport,
    enrollmentStatus,
    attendance: attendanceFull,
    certificates: certificatesFull,
    fieldTraining,
  });

  const buffer = await renderHtmlToPdf(html, { lang: safeLang });
  return {
    buffer,
    filename: buildFilename(safeLang),
  };
}

module.exports = { generateAnalyticsPdf };

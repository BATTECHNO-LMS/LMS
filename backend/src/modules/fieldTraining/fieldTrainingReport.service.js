const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { resolveUniversityIdFilter, isSystemWideAdmin } = require('../../utils/universityScope');
const ftAccess = require('./fieldTraining.access');
const reportAccess = require('./fieldTrainingReport.access');
const repo = require('./fieldTraining.repository');
const reportRepo = require('./fieldTrainingReport.repository');
const { renderStudentReportHtml, renderUniversityReportHtml, renderGlobalReportHtml } = require('./fieldTrainingReport.template');
const { exportStudentReportExcel, exportUniversityReportExcel } = require('./fieldTrainingReport.excel');
const { exportGlobalReportExcel } = require('./fieldTrainingGlobalReport.excel');
const globalReportRepo = require('./fieldTrainingGlobalReport.repository');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { loadBattechnoLogoDataUri, loadInstitutionLogoDataUri } = require('../trainingPrograms/trainingReportPdf.service');
const dates = require('./fieldTrainingReport.dates');
const crypto = require('crypto');

function scopeUniversityId(user, requestedUniversityId) {
  if (isSystemWideAdmin(user)) {
    return resolveUniversityIdFilter(user, requestedUniversityId);
  }
  const scoped = resolveUniversityIdFilter(user, requestedUniversityId);
  if (scoped) return scoped;
  return user?.universityId || null;
}

function canReadFieldTrainingReports(user) {
  return Boolean(reportAccess.buildReportCapabilities(user).canViewUniversityReport);
}

function assertStaffReportAccess(user, action = reportAccess.REPORT_ACTIONS.VIEW_REPORT) {
  reportAccess.verifyUniversityFieldTrainingReportAccess({ user, action });
}

function resolveStaffUniversity(user, requestedUniversityId, action) {
  const access = reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId,
    action,
  });
  const universityId = access.universityId;
  if (!universityId) {
    throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  }
  return { universityId, capabilities: access.capabilities };
}

function makeReportReference(reportType, code) {
  const prefix = String(code || 'FT').replace(/[^A-Za-z0-9-]/g, '').slice(0, 16) || 'FT';
  const year = new Date().getFullYear();
  const seq = crypto.randomBytes(3).toString('hex').toUpperCase();
  const kind = String(reportType || 'RPT').slice(0, 3).toUpperCase();
  return `${prefix}-${kind}-${year}-${seq}`;
}

function generatedByName(user) {
  return user?.fullName || user?.full_name || user?.email || null;
}

function attachReportMeta(report, user, extra = {}) {
  const generatedAt = extra.generatedAt || new Date();
  return {
    ...report,
    meta: {
      generated_at: generatedAt.toISOString(),
      generated_at_label: dates.formatReportDateTime(generatedAt),
      generated_by: user?.userId || null,
      generated_by_name: generatedByName(user),
      version: extra.version || 1,
      reference: extra.reference || makeReportReference(report.report_type, report.university?.code || report.student?.university?.code),
      status: 'READY',
      timezone: dates.REPORT_TZ,
    },
  };
}

async function loadFieldTrainingBrandAssets(university) {
  return {
    battechnoLogoDataUri: loadBattechnoLogoDataUri(),
    universityLogoDataUri: await loadInstitutionLogoDataUri(university?.logo_url || null),
  };
}

async function assertStudentReportAccess(
  user,
  applicationId,
  action = reportAccess.REPORT_ACTIONS.VIEW_REPORT
) {
  const ctx = await reportRepo.loadApplicationReportContext(applicationId);
  if (!ctx?.app) throw new ApiError(404, 'Application not found');
  if (!ctx.opp) throw new ApiError(404, 'Opportunity not found');
  const { app, opp } = ctx;

  const roles = ftAccess.normalizeRoles(user);

  if (roles.includes('student')) {
    if (!studentOwnsApplication(user, app)) {
      throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
    }
    return { app, opp, viewer: 'student' };
  }

  if (ftAccess.isAssignedInstructor(user, opp)) {
    return { app, opp, viewer: 'instructor' };
  }

  const requestedUniversityId = opp.university_id || opp.universities?.id || null;
  const student = await prisma.users.findUnique({
    where: { id: app.student_id },
    select: { primary_university_id: true },
  });
  const universityId = student?.primary_university_id || requestedUniversityId;

  const access = reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: universityId,
    action,
  });

  if (reportAccess.isReportSuperAdmin(user)) {
    return { app, opp, viewer: 'staff', capabilities: access.capabilities };
  }

  await ftAccess.assertApplicationStudentAccess(user, app.student_id);
  return {
    app,
    opp,
    viewer: access.capabilities.readOnly ? 'reviewer' : 'staff',
    capabilities: access.capabilities,
  };
}

async function getDashboard(user, query = {}) {
  const { universityId, capabilities } = resolveStaffUniversity(
    user,
    query.university_id,
    reportAccess.REPORT_ACTIONS.VIEW_REPORT
  );

  const dashboard = await reportRepo.buildUniversityDashboard(universityId, query);
  const university = await reportRepo.loadUniversity(universityId);

  const studentIds = await prisma.users.findMany({
    where: { primary_university_id: universityId },
    select: { id: true },
  });
  const ids = studentIds.map((row) => row.id);

  const recentApplications = ids.length
    ? await prisma.field_training_applications.findMany({
        where: { student_id: { in: ids } },
        orderBy: { created_at: 'desc' },
        take: 8,
        include: {
          field_training_opportunities: { select: { id: true, title: true } },
        },
      })
    : [];

  const profileById = Object.fromEntries(
    (await repo.findStudentProfilesByIds([...new Set(recentApplications.map((row) => row.student_id))])).map(
      (profile) => [profile.id, profile]
    )
  );

  return {
    university,
    ...dashboard,
    capabilities,
    recent_applications: recentApplications.map((row) => ({
      id: row.id,
      student_name: profileById[row.student_id]?.full_name ?? null,
      student_email: profileById[row.student_id]?.email ?? null,
      opportunity_id: row.opportunity_id,
      opportunity_title: row.field_training_opportunities?.title ?? null,
      status: row.status,
      training_status: row.training_status,
      created_at: row.created_at,
    })),
  };
}

async function getUniversityReport(user, query = {}, action = reportAccess.REPORT_ACTIONS.VIEW_REPORT) {
  const { universityId, capabilities } = resolveStaffUniversity(user, query.university_id, action);
  const report = await reportRepo.buildUniversityReport(universityId, query);
  if (!report) throw new ApiError(404, 'University not found');
  return { ...attachReportMeta(report, user), capabilities };
}

async function listUniversityApplications(user, query = {}) {
  const { universityId, capabilities } = resolveStaffUniversity(
    user,
    query.university_id,
    reportAccess.REPORT_ACTIONS.VIEW_REPORT
  );
  const report = await reportRepo.buildUniversityReport(universityId, query);
  return {
    university: report.university,
    students: report.students,
    summary: report.summary,
    capabilities,
  };
}

async function getStudentReport(user, applicationId, action = reportAccess.REPORT_ACTIONS.VIEW_REPORT) {
  const access = await assertStudentReportAccess(user, applicationId, action);
  const report = await reportRepo.buildStudentDetailedReport(applicationId, {
    exposeAiAudit: false,
    app: access.app,
    opp: access.opp,
  });
  if (!report) throw new ApiError(404, 'Application not found');
  const capabilities = access.capabilities || reportAccess.buildReportCapabilities(user);
  return { ...attachReportMeta(report, user), capabilities };
}

function asciiDownloadSlug(value, fallback) {
  const cleaned = String(value || '')
    .normalize('NFKC')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return cleaned || fallback;
}

async function exportUniversityReport(user, query = {}, format = 'pdf') {
  try {
    return await exportUniversityReportInner(user, query, format);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'تعذر تصدير تقرير الجامعة', { reason: err?.message }, 'REPORT_EXPORT_FAILED');
  }
}

async function exportUniversityReportInner(user, query = {}, format = 'pdf') {
  const report = await getUniversityReport(user, query, reportAccess.REPORT_ACTIONS.EXPORT_REPORT);
  const stamp = dates.formatReportDate(new Date()) || 'report';
  const uniSlug = asciiDownloadSlug(report.university?.code || report.university?.name_en, 'university');

  if (format === 'xlsx' || format === 'excel') {
    const buffer = await exportUniversityReportExcel(report, {
      includeRawData: Boolean(report.capabilities?.includeRawExcel),
    });
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `field-training-university-report-${uniSlug}-${stamp}.xlsx`,
    };
  }

  const assets = await loadFieldTrainingBrandAssets(report.university);
  const html = renderUniversityReportHtml(report, assets);
  const buffer = await renderHtmlToPdf(html, {
    lang: 'ar',
    footerLeft: `BATTECHNO LMS · ${report.meta?.reference || ''} · v${report.meta?.version || 1}`,
    footerNote: report.meta?.generated_at_label || '',
  });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `field-training-university-report-${uniSlug}-${stamp}.pdf`,
  };
}

async function exportStudentReport(user, applicationId, format = 'pdf') {
  try {
    return await exportStudentReportInner(user, applicationId, format);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'تعذر تصدير تقرير الطالب', { reason: err?.message }, 'REPORT_EXPORT_FAILED');
  }
}

async function exportStudentReportInner(user, applicationId, format = 'pdf') {
  const report = await getStudentReport(user, applicationId, reportAccess.REPORT_ACTIONS.EXPORT_REPORT);
  const stamp = dates.formatReportDate(new Date()) || 'report';
  const nameSlug = asciiDownloadSlug(report.student?.full_name, applicationId.slice(0, 8));

  if (format === 'xlsx' || format === 'excel') {
    const buffer = await exportStudentReportExcel(report);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `field-training-student-report-${nameSlug}-${stamp}.xlsx`,
    };
  }

  const assets = await loadFieldTrainingBrandAssets(report.student?.university);
  const html = renderStudentReportHtml(report, assets);
  const buffer = await renderHtmlToPdf(html, {
    lang: 'ar',
    footerLeft: `BATTECHNO LMS · ${report.meta?.reference || ''} · v${report.meta?.version || 1}`,
    footerNote: report.meta?.generated_at_label || '',
  });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `field-training-student-report-${nameSlug}-${stamp}.pdf`,
  };
}

function assertGlobalReportAccess(user) {
  if (isSystemWideAdmin(user)) return;
  throw new ApiError(403, 'غير مصرح بالوصول إلى التقرير الشامل', null, 'FIELD_TRAINING_FORBIDDEN');
}

const ACADEMIC_UNIVERSITY_REQUIRED_MSG =
  'لم يتم ربط حساب المراجع الأكاديمي بجامعة. يرجى التواصل مع الإدارة.';

function deriveAcademicUniversityId(user) {
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(400, ACADEMIC_UNIVERSITY_REQUIRED_MSG, null, 'UNIVERSITY_REQUIRED');
  }
  return uni;
}

function withAcademicUniversity(user, query = {}) {
  const university_id = deriveAcademicUniversityId(user);
  if (query.university_id && String(query.university_id) !== String(university_id)) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى بيانات جامعة أخرى', null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
  return { ...query, university_id };
}

async function getGlobalReport(user, query = {}) {
  assertGlobalReportAccess(user);
  return globalReportRepo.buildGlobalReport(query);
}

async function exportGlobalReport(user, query = {}, format = 'pdf') {
  const report = await getGlobalReport(user, query);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'xlsx' || format === 'excel') {
    const buffer = await exportGlobalReportExcel(report);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `field-training-global-report-${stamp}.xlsx`,
    };
  }

  const html = renderGlobalReportHtml(report);
  const buffer = await renderHtmlToPdf(html, { lang: 'ar' });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `field-training-global-report-${stamp}.pdf`,
  };
}

async function generateUniversityReport(user, query = {}) {
  return getUniversityReport(user, query, reportAccess.REPORT_ACTIONS.GENERATE_REPORT);
}

async function generateStudentReport(user, applicationId) {
  return getStudentReport(user, applicationId, reportAccess.REPORT_ACTIONS.GENERATE_REPORT);
}

async function getAcademicDashboard(user, query = {}) {
  return getDashboard(user, withAcademicUniversity(user, query));
}

async function getAcademicUniversityReport(user, query = {}) {
  return getUniversityReport(user, withAcademicUniversity(user, query));
}

async function listAcademicStudents(user, query = {}) {
  return listUniversityApplications(user, withAcademicUniversity(user, query));
}

async function listAcademicOpportunities(user, query = {}) {
  assertStaffReportAccess(user);
  const scoped = withAcademicUniversity(user, query);
  const opportunities = await reportRepo.listUniversityEligibleOpportunities(scoped.university_id, scoped);
  return {
    university_id: scoped.university_id,
    university: await reportRepo.loadUniversity(scoped.university_id),
    opportunities,
  };
}

async function getAcademicOpportunity(user, opportunityId, query = {}) {
  assertStaffReportAccess(user);
  const scoped = withAcademicUniversity(user, query);
  const detail = await reportRepo.getUniversityOpportunityDetail(scoped.university_id, opportunityId);
  if (!detail) {
    throw new ApiError(404, 'الفرصة غير موجودة أو غير مرتبطة بجامعتك', null, 'FIELD_TRAINING_NOT_FOUND');
  }
  return detail;
}

async function getAcademicStudentReport(user, applicationId) {
  const universityId = deriveAcademicUniversityId(user);
  const { app } = await assertStudentReportAccess(user, applicationId);
  const student = await prisma.users.findUnique({
    where: { id: app.student_id },
    select: { primary_university_id: true },
  });
  if (String(student?.primary_university_id || '') !== String(universityId)) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى بيانات جامعة أخرى', null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
  return getStudentReport(user, applicationId);
}

function studentOwnsApplication(user, application) {
  return Boolean(user?.userId) && String(application?.student_id) === String(user.userId);
}

module.exports = {
  getDashboard,
  getUniversityReport,
  listUniversityApplications,
  getStudentReport,
  exportUniversityReport,
  exportStudentReport,
  generateUniversityReport,
  generateStudentReport,
  getGlobalReport,
  exportGlobalReport,
  getAcademicDashboard,
  getAcademicUniversityReport,
  listAcademicStudents,
  listAcademicOpportunities,
  getAcademicOpportunity,
  getAcademicStudentReport,
  withAcademicUniversity,
  ACADEMIC_UNIVERSITY_REQUIRED_MSG,
  assertStaffReportAccess,
  studentOwnsApplication,
  scopeUniversityId,
};

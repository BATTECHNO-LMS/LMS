const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const { resolveUniversityIdFilter, isSystemWideAdmin } = require('../../utils/universityScope');
const ftAccess = require('./fieldTraining.access');
const repo = require('./fieldTraining.repository');
const reportRepo = require('./fieldTrainingReport.repository');
const { renderStudentReportHtml, renderUniversityReportHtml, renderGlobalReportHtml } = require('./fieldTrainingReport.template');
const { exportStudentReportExcel, exportUniversityReportExcel } = require('./fieldTrainingReport.excel');
const { exportGlobalReportExcel } = require('./fieldTrainingGlobalReport.excel');
const globalReportRepo = require('./fieldTrainingGlobalReport.repository');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');

function scopeUniversityId(user, requestedUniversityId) {
  if (isSystemWideAdmin(user)) {
    return resolveUniversityIdFilter(user, requestedUniversityId);
  }
  const scoped = resolveUniversityIdFilter(user, requestedUniversityId);
  if (scoped) return scoped;
  return user?.universityId || null;
}

function canReadFieldTrainingReports(user) {
  const roles = ftAccess.normalizeRoles(user);
  if (isSystemWideAdmin(user)) return true;
  if (roles.some((r) => env.REPORT_READ_ROLE_CODES.includes(r))) return true;
  if (roles.some((r) => env.FIELD_TRAINING_MANAGE_ROLE_CODES.includes(r))) return true;
  return false;
}

function assertStaffReportAccess(user) {
  const roles = ftAccess.normalizeRoles(user);
  if (roles.includes('student')) {
    throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if (!canReadFieldTrainingReports(user)) {
    throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
  }
}

async function assertStudentReportAccess(user, applicationId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');

  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  const roles = ftAccess.normalizeRoles(user);

  if (roles.includes('student')) {
    if (String(app.student_id) !== String(user?.userId)) {
      throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
    }
    return { app, opp };
  }

  if (!canReadFieldTrainingReports(user)) {
    throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
  }

  if (isSystemWideAdmin(user)) return { app, opp };

  if (ftAccess.isAssignedInstructor(user, opp)) return { app, opp };

  // University-scoped report readers (e.g. academic_reviewer): student university match only.
  // Do not require FIELD_TRAINING_ADMIN — reviewers are read-only.
  await ftAccess.assertApplicationStudentAccess(user, app.student_id);
  if (ftAccess.isUniversityScopedFieldTrainingUser(user)) {
    return { app, opp };
  }

  await ftAccess.assertAdminOpportunityAccess(user, opp);

  return { app, opp };
}

async function getDashboard(user, query = {}) {
  assertStaffReportAccess(user);
  const universityId = scopeUniversityId(user, query.university_id);
  if (!universityId) {
    throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  }

  if (!isSystemWideAdmin(user)) {
    ftAccess.assertStudentUniversityAccess(user, universityId);
  }

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

async function getUniversityReport(user, query = {}) {
  assertStaffReportAccess(user);
  const universityId = scopeUniversityId(user, query.university_id);
  if (!universityId) {
    throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  }

  if (!isSystemWideAdmin(user)) {
    ftAccess.assertStudentUniversityAccess(user, universityId);
  }

  const report = await reportRepo.buildUniversityReport(universityId, query);
  if (!report) throw new ApiError(404, 'University not found');
  return report;
}

async function listUniversityApplications(user, query = {}) {
  assertStaffReportAccess(user);
  const universityId = scopeUniversityId(user, query.university_id);
  if (!universityId) {
    throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  }

  if (!isSystemWideAdmin(user)) {
    ftAccess.assertStudentUniversityAccess(user, universityId);
  }

  const report = await reportRepo.buildUniversityReport(universityId, query);
  return {
    university: report.university,
    students: report.students,
    summary: report.summary,
  };
}

async function getStudentReport(user, applicationId) {
  await assertStudentReportAccess(user, applicationId);
  const report = await reportRepo.buildStudentDetailedReport(applicationId);
  if (!report) throw new ApiError(404, 'Application not found');
  return report;
}

async function exportUniversityReport(user, query = {}, format = 'pdf') {
  const report = await getUniversityReport(user, query);
  const stamp = new Date().toISOString().slice(0, 10);
  const uniSlug = report.university?.name?.replace(/\s+/g, '-') ?? 'university';

  if (format === 'xlsx' || format === 'excel') {
    const buffer = await exportUniversityReportExcel(report);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `field-training-university-report-${uniSlug}-${stamp}.xlsx`,
    };
  }

  const html = renderUniversityReportHtml(report);
  const buffer = await renderHtmlToPdf(html, { lang: 'ar' });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `field-training-university-report-${uniSlug}-${stamp}.pdf`,
  };
}

async function exportStudentReport(user, applicationId, format = 'pdf') {
  const report = await getStudentReport(user, applicationId);
  const stamp = new Date().toISOString().slice(0, 10);
  const nameSlug = report.student?.full_name?.replace(/\s+/g, '-') ?? applicationId.slice(0, 8);

  if (format === 'xlsx' || format === 'excel') {
    const buffer = await exportStudentReportExcel(report);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `field-training-student-report-${nameSlug}-${stamp}.xlsx`,
    };
  }

  const html = renderStudentReportHtml(report);
  const buffer = await renderHtmlToPdf(html, { lang: 'ar' });
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

module.exports = {
  getDashboard,
  getUniversityReport,
  listUniversityApplications,
  getStudentReport,
  exportUniversityReport,
  exportStudentReport,
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
};

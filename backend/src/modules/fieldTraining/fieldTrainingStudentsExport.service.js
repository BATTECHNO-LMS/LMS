'use strict';

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const repo = require('./fieldTraining.repository');
const reportAccess = require('./fieldTrainingReport.access');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const { buildApplicationWhere } = require('./fieldTrainingGlobalReport.repository');
const reportRepo = require('./fieldTrainingReport.repository');
const taskProgress = require('./fieldTraining.taskProgress');
const {
  exportFieldTrainingStudentsExcel,
} = require('./fieldTrainingStudentsExcel');

const EMPTY_CODE = 'FIELD_TRAINING_STUDENTS_EXPORT_EMPTY';
const EMPTY_MSG = 'لا يوجد طلاب مطابقون للتصدير';

function throwEmptyExport() {
  throw new ApiError(404, EMPTY_MSG, null, EMPTY_CODE);
}

function resolveStudentsExcelScope(user, requestedUniversityId) {
  return reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: requestedUniversityId || null,
    action: reportAccess.REPORT_ACTIONS.EXPORT_REPORT,
  });
}

function uniqueById(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function matchesSearch(row, search) {
  if (!search) return true;
  const q = String(search).trim().toLowerCase();
  if (!q) return true;
  const hay = [row.student_name, row.student_email, row.opportunity_title, row.specialty_label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function matchesEligibility(rowStatus, filterStatus) {
  if (!filterStatus) return true;
  return String(rowStatus || '') === String(filterStatus);
}

function applyStudentExcelFilters(rows, filters = {}) {
  return rows.filter((row) => {
    if (!matchesEligibility(row.eligibility_status, filters.eligibility_status)) return false;
    if (!matchesSearch(row, filters.search)) return false;
    return reportRepo.matchesExtraFilters(row, filters);
  });
}

function buildExcelSource({ app, profile, opportunity, finalStatus, taskProgress: progress }) {
  return {
    application_id: app.id,
    student_id: app.student_id,
    student_name: profile?.full_name ?? '',
    student_email: profile?.email ?? '',
    specialty_label: repo.formatSpecialtyLabel(profile?.university_specialty || profile?.specialty, ''),
    university_name: profile?.university?.name ?? '',
    opportunity_id: app.opportunity_id,
    opportunity_title: opportunity?.title ?? '',
    training_organization: opportunity?.organization_name ?? '',
    instructor_id: opportunity?.assigned_instructor_id ?? null,
    application_status: app.status,
    status: app.status,
    training_status: app.training_status,
    task_progress: progress || null,
    post_assessment_score:
      app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
    post_assessment_attempt_status: app.post_assessment_attempt_status || null,
    post_assessment_attempt_status_label: app.post_assessment_attempt_status_label || null,
    eligibility_status: app.completion_eligibility_status,
    completion_eligibility_status: app.completion_eligibility_status,
    completed_training_hours:
      app.completed_training_hours != null ? Number(app.completed_training_hours) : 0,
    completion_letter_status: app.completion_letter_issued_at ? 'issued' : 'not_issued',
    submitted_at: app.created_at,
    created_at: app.created_at,
    final_evaluation_status: finalStatus || null,
  };
}

async function loadCurrentFinalStatuses(applicationIds) {
  if (!applicationIds.length) return new Map();
  const rows = await prisma.field_training_final_evaluations.findMany({
    where: {
      application_id: { in: applicationIds },
      is_current: true,
      finalized_at: { not: null },
    },
    select: {
      application_id: true,
      final_status: true,
      generated_at: true,
    },
    orderBy: { generated_at: 'desc' },
  });
  const map = new Map();
  for (const row of rows) {
    if (map.has(row.application_id)) continue;
    if (row.final_status) map.set(row.application_id, row.final_status);
  }
  return map;
}

async function hydrateExcelSources(applications) {
  const apps = uniqueById(applications);
  if (!apps.length) return [];

  const [profiles, opportunities, evalMap, progressByApp, postAttemptByApp] = await Promise.all([
    repo.findStudentProfilesByIds([...new Set(apps.map((app) => app.student_id))]),
    (async () => {
      const opportunityIds = [...new Set(apps.map((app) => app.opportunity_id).filter(Boolean))];
      if (!opportunityIds.length) return [];
      return prisma.field_training_opportunities.findMany({
        where: { id: { in: opportunityIds } },
        select: {
          id: true,
          title: true,
          organization_name: true,
          assigned_instructor_id: true,
          status: true,
        },
      });
    })(),
    loadCurrentFinalStatuses(apps.map((app) => app.id)),
    taskProgress.calculateTaskProgressForApplications(
      apps.map((app) => ({
        id: app.id,
        opportunity_id: app.opportunity_id,
        student_id: app.student_id,
        status: app.status,
      }))
    ),
    require('./fieldTraining.standardizedPostAssessment').loadPostAssessmentAttemptStatusByApplicationIds(
      apps.map((app) => app.id)
    ),
  ]);

  const profileById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const oppById = Object.fromEntries(opportunities.map((opp) => [opp.id, opp]));
  const standardizedPost = require('./fieldTraining.standardizedPostAssessment');

  return apps.map((app) => {
    const postStatus =
      postAttemptByApp.get(app.id) ||
      standardizedPost.resolveAttemptStatus(null, app.post_assessment_score);
    return buildExcelSource({
      app: {
        ...app,
        post_assessment_attempt_status: postStatus.key,
        post_assessment_attempt_status_label: postStatus.label_ar,
      },
      profile: profileById[app.student_id],
      opportunity: oppById[app.opportunity_id],
      finalStatus: evalMap.get(app.id) || null,
      taskProgress: progressByApp.get(app.id) || null,
    });
  });
}

async function collectUniversityStudentSources(universityId, filters = {}) {
  const appWhere = await buildApplicationWhere({
    ...filters,
    university_id: universityId || undefined,
  });
  const applications = await prisma.field_training_applications.findMany({
    where: appWhere,
    orderBy: { created_at: 'desc' },
  });
  const sources = await hydrateExcelSources(applications);
  return applyStudentExcelFilters(sources, filters);
}

function sanitiseExportFilters(query = {}) {
  return {
    university_id: query.university_id || null,
    university_specialty_id: query.university_specialty_id || null,
    opportunity_id: query.opportunity_id || null,
    instructor_id: query.instructor_id || null,
    organization_name: query.organization_name || null,
    student_id: query.student_id || null,
    status: query.status || null,
    training_status: query.training_status || null,
    completion_status: query.completion_status || null,
    certificate_status: query.certificate_status || null,
    eligibility_status: query.eligibility_status || null,
    search: query.search || null,
    from: query.from || null,
    to: query.to || null,
  };
}

async function exportUniversityStudentsExcel(user, query = {}) {
  const access = resolveStudentsExcelScope(user, query.university_id);
  const universityId = access.universityId || null;
  const sources = await collectUniversityStudentSources(universityId, {
    ...query,
    university_id: universityId || undefined,
  });
  if (!sources.length) throwEmptyExport();

  const opportunityTitle =
    query.opportunity_id && sources.length
      ? sources[0].opportunity_title
      : null;

  const file = await exportFieldTrainingStudentsExcel(sources, { opportunityTitle });
  return {
    ...file,
    universityId,
    filters: sanitiseExportFilters({ ...query, university_id: universityId }),
    opportunityId: query.opportunity_id || null,
  };
}

async function exportOpportunityStudentsExcel(user, opportunityId, query = {}) {
  const fieldTrainingService = require('./fieldTraining.service');
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const { applications } = await fieldTrainingService.listOpportunityApplications(
    opportunityId,
    query,
    user
  );
  if (!applications.length) throwEmptyExport();

  const evalMap = await loadCurrentFinalStatuses(applications.map((app) => app.id));
  const sources = uniqueById(applications).map((app) => ({
    application_id: app.id,
    student_id: app.student_id,
    student_name: app.student_name,
    student_email: app.student_email,
    specialty_label:
      app.student_university_specialty_label || app.student_specialty_label || '',
    university_name: app.student_university || '',
    opportunity_title: app.opportunity_title || opp.title || '',
    training_organization: opp.organization_name || '',
    instructor_id: opp.assigned_instructor_id || null,
    application_status: app.status,
    status: app.status,
    training_status: app.training_status,
    task_progress: app.task_progress || null,
    post_assessment_score: app.post_assessment_score ?? null,
    post_assessment_attempt_status: app.post_assessment_attempt_status || null,
    post_assessment_attempt_status_label: app.post_assessment_attempt_status_label || null,
    eligibility_status: app.completion_eligibility_status,
    submitted_at: app.created_at,
    created_at: app.created_at,
    final_evaluation_status: evalMap.get(app.id) || null,
  }));

  if (!sources.length) throwEmptyExport();

  const file = await exportFieldTrainingStudentsExcel(sources, {
    opportunityTitle: opp.title,
  });
  return {
    ...file,
    universityId: user?.universityId || opp.university_id || null,
    filters: sanitiseExportFilters({
      ...query,
      opportunity_id: opportunityId,
    }),
    opportunityId,
  };
}

module.exports = {
  EMPTY_CODE,
  EMPTY_MSG,
  resolveStudentsExcelScope,
  applyStudentExcelFilters,
  buildExcelSource,
  hydrateExcelSources,
  collectUniversityStudentSources,
  exportUniversityStudentsExcel,
  exportOpportunityStudentsExcel,
};

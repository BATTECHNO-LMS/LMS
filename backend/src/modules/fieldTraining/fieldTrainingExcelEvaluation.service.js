'use strict';

const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { getProvider } = require('../../shared/storage/storageProvider');
const filesService = require('../files/files.service');
const hoursMod = require('./fieldTraining.hours');
const ftAccess = require('./fieldTraining.access');
const evalAccess = require('./fieldTrainingEvaluation.access');
const evalService = require('./fieldTrainingEvaluation.service');
const officialPopulation = require('./fieldTrainingEvaluation.officialPopulation');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { resolveStudentDisplayName } = require('./fieldTrainingEvaluation.payload');
const { STORAGE_FOLDER } = require('./fieldTrainingEvaluation.constants');
const {
  XLSX_MIME,
  UNAVAILABLE_AR,
  DEFAULT_TEMPLATE_PATH,
  TEMPLATE_VERSION_DEFAULT,
  SCORE_SOURCE,
} = require('./fieldTrainingExcelEvaluation.constants');
const { buildStudentExcelEvaluation } = require('./fieldTrainingExcelEvaluation.scoring');
const { fillExcelEvaluationWorkbook } = require('./fieldTrainingExcelEvaluation.workbook');

function textOrUnavailable(value) {
  const text = String(value || '').trim();
  if (!text || text === 'undefined' || text === 'null') return UNAVAILABLE_AR;
  return text;
}

function hostOrgOf(opportunity = {}) {
  return opportunity.host_organization && typeof opportunity.host_organization === 'object'
    ? opportunity.host_organization
    : {};
}

function excelTemplateMeta(opportunity = {}) {
  const host = hostOrgOf(opportunity);
  const meta = host.excel_evaluation_template || host.excelEvaluationTemplate || {};
  return {
    fileId: meta.file_id || meta.fileId || null,
    version: meta.version || TEMPLATE_VERSION_DEFAULT,
    name: meta.name || null,
    uploadedAt: meta.uploaded_at || meta.uploadedAt || null,
  };
}

function companyDefaults(opportunity = {}) {
  const host = hostOrgOf(opportunity);
  return {
    organizationName: opportunity.organization_name || host.organization_name || '',
    department: host.department || '',
    phone: host.phone || '',
    email: host.email || '',
    address: host.address || '',
    supervisorName: host.field_supervisor_name || host.contact_person || '',
    supervisorPhone: host.field_supervisor_phone || '',
    supervisorEmail: host.field_supervisor_email || '',
  };
}

function opportunityUniversityName(opportunity = {}) {
  return (
    opportunity.universities?.name ||
    opportunity.universities?.short_name ||
    opportunity.universities?.name_en ||
    opportunity.field_training_opportunity_eligibility?.[0]?.universities?.name ||
    opportunity.field_training_opportunity_eligibility?.[0]?.universities?.short_name ||
    ''
  );
}

async function loadOpportunity(opportunityId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      universities: { select: { id: true, name: true, name_en: true, short_name: true } },
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: {
          university_id: true,
          universities: { select: { id: true, name: true, name_en: true, short_name: true } },
        },
        take: 8,
      },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  return opportunity;
}

async function loadTemplateBuffer(opportunity) {
  const meta = excelTemplateMeta(opportunity);
  if (meta.fileId) {
    const file = await prisma.files.findFirst({ where: { id: meta.fileId, deleted_at: null } });
    if (file) {
      const buffer = await getProvider().getObjectBuffer(file.storage_key);
      return { buffer, meta: { ...meta, name: file.original_name || meta.name }, source: 'uploaded' };
    }
  }
  if (!fs.existsSync(DEFAULT_TEMPLATE_PATH)) {
    throw new ApiError(409, 'قالب تقييم Excel غير موجود.', null, 'EXCEL_EVALUATION_TEMPLATE_MISSING');
  }
  return {
    buffer: fs.readFileSync(DEFAULT_TEMPLATE_PATH),
    meta: {
      fileId: null,
      version: TEMPLATE_VERSION_DEFAULT,
      name: path.basename(DEFAULT_TEMPLATE_PATH),
      uploadedAt: null,
    },
    source: 'bundled',
  };
}

function submittedTaskTitles(ctx, tasksById) {
  const titles = [];
  for (const sub of ctx.submissions || []) {
    const task = tasksById.get(String(sub.task_id));
    if (!task?.title) continue;
    if (sub.review_status === 'rejected') continue;
    titles.push(task.title);
  }
  if (titles.length) return titles;
  return [];
}

function resolveExportCompletedHours(application = {}, scoringInput = {}) {
  if (scoringInput.hoursDataLoaded === true && scoringInput.completedHours != null && scoringInput.completedHours !== '') {
    const n = Number(scoringInput.completedHours);
    if (Number.isFinite(n)) return n;
  }
  const stored = hoursMod.toNullableInt(application.completed_training_hours);
  if (stored != null && stored > 0) return stored;
  if (stored === 0 && (application.hours_updated_at || application.hours_updated_by_id)) return 0;
  const fromScoring = Number(scoringInput.completedHours);
  if (Number.isFinite(fromScoring) && fromScoring > 0) return fromScoring;
  return null;
}

function buildExportRow(ctx, { universityName, defaults, tasksById }) {
  const student = ctx.student || {};
  const application = ctx.application || {};
  const scoringInput = {
    ...ctx.scoringInput,
    completedHours: resolveExportCompletedHours(application, ctx.scoringInput || {}),
  };
  const evaluation = buildStudentExcelEvaluation({
    application,
    opportunity: ctx.opportunity,
    scoringInput,
    performanceSnapshot: ctx.performanceSnapshot,
    supervisorRatings: scoringInput.supervisorRatings,
    taskTitles: submittedTaskTitles(ctx, tasksById),
  });
  const missing = [];
  const studentName = resolveStudentDisplayName(student);
  const universityNumber = resolveOfficialUniversityNumber(student).number;
  if (!studentName) missing.push('student_name');
  if (!universityNumber) missing.push('student_number');
  const supervisorName = textOrUnavailable(defaults.supervisorName);
  const supervisorPhone = textOrUnavailable(defaults.supervisorPhone || defaults.phone);
  const supervisorEmail = textOrUnavailable(defaults.supervisorEmail || defaults.email);
  if (supervisorName === UNAVAILABLE_AR) missing.push('supervisor_name');
  if (!universityName) missing.push('university');
  return {
    applicationId: application.id,
    studentId: student.id,
    studentName: studentName || UNAVAILABLE_AR,
    universityNumber: universityNumber || UNAVAILABLE_AR,
    universityName: universityName || UNAVAILABLE_AR,
    supervisorName,
    supervisorPhone,
    supervisorEmail,
    hours: evaluation.hours,
    ratings: evaluation.ratings,
    status: evaluation.status,
    ineligibilityReason: evaluation.ineligibilityReason,
    generalScore: evaluation.generalScore,
    tasksText: evaluation.tasksText,
    attachment: '',
    eligible: evaluation.eligible,
    usedAdministrativeFallback: evaluation.usedAdministrativeFallback,
    usedPerformanceDerived: evaluation.usedPerformanceDerived,
    usedSupervisorRating: evaluation.usedSupervisorRating,
    missingFields: missing,
    sources: Object.fromEntries(
      Object.entries(evaluation.ratings).map(([key, value]) => [key, value.source])
    ),
  };
}

async function collectOpportunityRows(user, opportunityId) {
  const opportunity = await loadOpportunity(opportunityId);
  evalAccess.assertCanViewReports(user, opportunity.university_id);
  await ftAccess.assertAdminOpportunityAccess(user, opportunity);

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { id: true, student_id: true },
  });
  const { byId } = await evalService.loadBatchContext(apps.map((row) => row.id));
  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId },
    select: { id: true, title: true, sort_order: true },
    orderBy: { sort_order: 'asc' },
  });
  const tasksById = new Map(tasks.map((task) => [String(task.id), task]));
  const universityName = opportunityUniversityName(opportunity);
  const defaults = companyDefaults(opportunity);
  const excluded = [];
  const rows = [];
  const seenStudents = new Set();
  for (const app of apps) {
    const ctx = byId.get(app.id);
    if (!ctx) continue;
    const exclusion = officialPopulation.classifyOfficialReportExclusion({
      student: ctx.student,
      opportunity,
    });
    if (exclusion.excluded) {
      excluded.push({ applicationId: app.id, ...exclusion });
      continue;
    }
    const studentKey = String(ctx.student?.id || app.student_id);
    if (seenStudents.has(studentKey)) continue;
    seenStudents.add(studentKey);
    rows.push(buildExportRow(ctx, { universityName, defaults, tasksById }));
  }

  return {
    opportunity,
    universityName,
    defaults,
    template: excelTemplateMeta(opportunity),
    rows,
    excluded,
    considered: apps.length,
  };
}

function summarizeRows(rows = []) {
  return {
    totalStudents: rows.length,
    eligible: rows.filter((row) => row.eligible).length,
    notEligible: rows.filter((row) => !row.eligible).length,
    autoCalculated: rows.filter((row) => row.usedPerformanceDerived || row.usedSupervisorRating).length,
    administrativeFallback: rows.filter((row) => row.usedAdministrativeFallback).length,
    missingData: rows.filter((row) => (row.missingFields || []).length).length,
    missing: 0,
    duplicates: 0,
  };
}

async function previewExcelEvaluation(user, opportunityId) {
  const collected = await collectOpportunityRows(user, opportunityId);
  const template = await loadTemplateBuffer(collected.opportunity);
  return {
    opportunityId,
    opportunityTitle: collected.opportunity.title,
    universityName: collected.universityName,
    defaults: collected.defaults,
    template: {
      ...template.meta,
      source: template.source,
    },
    summary: summarizeRows(collected.rows),
    excludedCount: collected.excluded.length,
    consideredApplications: collected.considered,
  };
}

async function downloadExcelEvaluation(user, opportunityId) {
  const collected = await collectOpportunityRows(user, opportunityId);
  const template = await loadTemplateBuffer(collected.opportunity);
  const buffer = Buffer.from(await fillExcelEvaluationWorkbook(template.buffer, collected.rows));
  const summary = summarizeRows(collected.rows);
  await recordAudit({
    userId: user?.userId || null,
    universityId: collected.opportunity.university_id || user?.universityId || null,
    actionType: 'FT_EXCEL_EVALUATION_EXPORTED',
    entityType: 'field_training_opportunity',
    entityId: opportunityId,
    newValues: {
      rowCount: collected.rows.length,
      eligible: summary.eligible,
      notEligible: summary.notEligible,
      templateSource: template.source,
      templateVersion: template.meta.version,
    },
  });
  const filename = `تقييم_التدريب_الميداني_${collected.universityName || 'فرصة'}.xlsx`.replace(/\s+/g, '_');
  return {
    buffer,
    filename,
    mimeType: XLSX_MIME,
    summary: {
      ...summary,
      selected: collected.rows.length,
    },
    templateVersion: template.meta.version,
  };
}

async function uploadExcelEvaluationTemplate(user, opportunityId, file) {
  const opportunity = await loadOpportunity(opportunityId);
  evalAccess.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);
  if (!file?.buffer?.length) {
    throw new ApiError(400, 'يرجى رفع ملف Excel.', null, 'EXCEL_TEMPLATE_REQUIRED');
  }
  const name = String(file.originalname || '').toLowerCase();
  if (!name.endsWith('.xlsx')) {
    throw new ApiError(400, 'يُسمح بملفات XLSX فقط.', null, 'EXCEL_TEMPLATE_TYPE_INVALID');
  }
  const stored = await filesService.storePrivateBuffer({
    buffer: file.buffer,
    originalName: file.originalname || 'excel-evaluation.xlsx',
    mimeType: file.mimetype || XLSX_MIME,
    folder: STORAGE_FOLDER,
    user,
    relatedEntityType: 'field_training_opportunity',
    relatedEntityId: opportunityId,
  });
  const host = hostOrgOf(opportunity);
  const previous = excelTemplateMeta(opportunity);
  const nextVersion = Number(previous.version || 0) + 1;
  const nextHost = {
    ...host,
    excel_evaluation_template: {
      file_id: stored.id,
      version: nextVersion,
      name: stored.originalName || file.originalname,
      uploaded_at: new Date().toISOString(),
    },
  };
  await prisma.field_training_opportunities.update({
    where: { id: opportunityId },
    data: { host_organization: nextHost, updated_at: new Date() },
  });
  return {
    template: nextHost.excel_evaluation_template,
    fileId: stored.id,
  };
}

module.exports = {
  previewExcelEvaluation,
  downloadExcelEvaluation,
  uploadExcelEvaluationTemplate,
  companyDefaults,
  opportunityUniversityName,
  resolveExportCompletedHours,
  SCORE_SOURCE,
};

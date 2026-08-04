'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const {
  REPORT_TYPES,
  REPORT_TYPE_TITLES_AR,
  REPORT_STATUS,
  buildScopeKey,
} = require('./trainingReportMetrics.service');
const { verifyReportAccess } = require('./trainingReportAccess');
const { buildReportSnapshot, checksumSnapshot, loadProgramContext } = require('./trainingReportBuilders.service');

const ARTIFACT_ROOT = path.join(process.cwd(), 'uploads', 'training-reports');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeVerificationCode() {
  return crypto.randomBytes(16).toString('hex');
}

function makeReferenceCode(reportType, programCode) {
  const prefix = String(programCode || 'TR').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) || 'TR';
  const year = new Date().getFullYear();
  const seq = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${reportType.slice(0, 3)}-${year}-${seq}`;
}

function mapReportOut(report, { includeSnapshot = true } = {}) {
  return {
    id: report.id,
    reportType: report.report_type,
    reportTitle: REPORT_TYPE_TITLES_AR[report.report_type] || report.report_type,
    programId: report.program_id,
    organizationId: report.organization_id,
    cohortId: report.cohort_id,
    enrollmentId: report.enrollment_id,
    trainerUserId: report.trainer_user_id,
    version: report.version,
    status: report.status,
    isLatest: report.is_latest,
    referenceCode: report.reference_code,
    verificationCode: report.verification_code,
    summary: report.summary_text,
    snapshot: includeSnapshot ? report.snapshot_json : undefined,
    generatedAt: report.generated_at,
    generatedBy: report.generated_by,
    checksum: report.checksum,
    hasPdf: Boolean(report.pdf_path),
    hasExcel: Boolean(report.excel_path),
  };
}

async function loadProgramOrThrow(programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  return program;
}

async function listProgramReports(requester, programId, { reportType, cohortId } = {}) {
  const program = await loadProgramOrThrow(programId);
  await verifyReportAccess(requester, { program, reportType: reportType || REPORT_TYPES.COURSE });

  const rows = await prisma.training_official_reports.findMany({
    where: {
      program_id: programId,
      ...(reportType ? { report_type: reportType } : {}),
      ...(cohortId ? { cohort_id: cohortId } : {}),
    },
    orderBy: [{ report_type: 'asc' }, { version: 'desc' }],
    take: 100,
  });
  return rows.map((r) => mapReportOut(r, { includeSnapshot: false }));
}

async function getReportById(requester, reportId) {
  const report = await prisma.training_official_reports.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError(404, 'التقرير غير موجود', null, 'REPORT_NOT_FOUND');
  const program = await loadProgramOrThrow(report.program_id);
  let enrollment = null;
  if (report.enrollment_id) {
    enrollment = await prisma.training_enrollments.findUnique({ where: { id: report.enrollment_id } });
  }
  await verifyReportAccess(requester, {
    program,
    reportType: report.report_type,
    enrollment,
  });
  return mapReportOut(report);
}

async function getReportStatus(requester, reportId) {
  const out = await getReportById(requester, reportId);
  return {
    id: out.id,
    status: out.status,
    version: out.version,
    isLatest: out.isLatest,
    generatedAt: out.generatedAt,
    referenceCode: out.referenceCode,
  };
}

/**
 * Generate a new versioned official report. Never overwrites prior versions.
 */
async function generateOfficialReport(requester, {
  reportType,
  programId,
  cohortId,
  enrollmentId,
  trainerUserId,
  mode,
  reason,
}) {
  if (!Object.values(REPORT_TYPES).includes(reportType)) {
    throw new ApiError(400, 'نوع التقرير غير مدعوم', null, 'INVALID_REPORT_TYPE');
  }

  let program;
  let enrollment = null;

  if (reportType === REPORT_TYPES.INDIVIDUAL) {
    if (!enrollmentId) throw new ApiError(400, 'معرّف التسجيل مطلوب', null, 'ENROLLMENT_ID_REQUIRED');
    enrollment = await prisma.training_enrollments.findUnique({
      where: { id: enrollmentId },
      include: { training_cohorts: { include: { training_programs: true } } },
    });
    if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
    program = enrollment.training_cohorts.training_programs;
    programId = program.id;
    cohortId = enrollment.cohort_id;
  } else {
    program = await loadProgramOrThrow(programId);
  }

  await verifyReportAccess(requester, {
    program,
    reportType,
    enrollment,
    allowGenerate: true,
  });

  if (reportType === REPORT_TYPES.COHORT && !cohortId) {
    throw new ApiError(400, 'معرّف الدفعة مطلوب لتقرير الدفعة', null, 'COHORT_ID_REQUIRED');
  }

  const scopeKey = buildScopeKey({ cohortId, enrollmentId, trainerUserId });
  const snapshot = await buildReportSnapshot(reportType, {
    programId,
    cohortId,
    enrollmentId,
    trainerUserId,
    mode,
    reason,
  });
  const checksum = checksumSnapshot(snapshot);
  const summary =
    snapshot.summary ||
    snapshot.recommendation ||
    snapshot.executiveSummary?.topRecommendations?.[0] ||
    snapshot.meta?.reportTitle ||
    null;

  const last = await prisma.training_official_reports.findFirst({
    where: { report_type: reportType, scope_key: scopeKey, program_id: programId },
    orderBy: { version: 'desc' },
  });

  // Mark previous latest as STALE (preserve history)
  if (last?.is_latest) {
    await prisma.training_official_reports.updateMany({
      where: { report_type: reportType, scope_key: scopeKey, program_id: programId, is_latest: true },
      data: { is_latest: false, status: REPORT_STATUS.STALE, updated_at: new Date() },
    });
  }

  const report = await prisma.training_official_reports.create({
    data: {
      report_type: reportType,
      program_id: programId,
      organization_id: program.organization_id,
      cohort_id: cohortId || null,
      enrollment_id: enrollmentId || null,
      trainer_user_id: trainerUserId || null,
      scope_key: scopeKey,
      version: (last?.version || 0) + 1,
      status: REPORT_STATUS.READY,
      snapshot_json: snapshot,
      summary_text: typeof summary === 'string' ? summary : null,
      reference_code: makeReferenceCode(reportType, program.code),
      verification_code: makeVerificationCode(),
      is_latest: true,
      generated_by: requester.userId,
      checksum,
    },
  });

  // Dual-write legacy tables for INDIVIDUAL / COURSE compatibility
  if (reportType === REPORT_TYPES.INDIVIDUAL && enrollmentId) {
    const lastLegacy = await prisma.training_individual_reports.findFirst({
      where: { enrollment_id: enrollmentId },
      orderBy: { version: 'desc' },
    });
    await prisma.training_individual_reports.create({
      data: {
        enrollment_id: enrollmentId,
        program_id: programId,
        organization_id: program.organization_id,
        version: (lastLegacy?.version || 0) + 1,
        status: 'GENERATED',
        snapshot_json: snapshot,
        summary_text: report.summary_text,
        generated_by: requester.userId,
      },
    }).catch(() => null);
  }
  if (reportType === REPORT_TYPES.COURSE) {
    const lastLegacy = await prisma.training_course_reports.findFirst({
      where: { program_id: programId, cohort_id: cohortId || null },
      orderBy: { version: 'desc' },
    });
    await prisma.training_course_reports.create({
      data: {
        program_id: programId,
        organization_id: program.organization_id,
        cohort_id: cohortId || null,
        version: (lastLegacy?.version || 0) + 1,
        status: 'GENERATED',
        snapshot_json: snapshot,
        generated_by: requester.userId,
        finalization_mode: mode || null,
        finalization_reason: reason || null,
      },
    }).catch(() => null);
  }

  return mapReportOut(report);
}

async function getLatestReport(requester, {
  reportType,
  programId,
  cohortId,
  enrollmentId,
  trainerUserId,
}) {
  const scopeKey = buildScopeKey({ cohortId, enrollmentId, trainerUserId });
  let program = await loadProgramOrThrow(programId);
  let enrollment = null;
  if (enrollmentId) {
    enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
    if (enrollment) program = await loadProgramOrThrow(enrollment.training_cohorts ? programId : programId);
  }
  await verifyReportAccess(requester, { program, reportType, enrollment });

  const report = await prisma.training_official_reports.findFirst({
    where: {
      report_type: reportType,
      program_id: programId,
      scope_key: scopeKey,
      is_latest: true,
    },
    orderBy: { version: 'desc' },
  });
  if (!report) {
    // Fallback to legacy for individual/course
    if (reportType === REPORT_TYPES.INDIVIDUAL && enrollmentId) {
      const legacy = await prisma.training_individual_reports.findFirst({
        where: { enrollment_id: enrollmentId },
        orderBy: { version: 'desc' },
      });
      if (legacy) {
        return {
          id: legacy.id,
          reportType: REPORT_TYPES.INDIVIDUAL,
          reportTitle: REPORT_TYPE_TITLES_AR.INDIVIDUAL,
          programId: legacy.program_id,
          organizationId: legacy.organization_id,
          enrollmentId: legacy.enrollment_id,
          version: legacy.version,
          status: REPORT_STATUS.READY,
          isLatest: true,
          referenceCode: null,
          verificationCode: null,
          summary: legacy.summary_text,
          snapshot: legacy.snapshot_json,
          generatedAt: legacy.generated_at,
          legacy: true,
        };
      }
    }
    if (reportType === REPORT_TYPES.COURSE) {
      const legacy = await prisma.training_course_reports.findFirst({
        where: { program_id: programId, cohort_id: cohortId || null },
        orderBy: { version: 'desc' },
      });
      if (legacy) {
        return {
          id: legacy.id,
          reportType: REPORT_TYPES.COURSE,
          reportTitle: REPORT_TYPE_TITLES_AR.COURSE,
          programId: legacy.program_id,
          organizationId: legacy.organization_id,
          cohortId: legacy.cohort_id,
          version: legacy.version,
          status: REPORT_STATUS.READY,
          isLatest: true,
          referenceCode: null,
          verificationCode: null,
          summary: null,
          snapshot: legacy.snapshot_json,
          generatedAt: legacy.generated_at,
          finalizationMode: legacy.finalization_mode,
          finalizationReason: legacy.finalization_reason,
          legacy: true,
        };
      }
    }
    throw new ApiError(404, 'لا يوجد تقرير بعد.', null, 'REPORT_NOT_FOUND');
  }
  return mapReportOut(report);
}

async function resolveArtifactPaths(report) {
  const dir = path.join(ARTIFACT_ROOT, report.id);
  ensureDir(dir);
  return {
    dir,
    pdfPath: path.join(dir, `v${report.version}.pdf`),
    excelPath: path.join(dir, `v${report.version}.xlsx`),
    htmlPath: path.join(dir, `v${report.version}.html`),
  };
}

async function getOrCreatePdfBuffer(requester, reportId) {
  const reportRow = await prisma.training_official_reports.findUnique({ where: { id: reportId } });
  if (!reportRow) throw new ApiError(404, 'التقرير غير موجود', null, 'REPORT_NOT_FOUND');
  await getReportById(requester, reportId);

  const { pdfPath } = await resolveArtifactPaths(reportRow);
  if (reportRow.pdf_path && fs.existsSync(reportRow.pdf_path)) {
    return { buffer: fs.readFileSync(reportRow.pdf_path), report: mapReportOut(reportRow) };
  }
  if (fs.existsSync(pdfPath)) {
    return { buffer: fs.readFileSync(pdfPath), report: mapReportOut(reportRow) };
  }

  const { renderTrainingReportPdf } = require('./trainingReportPdf.service');
  const buffer = await renderTrainingReportPdf(reportRow);
  fs.writeFileSync(pdfPath, buffer);
  await prisma.training_official_reports.update({
    where: { id: reportId },
    data: { pdf_path: pdfPath, updated_at: new Date() },
  });
  return { buffer, report: mapReportOut({ ...reportRow, pdf_path: pdfPath }) };
}

async function getOrCreateExcelBuffer(requester, reportId) {
  const reportRow = await prisma.training_official_reports.findUnique({ where: { id: reportId } });
  if (!reportRow) throw new ApiError(404, 'التقرير غير موجود', null, 'REPORT_NOT_FOUND');
  const access = await (async () => {
    const program = await loadProgramOrThrow(reportRow.program_id);
    let enrollment = null;
    if (reportRow.enrollment_id) {
      enrollment = await prisma.training_enrollments.findUnique({ where: { id: reportRow.enrollment_id } });
    }
    return verifyReportAccess(requester, {
      program,
      reportType: reportRow.report_type,
      enrollment,
    });
  })();

  const { excelPath } = await resolveArtifactPaths(reportRow);
  if (reportRow.excel_path && fs.existsSync(reportRow.excel_path)) {
    return { buffer: fs.readFileSync(reportRow.excel_path), report: mapReportOut(reportRow) };
  }
  if (fs.existsSync(excelPath)) {
    return { buffer: fs.readFileSync(excelPath), report: mapReportOut(reportRow) };
  }

  const { renderTrainingReportExcel } = require('./trainingReportExcel.service');
  const buffer = await renderTrainingReportExcel(reportRow, { includeRaw: Boolean(access.canExportRaw) });
  fs.writeFileSync(excelPath, buffer);
  await prisma.training_official_reports.update({
    where: { id: reportId },
    data: { excel_path: excelPath, updated_at: new Date() },
  });
  return { buffer, report: mapReportOut({ ...reportRow, excel_path: excelPath }) };
}

async function getPrintableHtml(requester, reportId) {
  const reportRow = await prisma.training_official_reports.findUnique({ where: { id: reportId } });
  if (!reportRow) throw new ApiError(404, 'التقرير غير موجود', null, 'REPORT_NOT_FOUND');
  await getReportById(requester, reportId);
  const { buildTrainingReportHtml } = require('./trainingReport.template');
  const { loadBrandAssets } = require('./trainingReportPdf.service');
  const assets = await loadBrandAssets(reportRow);
  return buildTrainingReportHtml(reportRow, assets, { printable: true });
}

async function verifyPublicReport(verificationCode) {
  const report = await prisma.training_official_reports.findUnique({
    where: { verification_code: verificationCode },
  });
  if (!report) throw new ApiError(404, 'رمز التحقق غير صالح', null, 'REPORT_VERIFICATION_FAILED');
  const program = await prisma.training_programs.findUnique({
    where: { id: report.program_id },
    include: { organizations: { select: { name: true } } },
  });
  return {
    valid: true,
    reportType: report.report_type,
    reportTitle: REPORT_TYPE_TITLES_AR[report.report_type] || report.report_type,
    course: program?.title || null,
    institution: program?.organizations?.name || null,
    generationDate: report.generated_at,
    version: report.version,
    referenceCode: report.reference_code,
    status: report.status,
    isLatest: report.is_latest,
  };
}

module.exports = {
  REPORT_TYPES,
  REPORT_TYPE_TITLES_AR,
  listProgramReports,
  getReportById,
  getReportStatus,
  generateOfficialReport,
  getLatestReport,
  getOrCreatePdfBuffer,
  getOrCreateExcelBuffer,
  getPrintableHtml,
  verifyPublicReport,
  mapReportOut,
  loadProgramContext,
};

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { pipeline } = require('stream/promises');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { prisma } = require('../../config/db');
const repo = require('./fieldTraining.repository');
const { assertManageOpportunityAccess, isSystemWideAdmin } = require('./fieldTraining.access');
const fieldTrainingService = require('./fieldTraining.service');
const comprehensiveReport = require('./fieldTraining.comprehensiveReport.service');
const {
  buildStudentReportPdfFilename,
  buildStudentReportsZipFilename,
  contentDispositionAttachment,
} = require('./fieldTraining.studentReportsBulk.filename');
const { buildStudentReportsZip } = require('./fieldTraining.studentReportsBulk.zip');

const PDF_CONCURRENCY = Math.max(
  1,
  Math.min(5, Number(process.env.FT_STUDENT_REPORT_BULK_CONCURRENCY) || 3)
);
const MAX_EXPORT_COUNT = Math.max(
  1,
  Number(process.env.FT_STUDENT_REPORT_BULK_MAX) || 500
);
const JOB_TTL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.FT_STUDENT_REPORT_BULK_TTL_MS) || 6 * 60 * 60 * 1000
);

/** @type {Map<string, object>} */
const jobs = new Map();

/**
 * Keep export artifacts under uploads/private so they persist on the uploads
 * volume but are blocked from express.static (/uploads/private → 404).
 */
function exportsRoot() {
  return path.resolve(env.UPLOAD_DIR || 'uploads', 'private', 'ft-student-report-exports');
}

function jobDir(jobId) {
  return path.join(exportsRoot(), String(jobId));
}

function normalizeFilters(input = {}) {
  const eligibility =
    input.eligibility_status == null || input.eligibility_status === ''
      ? ''
      : String(input.eligibility_status).trim().toLowerCase();
  const training =
    input.training_status == null || input.training_status === ''
      ? ''
      : String(input.training_status).trim().toLowerCase();
  const search =
    input.search == null || input.search === '' ? '' : String(input.search).trim();
  return {
    eligibility_status: eligibility && eligibility !== 'all' ? eligibility : '',
    training_status: training && training !== 'all' ? training : '',
    search,
  };
}

function applyExportFilters(participants, filters = {}) {
  const normalized = normalizeFilters(filters);
  let rows = Array.isArray(participants) ? [...participants] : [];
  if (normalized.eligibility_status) {
    rows = rows.filter(
      (row) => String(row.eligibility_status || '').toLowerCase() === normalized.eligibility_status
    );
  }
  if (normalized.training_status) {
    rows = rows.filter(
      (row) => String(row.training_status || '').toLowerCase() === normalized.training_status
    );
  }
  if (normalized.search) {
    const q = normalized.search.toLowerCase();
    rows = rows.filter((row) => {
      const hay = [
        row.student_name,
        row.university_student_number,
        row.student_email,
        row.student_university,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }
  return rows;
}

function sortParticipants(participants) {
  return [...participants].sort((a, b) => {
    const nameCmp = String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    if (nameCmp !== 0) return nameCmp;
    return String(a.university_student_number || '').localeCompare(
      String(b.university_student_number || ''),
      'en'
    );
  });
}

function filterSummaryAr(filters = {}) {
  const parts = [];
  if (filters.eligibility_status) {
    parts.push(`الأهلية: ${filters.eligibility_status}`);
  }
  if (filters.training_status) {
    parts.push(`حالة التدريب: ${filters.training_status}`);
  }
  if (filters.search) {
    parts.push(`بحث: ${filters.search}`);
  }
  return parts.length ? parts.join(' · ') : 'بدون فلاتر إضافية';
}

async function resolveMatchingParticipants(opportunityId, user, filters = {}) {
  const data = await fieldTrainingService.listOpportunityEligibility(opportunityId, user);
  const filtered = sortParticipants(applyExportFilters(data.participants || [], filters));
  return {
    opportunity: data.opportunity,
    participants: filtered,
    filters: normalizeFilters(filters),
  };
}

function findActiveJob(opportunityId, userId) {
  for (const job of jobs.values()) {
    if (
      job.opportunityId === opportunityId &&
      job.createdById === userId &&
      (job.status === 'queued' || job.status === 'processing')
    ) {
      return job;
    }
  }
  return null;
}

function publicJob(job) {
  return {
    id: job.id,
    opportunity_id: job.opportunityId,
    status: job.status,
    report_type: 'comprehensive_student_report',
    filters: job.filters,
    filter_summary: job.filterSummary,
    matching_count: job.matchingCount,
    progress: {
      total: job.progress.total,
      completed: job.progress.completed,
      included: job.progress.included,
      failed: job.progress.failed,
      percent:
        job.progress.total > 0
          ? Math.round((job.progress.completed / job.progress.total) * 100)
          : 0,
    },
    filename: job.filename || null,
    error_message: job.errorMessage || null,
    created_at: job.createdAt,
    started_at: job.startedAt || null,
    finished_at: job.finishedAt || null,
    expires_at: job.expiresAt,
  };
}

async function ensureJobDir(jobId) {
  const dir = jobDir(jobId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function writeJobMeta(job) {
  const dir = await ensureJobDir(job.id);
  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(publicJob(job), null, 2), 'utf8');
}

async function previewBulkStudentReports(opportunityId, user, body = {}) {
  const filters = normalizeFilters(body);
  const { opportunity, participants } = await resolveMatchingParticipants(
    opportunityId,
    user,
    filters
  );
  const active = findActiveJob(opportunityId, user.userId);
  return {
    opportunity_id: opportunityId,
    opportunity_title: opportunity?.title || null,
    report_type: 'comprehensive_student_report',
    report_type_label_ar: 'التقرير الشامل للتدريب الميداني',
    filters,
    filter_summary: filterSummaryAr(filters),
    matching_count: participants.length,
    max_export_count: MAX_EXPORT_COUNT,
    exceeds_max: participants.length > MAX_EXPORT_COUNT,
    active_job: active ? publicJob(active) : null,
    sample: participants.slice(0, 5).map((row) => ({
      application_id: row.application_id,
      student_name: row.student_name,
      university_student_number: row.university_student_number,
      eligibility_status: row.eligibility_status,
    })),
  };
}

async function startBulkStudentReports(opportunityId, user, body = {}) {
  const preview = await previewBulkStudentReports(opportunityId, user, body);
  if (preview.active_job) {
    throw new ApiError(
      409,
      'يوجد تصدير جماعي لتقارير الطلاب قيد التنفيذ حالياً، يرجى الانتظار حتى اكتماله.',
      preview.active_job,
      'STUDENT_REPORTS_BULK_IN_PROGRESS'
    );
  }
  if (!preview.matching_count) {
    throw new ApiError(
      400,
      'لا يوجد طلاب مطابقون للفلاتر الحالية لتصدير تقاريرهم.',
      preview,
      'STUDENT_REPORTS_BULK_EMPTY'
    );
  }
  if (preview.exceeds_max) {
    throw new ApiError(
      400,
      'عدد التقارير كبير جدًا للتصدير في عملية واحدة.',
      preview,
      'STUDENT_REPORTS_BULK_TOO_LARGE'
    );
  }

  const { participants } = await resolveMatchingParticipants(
    opportunityId,
    user,
    preview.filters
  );
  const jobId = randomUUID();
  const now = new Date();
  const filename = buildStudentReportsZipFilename({
    opportunityTitle: preview.opportunity_title,
    date: now,
  });
  const job = {
    id: jobId,
    opportunityId,
    createdById: user.userId,
    userSnapshot: {
      userId: user.userId,
      roles: user.roles,
      universityId: user.universityId,
      organizationType: user.organizationType,
      portalType: user.portalType,
      isGlobal: Boolean(user.isGlobal),
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    },
    filters: preview.filters,
    filterSummary: preview.filter_summary,
    matchingCount: participants.length,
    applicationIds: participants.map((row) => row.application_id),
    studentMetaById: Object.fromEntries(
      participants.map((row) => [
        row.application_id,
        {
          studentName: row.student_name,
          universityNumber: row.university_student_number,
          eligibilityStatus: row.eligibility_status,
        },
      ])
    ),
    status: 'queued',
    progress: {
      total: participants.length,
      completed: 0,
      included: 0,
      failed: 0,
    },
    filename,
    zipPath: path.join(jobDir(jobId), 'result.zip'),
    errorMessage: null,
    createdAt: now.toISOString(),
    startedAt: null,
    finishedAt: null,
    expiresAt: new Date(now.getTime() + JOB_TTL_MS).toISOString(),
  };
  jobs.set(jobId, job);
  await writeJobMeta(job);

  const sync = Boolean(body.sync);
  if (sync) {
    await processJob(jobId);
    return publicJob(jobs.get(jobId));
  }
  setImmediate(() => {
    processJob(jobId).catch(() => undefined);
  });
  return publicJob(job);
}

async function loadSharedReportContext(opportunityId) {
  const [sessions, tasks] = await Promise.all([
    prisma.field_training_sessions.findMany({
      where: { opportunity_id: opportunityId },
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
      select: {
        id: true,
        title: true,
        session_date: true,
        start_time: true,
        end_time: true,
        is_required: true,
      },
    }),
    prisma.field_training_tasks.findMany({
      where: { opportunity_id: opportunityId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        title: true,
        is_required: true,
        is_final_task: true,
        grading_mode: true,
        due_date: true,
      },
    }),
  ]);
  const { loadBattechnoLogoDataUri } = require('../trainingPrograms/trainingReportPdf.service');
  return {
    sessions,
    tasks,
    battechnoLogoDataUri: loadBattechnoLogoDataUri(),
  };
}

async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'processing';
  job.startedAt = new Date().toISOString();
  await writeJobMeta(job);

  try {
    const opp = await repo.findById(job.opportunityId);
    if (!opp) throw new ApiError(404, 'Opportunity not found');
    await assertManageOpportunityAccess(job.userSnapshot, opp);
    const shared = await loadSharedReportContext(job.opportunityId);
    const apps = job.applicationIds.length
      ? await prisma.field_training_applications.findMany({
          where: { id: { in: job.applicationIds }, opportunity_id: job.opportunityId },
        })
      : [];
    const appById = new Map(apps.map((row) => [row.id, row]));
    const entries = job.applicationIds.map((applicationId, index) => {
      const meta = job.studentMetaById[applicationId] || {};
      return {
        applicationId,
        studentName: meta.studentName,
        universityNumber: meta.universityNumber,
        eligibilityStatus: meta.eligibilityStatus,
        filename: buildStudentReportPdfFilename({
          index: index + 1,
          studentName: meta.studentName,
          universityNumber: meta.universityNumber,
        }),
      };
    });

    const built = await buildStudentReportsZip(entries, {
      concurrency: PDF_CONCURRENCY,
      onProgress: async (progress) => {
        job.progress = {
          total: progress.total,
          completed: progress.completed,
          included: progress.included,
          failed: progress.failed,
        };
        await writeJobMeta(job);
      },
      onFile: async (entry) => {
        const application = appById.get(entry.applicationId);
        if (!application) {
          throw new ApiError(404, 'Application not found');
        }
        const result = await comprehensiveReport.exportComprehensiveStudentReportPdf(
          job.opportunityId,
          entry.applicationId,
          job.userSnapshot,
          {},
          {
            accessAlreadyAsserted: true,
            preloaded: {
              opportunity: opp,
              application,
              sessions: shared.sessions,
              tasks: shared.tasks,
              battechnoLogoDataUri: shared.battechnoLogoDataUri,
            },
          }
        );
        return result.buffer;
      },
    });

    await ensureJobDir(job.id);
    await pipeline(built.stream, fs.createWriteStream(job.zipPath));

    job.progress = {
      total: entries.length,
      completed: entries.length,
      included: built.included.length,
      failed: built.failed.length,
    };
    job.status =
      built.included.length === 0
        ? 'failed'
        : built.failed.length
          ? 'ready'
          : 'ready';
    if (built.included.length === 0) {
      job.errorMessage = 'تعذر إنشاء أي تقرير ضمن عملية التصدير.';
      job.status = 'failed';
    }
    job.finishedAt = new Date().toISOString();
    job.failedRows = built.failed;
    await writeJobMeta(job);

    await recordAudit({
      userId: job.createdById,
      actionType: 'FIELD_TRAINING_STUDENT_REPORTS_BULK_EXPORTED',
      entityType: 'field_training_opportunity',
      entityId: job.opportunityId,
      newValues: {
        jobId: job.id,
        matchingCount: job.matchingCount,
        included: built.included.length,
        failed: built.failed.length,
        filters: job.filters,
        filterSummary: job.filterSummary,
        reportType: 'comprehensive_student_report',
        filename: job.filename,
      },
    });
  } catch (err) {
    job.status = 'failed';
    job.errorMessage = err?.message || 'تعذر تجهيز التقارير.';
    job.finishedAt = new Date().toISOString();
    await writeJobMeta(job);
  }
}

function assertJobReadable(job, user) {
  if (!job) throw new ApiError(404, 'المهمة غير موجودة');
  if (String(job.createdById) !== String(user.userId) && !isSystemWideAdmin(user)) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى عملية التصدير هذه', null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if (job.expiresAt && Date.now() > new Date(job.expiresAt).getTime()) {
    job.status = 'expired';
    throw new ApiError(410, 'انتهت صلاحية ملف التصدير. أعد إنشاء التصدير.', null, 'STUDENT_REPORTS_BULK_EXPIRED');
  }
}

async function getBulkStudentReportsJob(opportunityId, jobId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const job = jobs.get(jobId);
  if (!job || job.opportunityId !== opportunityId) {
    throw new ApiError(404, 'المهمة غير موجودة');
  }
  assertJobReadable(job, user);
  return publicJob(job);
}

async function downloadBulkStudentReportsZip(opportunityId, jobId, user) {
  const jobView = await getBulkStudentReportsJob(opportunityId, jobId, user);
  const job = jobs.get(jobId);
  if (jobView.status !== 'ready') {
    throw new ApiError(
      409,
      jobView.status === 'failed'
        ? jobView.error_message || 'فشلت عملية التصدير'
        : 'ملف التصدير غير جاهز بعد',
      jobView,
      'STUDENT_REPORTS_BULK_NOT_READY'
    );
  }
  if (!job.zipPath || !fs.existsSync(job.zipPath)) {
    throw new ApiError(404, 'ملف ZIP غير موجود', null, 'STUDENT_REPORTS_BULK_MISSING_FILE');
  }
  return {
    absPath: job.zipPath,
    filename: job.filename,
    contentDisposition: contentDispositionAttachment(job.filename),
    contentType: 'application/zip',
    summary: {
      matching: job.matchingCount,
      included: job.progress.included,
      failed: job.progress.failed,
    },
  };
}

function __resetJobsForTests() {
  jobs.clear();
}

module.exports = {
  PDF_CONCURRENCY,
  MAX_EXPORT_COUNT,
  normalizeFilters,
  applyExportFilters,
  sortParticipants,
  previewBulkStudentReports,
  startBulkStudentReports,
  getBulkStudentReportsJob,
  downloadBulkStudentReportsZip,
  processJob,
  __resetJobsForTests,
  buildStudentReportPdfFilename,
  buildStudentReportsZipFilename,
};

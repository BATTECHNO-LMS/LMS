'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { recordAudit } = require('../../utils/auditRecorder');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { assertManageOpportunityAccess, assertApplicationStudentAccess } = require('./fieldTraining.access');
const ftNotify = require('./fieldTraining.notifications');
const repo = require('./fieldTraining.repository');
const workflow = require('./fieldTraining.workflow');
const supervisorScope = require('./fieldTraining.supervisorScope');
const names = require('./fieldTraining.supervisorName');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const {
  MIN_COMPLETION_LETTER_HOURS,
  computeLetterSourceHash,
  buildOfficialCompletionLetterHtml,
} = require('./fieldTraining.completionLetter.template');
const {
  buildCompletionLetterPdfFilename,
  buildCompletionLettersZipFilename,
  contentDispositionAttachment,
} = require('./fieldTraining.completionLetter.filename');
const { buildCompletionLettersZip, readPdfBuffer } = require('./fieldTraining.completionLetter.zip');

const ACTIVE_JOB_STATUSES = ['queued', 'running'];
const ISSUE_BATCH_SIZE = 4;
const JOB_LOCK_MS = 30 * 60 * 1000;

const SKIP_REASONS = Object.freeze({
  NOT_ELIGIBLE: 'not_eligible',
  HOURS_BELOW_MINIMUM: 'hours_below_minimum',
  EXPELLED: 'expelled',
  ALREADY_ISSUED: 'already_issued',
  SOURCE_UNCHANGED: 'source_unchanged',
});

const SKIP_LABELS_AR = Object.freeze({
  not_eligible: 'غير مؤهل',
  hours_below_minimum: 'الساعات المكتملة أقل من 140',
  expelled: 'مستبعد',
  already_issued: 'تم الإصدار مسبقاً',
  source_unchanged: 'صادر ولم تتغير بياناته',
});

function skipLabel(reason) {
  return SKIP_LABELS_AR[reason] || reason;
}

function emptyProgress() {
  return {
    status_label: 'جاري الإصدار',
    total: 0,
    completed: 0,
    remaining: 0,
    failed: 0,
    newly_issued: 0,
    previously_issued: 0,
    skipped: 0,
    failed_ids: [],
    results: [],
  };
}

function completedHoursOf(app) {
  return app?.completed_training_hours != null ? Number(app.completed_training_hours) : 0;
}

function classifyStudent(app, letter, sourceHash) {
  if (workflow.isExpelled(app)) {
    return { eligible: false, skipReason: SKIP_REASONS.EXPELLED };
  }
  if (app.completion_eligibility_status !== 'eligible') {
    return { eligible: false, skipReason: SKIP_REASONS.NOT_ELIGIBLE };
  }
  if (completedHoursOf(app) < MIN_COMPLETION_LETTER_HOURS) {
    return { eligible: false, skipReason: SKIP_REASONS.HOURS_BELOW_MINIMUM };
  }
  if (letter?.status === 'issued') {
    const existingHash = letter.source_data_hash || letter.metadata?.source_data_hash;
    if (existingHash && existingHash === sourceHash) {
      return { eligible: true, skipReason: SKIP_REASONS.SOURCE_UNCHANGED, alreadyIssued: true };
    }
    if (!existingHash) {
      return { eligible: true, skipReason: SKIP_REASONS.ALREADY_ISSUED, alreadyIssued: true };
    }
    return { eligible: true, regenerate: true, alreadyIssued: true };
  }
  return { eligible: true };
}

async function loadScopeStudents(opportunityId, user, { search, issuanceStatus, supervisorId, supervisorName } = {}) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const studentUniversityId = require('./fieldTraining.access').resolveApplicationStudentUniversityId(
    user,
    undefined
  );
  const supervisorWhere = supervisorScope.applicationSupervisorWhere(user);
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      ...supervisorWhere,
    },
    orderBy: { created_at: 'desc' },
  });

  let scoped = apps;
  if (studentUniversityId) {
    const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
    const allowed = new Set(
      profiles.filter((p) => String(p.primary_university_id) === String(studentUniversityId)).map((p) => p.id)
    );
    scoped = apps.filter((app) => allowed.has(app.student_id));
  }

  const letters = scoped.length
    ? await prisma.field_training_completion_letters.findMany({
        where: { application_id: { in: scoped.map((a) => a.id) }, status: 'issued' },
      })
    : [];
  const letterByApp = new Map(letters.map((row) => [row.application_id, row]));
  const profiles = await repo.findStudentProfilesByIds([...new Set(scoped.map((a) => a.student_id))]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const assignments = await supervisorScope.loadAssignmentsByApplicationIds(scoped.map((a) => a.id));

  const university = opp.university_id
    ? await prisma.universities.findUnique({ where: { id: opp.university_id }, select: { id: true, name: true } })
    : null;

  const mapped = scoped.map((app) => {
    const profile = profileById[app.student_id];
    const letter = letterByApp.get(app.id) || null;
    const assignment = assignments.get(app.id);
    const universityNumber = resolveOfficialUniversityNumber(profile).number || '';
    const sourceHash = computeLetterSourceHash({
      studentId: app.student_id,
      applicationId: app.id,
      studentName: profile?.full_name,
      universityNumber,
      universityName: profile?.university?.name || university?.name,
      specialtyName: profile?.university_specialty?.name_ar || profile?.specialty?.name_ar,
      opportunityTitle: opp.title,
      startDate: repo.mapOpportunityRow(opp).start_date,
      endDate: repo.mapOpportunityRow(opp).end_date,
      completedHours: completedHoursOf(app),
      attendancePct: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      postScore: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
    });
    const classification = classifyStudent(app, letter, sourceHash);
    return supervisorScope.attachAssignment(
      {
        ...repo.mapApplicationRow(app),
        student_name: profile?.full_name || 'طالب غير معروف',
        student_email: profile?.email || null,
        university_number: universityNumber,
        student_university: profile?.university?.name || university?.name || null,
        student_specialty_label:
          repo.formatSpecialtyLabel(profile?.university_specialty || profile?.specialty, null),
        letter_id: letter?.id || null,
        letter_no: letter?.letter_no || null,
        has_pdf: Boolean(letter?.pdf_url),
        issuance_status: letter ? 'issued' : classification.eligible ? 'pending' : 'ineligible',
        skip_reason: classification.skipReason || null,
        skip_reason_label: classification.skipReason ? skipLabel(classification.skipReason) : null,
        source_data_hash: sourceHash,
        will_issue: Boolean(classification.eligible && !classification.alreadyIssued),
        will_regenerate: Boolean(classification.regenerate),
        already_issued: Boolean(classification.alreadyIssued),
      },
      assignment
    );
  });

  const filtered = mapped.filter((row) => {
    if (supervisorId && String(row.academic_supervisor_id || '') !== String(supervisorId)) return false;
    if (supervisorName != null && String(supervisorName).trim() !== '') {
      const wanted = names.normalizeSupervisorKey(supervisorName);
      if ((names.normalizeSupervisorKey(row.academic_supervisor_name) || '') !== wanted) return false;
    }
    if (issuanceStatus === 'issued' && !row.already_issued) return false;
    if (issuanceStatus === 'pending' && (row.already_issued || !row.will_issue)) return false;
    if (issuanceStatus === 'ineligible' && row.issuance_status !== 'ineligible') return false;
    if (issuanceStatus === 'error' && row.issuance_status !== 'error') return false;
    if (search) {
      const q = String(search).trim().toLowerCase();
      const hay = [row.student_name, row.student_email, row.university_number, row.academic_supervisor_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return { opp, university, students: filtered, allStudents: mapped };
}

function summarizeStudents(students) {
  const eligible = students.filter(
    (row) =>
      row.completion_eligibility_status === 'eligible' &&
      completedHoursOf(row) >= MIN_COMPLETION_LETTER_HOURS &&
      row.training_status !== 'expelled' &&
      !row.expelled_at
  );
  const issued = students.filter((row) => row.already_issued || row.completion_letter_issued_at);
  const pending = eligible.filter((row) => !row.already_issued);
  return {
    total: students.length,
    eligible: eligible.length,
    issued: issued.length,
    pending: pending.length,
    errors: students.filter((row) => row.issuance_status === 'error').length,
  };
}

async function listCompletionLetters(opportunityId, user, query = {}) {
  const { opp, university, students, allStudents } = await loadScopeStudents(opportunityId, user, {
    search: query.search,
    issuanceStatus: query.issuance_status,
    supervisorId: query.supervisor_id,
    supervisorName: query.supervisor_name,
  });
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20));
  const start = (page - 1) * pageSize;
  const counters = summarizeStudents(allStudents);
  const supervisors = [];
  const seenSupervisors = new Set();
  for (const row of allStudents) {
    const label = names.resolvedSupervisorDisplay(row.academic_supervisor_name);
    const key = names.normalizeSupervisorKey(row.academic_supervisor_name) || '';
    if (seenSupervisors.has(key)) continue;
    seenSupervisors.add(key);
    supervisors.push({ id: key || 'unassigned', name: label, normalized: key });
  }
  return {
    opportunity: { id: opp.id, title: opp.title, university_name: university?.name || null },
    university: university ? { id: university.id, name: university.name } : null,
    counters,
    supervisors,
    students: students.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total: students.length,
      total_pages: Math.max(1, Math.ceil(students.length / pageSize)),
    },
  };
}

async function previewBulkIssue(opportunityId, user, { retryFailedIds = [] } = {}) {
  const { opp, university, allStudents } = await loadScopeStudents(opportunityId, user);
  const retrySet = new Set((retryFailedIds || []).filter(Boolean));
  const toIssue = allStudents.filter((row) => {
    if (retrySet.size) return retrySet.has(row.id);
    return row.will_issue || row.will_regenerate;
  });
  const skipped = allStudents
    .filter((row) => !toIssue.some((item) => item.id === row.id))
    .map((row) => ({
      application_id: row.id,
      student_name: row.student_name,
      university_number: row.university_number,
      reason: row.skip_reason,
      reason_label: row.skip_reason_label || skipLabel(row.skip_reason),
    }));

  const running = await findActiveJob(opportunityId);
  return {
    opportunity_name: opp.title,
    university_name: university?.name || null,
    total_students: allStudents.length,
    eligible_students: allStudents.filter(
      (row) =>
        row.completion_eligibility_status === 'eligible' &&
        completedHoursOf(row) >= MIN_COMPLETION_LETTER_HOURS
    ).length,
    letters_already_issued: allStudents.filter((row) => row.already_issued).length,
    letters_to_issue: toIssue.length,
    skipped,
    active_job: running ? mapJob(running) : null,
  };
}

function mapJob(job) {
  const progress = job.progress || emptyProgress();
  return {
    id: job.id,
    opportunity_id: job.opportunity_id,
    status: job.status,
    retry_failed_only: job.retry_failed_only,
    progress: {
      ...emptyProgress(),
      ...progress,
      status_label: job.status === 'running' || job.status === 'queued' ? 'جاري الإصدار' : progress.status_label,
    },
    error_message: job.error_message,
    started_at: job.started_at,
    finished_at: job.finished_at,
    created_at: job.created_at,
  };
}

async function findActiveJob(opportunityId) {
  const cutoff = new Date(Date.now() - JOB_LOCK_MS);
  return prisma.field_training_completion_letter_jobs.findFirst({
    where: {
      opportunity_id: opportunityId,
      status: { in: ACTIVE_JOB_STATUSES },
      created_at: { gte: cutoff },
    },
    orderBy: { created_at: 'desc' },
  });
}

async function buildLetterPayload(app, opp, userId) {
  const profiles = await repo.findStudentProfilesByIds([app.student_id]);
  const student = profiles[0];
  let instructorName = null;
  if (opp.assigned_instructor_id) {
    const ins = await prisma.users.findUnique({
      where: { id: opp.assigned_instructor_id },
      select: { full_name: true },
    });
    instructorName = ins?.full_name ?? null;
  }
  const universityNumber = resolveOfficialUniversityNumber(student).number || '';
  const mappedOpp = repo.mapOpportunityRow(opp);
  return {
    studentId: app.student_id,
    applicationId: app.id,
    studentName: student?.full_name || '—',
    universityNumber,
    universityName: student?.university?.name,
    specialtyName: student?.specialty?.name_ar || student?.specialty?.name_en || student?.university_specialty?.name_ar,
    opportunityTitle: opp.title,
    startDate: mappedOpp.start_date,
    endDate: mappedOpp.end_date,
    completedHours: completedHoursOf(app),
    attendancePct: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
    postScore: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
    instructorName,
    issuedById: userId,
  };
}

async function writeLetterPdf(applicationId, letterNo, html) {
  const pdfBuffer = await renderHtmlToPdf(html, { lang: 'ar' });
  const relDir = path.posix.join('field-training', 'completion-letters', applicationId);
  const absDir = path.join(env.UPLOAD_DIR || 'uploads', relDir);
  fs.mkdirSync(absDir, { recursive: true });
  const fileName = `${letterNo}.pdf`;
  const relPath = path.posix.join(relDir, fileName);
  fs.writeFileSync(path.join(env.UPLOAD_DIR || 'uploads', relPath), pdfBuffer);
  return relPath;
}

async function issueOne(applicationId, userId, user, { allowSkip = false } = {}) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);
  await supervisorScope.assertReviewerCanAccessApplication(user, app);

  if (workflow.isExpelled(app)) {
    throw new ApiError(400, 'لا يمكن إصدار كتاب لطالب مستبعد');
  }

  const eligibility = await workflow.calculateFieldTrainingEligibility(applicationId);
  if (app.completion_eligibility_status !== 'eligible') {
    throw new ApiError(400, 'الطالب غير مؤهل لإصدار كتاب الإنهاء', eligibility);
  }
  if (completedHoursOf(app) < MIN_COMPLETION_LETTER_HOURS) {
    throw new ApiError(400, 'يجب إكمال 140 ساعة تدريبية على الأقل قبل إصدار كتاب الإنهاء');
  }

  const payload = await buildLetterPayload(app, opp, userId);
  const sourceHash = computeLetterSourceHash(payload);
  const existing = await repo.findCompletionLetterByApplication(applicationId);

  if (existing) {
    const existingHash = existing.source_data_hash || existing.metadata?.source_data_hash;
    if (existingHash === sourceHash || !existingHash) {
      if (allowSkip) {
        return { outcome: existingHash === sourceHash ? 'skipped' : 'previously_issued', letter: existing };
      }
      throw new ApiError(409, 'تم إصدار كتاب الإنهاء مسبقًا');
    }
  }

  const letterNo = existing?.letter_no || `FT-${Date.now().toString(36).toUpperCase()}`;
  const verificationCode = existing?.verification_code || crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString().slice(0, 10);
  const html = buildOfficialCompletionLetterHtml({
    ...payload,
    letterNo,
    verificationCode,
    issuedAt,
  });
  const relPath = await writeLetterPdf(applicationId, letterNo, html);

  let letter;
  if (existing) {
    letter = await prisma.field_training_completion_letters.update({
      where: { id: existing.id },
      data: {
        pdf_url: relPath,
        source_data_hash: sourceHash,
        issued_by_id: userId,
        issued_at: new Date(),
        metadata: { ...(existing.metadata || {}), eligibility: eligibility.details, source_data_hash: sourceHash },
        updated_at: new Date(),
      },
    });
  } else {
    letter = await repo.createCompletionLetter({
      application_id: applicationId,
      student_id: app.student_id,
      opportunity_id: opp.id,
      letter_no: letterNo,
      status: 'issued',
      issued_by_id: userId,
      pdf_url: relPath,
      verification_code: verificationCode,
      source_data_hash: sourceHash,
      metadata: { eligibility: eligibility.details, source_data_hash: sourceHash },
    });
  }

  await repo.updateApplication(applicationId, {
    completion_letter_issued_at: new Date(),
    training_status: 'completed',
    completion_eligibility_status: 'eligible',
  });

  if (!existing) {
    await ftNotify.notifyStudentCompletionLetter({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
    });
  }

  await recordAudit({
    userId,
    actionType: existing
      ? 'FIELD_TRAINING_COMPLETION_LETTER_REGENERATED'
      : 'FIELD_TRAINING_COMPLETION_LETTER_ISSUED',
    entityType: 'field_training_completion_letter',
    entityId: letter.id,
    newValues: { application_id: applicationId, source_data_hash: sourceHash },
  });

  return {
    outcome: existing ? 'regenerated' : 'issued',
    letter: {
      id: letter.id,
      letter_no: letter.letter_no,
      pdf_url: letter.pdf_url,
      verification_code: letter.verification_code,
      issued_at: letter.issued_at,
    },
  };
}

async function startBulkIssue(opportunityId, user, { retryFailedIds = [], sync = false } = {}) {
  const preview = await previewBulkIssue(opportunityId, user, { retryFailedIds });
  if (preview.active_job) {
    throw new ApiError(409, 'عملية إصدار جماعية قيد التنفيذ حالياً', preview.active_job, 'BULK_ISSUE_IN_PROGRESS');
  }

  const { allStudents } = await loadScopeStudents(opportunityId, user);
  const retrySet = new Set((retryFailedIds || []).filter(Boolean));
  const targetIds = allStudents
    .filter((row) => (retrySet.size ? retrySet.has(row.id) : row.will_issue || row.will_regenerate))
    .map((row) => row.id);

  const job = await prisma.field_training_completion_letter_jobs.create({
    data: {
      opportunity_id: opportunityId,
      university_id: (await repo.findById(opportunityId))?.university_id || null,
      status: 'queued',
      created_by_id: user.userId,
      retry_failed_only: retrySet.size > 0,
      payload: {
        application_ids: targetIds,
        user: {
          userId: user.userId,
          roles: user.roles,
          universityId: user.universityId,
          organizationType: user.organizationType,
          portalType: user.portalType,
        },
      },
      progress: { ...emptyProgress(), total: targetIds.length, remaining: targetIds.length },
    },
  });

  if (sync) {
    await processJob(job.id);
    return getJob(opportunityId, job.id, user);
  }
  setImmediate(() => {
    processJob(job.id).catch(() => undefined);
  });
  return mapJob(job);
}

async function processJob(jobId) {
  const job = await prisma.field_training_completion_letter_jobs.findUnique({ where: { id: jobId } });
  if (!job) return;
  const user = job.payload?.user || { userId: job.created_by_id };
  const ids = job.payload?.application_ids || [];
  const progress = { ...emptyProgress(), total: ids.length, remaining: ids.length };

  await prisma.field_training_completion_letter_jobs.update({
    where: { id: jobId },
    data: { status: 'running', started_at: new Date(), progress, updated_at: new Date() },
  });

  for (let i = 0; i < ids.length; i += ISSUE_BATCH_SIZE) {
    const batch = ids.slice(i, i + ISSUE_BATCH_SIZE);
    for (const applicationId of batch) {
      try {
        const result = await issueOne(applicationId, user.userId, user, { allowSkip: true });
        if (result.outcome === 'issued' || result.outcome === 'regenerated') {
          progress.newly_issued += 1;
        } else if (result.outcome === 'previously_issued') {
          progress.previously_issued += 1;
        } else {
          progress.skipped += 1;
        }
        progress.results.push({ application_id: applicationId, outcome: result.outcome });
      } catch (err) {
        progress.failed += 1;
        progress.failed_ids.push(applicationId);
        progress.results.push({
          application_id: applicationId,
          outcome: 'failed',
          error: err?.message || 'failed',
        });
      }
      progress.completed = progress.newly_issued + progress.previously_issued + progress.skipped + progress.failed;
      progress.remaining = Math.max(0, progress.total - progress.completed);
      await prisma.field_training_completion_letter_jobs.update({
        where: { id: jobId },
        data: { progress, updated_at: new Date() },
      });
    }
  }

  await prisma.field_training_completion_letter_jobs.update({
    where: { id: jobId },
    data: {
      status: progress.failed && progress.failed === progress.total ? 'failed' : 'completed',
      finished_at: new Date(),
      progress: {
        ...progress,
        status_label: progress.failed && progress.newly_issued ? 'إصدار جزئي' : progress.failed ? 'فشل' : 'اكتمل',
      },
      updated_at: new Date(),
    },
  });
}

async function getJob(opportunityId, jobId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const job = await prisma.field_training_completion_letter_jobs.findFirst({
    where: { id: jobId, opportunity_id: opportunityId },
  });
  if (!job) throw new ApiError(404, 'المهمة غير موجودة');
  return mapJob(job);
}

async function retryFailedJob(opportunityId, jobId, user, { sync = false } = {}) {
  const job = await getJob(opportunityId, jobId, user);
  const failedIds = job.progress?.failed_ids || [];
  if (!failedIds.length) {
    throw new ApiError(400, 'لا توجد سجلات فاشلة لإعادة المحاولة');
  }
  return startBulkIssue(opportunityId, user, { retryFailedIds: failedIds, sync });
}

async function downloadIssuedZip(opportunityId, user) {
  const { opp, university, allStudents } = await loadScopeStudents(opportunityId, user);
  const issued = allStudents.filter((row) => row.already_issued && row.has_pdf);
  const pendingEligible = allStudents.filter((row) => row.will_issue);
  const failedCount = allStudents.filter((row) => row.issuance_status === 'error').length;

  if (!issued.length && pendingEligible.length) {
    throw new ApiError(
      409,
      `لم يُصدر ${pendingEligible.length} كتاباً بعد. استخدم إصدار الكل أولاً.`,
      { unissued: pendingEligible.length },
      'COMPLETION_LETTERS_NOT_ISSUED'
    );
  }

  const letters = issued.length
    ? await prisma.field_training_completion_letters.findMany({
        where: { application_id: { in: issued.map((row) => row.id) }, status: 'issued' },
      })
    : [];
  const letterByApp = new Map(letters.map((row) => [row.application_id, row]));

  const entries = issued.map((row) => {
    const letter = letterByApp.get(row.id);
    return {
      applicationId: row.id,
      studentName: row.student_name,
      universityNumber: row.university_number,
      filename: buildCompletionLetterPdfFilename({
        studentName: row.student_name,
        universityNumber: row.university_number,
      }),
      supervisorFolder: names.sanitizeZipFolder(row.academic_supervisor_name),
      supervisorName: names.resolvedSupervisorDisplay(row.academic_supervisor_name),
      pdfUrl: letter?.pdf_url,
    };
  });

  const { stream, included, failed } = await buildCompletionLettersZip(entries, {
    onFile: (entry) => {
      const absPath = repo.resolveSubmissionAbsolutePath(entry.pdfUrl);
      return readPdfBuffer(absPath);
    },
  });

  return {
    stream,
    filename: buildCompletionLettersZipFilename({
      opportunityName: opp.title,
      date: new Date(),
    }),
    summary: {
      selected: entries.length,
      included: included.length,
      failed: failed.length + failedCount,
      unissued: pendingEligible.length,
      university_name: university?.name || null,
      opportunity_name: opp.title,
    },
    contentDisposition: contentDispositionAttachment(
      buildCompletionLettersZipFilename({ opportunityName: opp.title, date: new Date() })
    ),
  };
}

function downloadHeaders(fileName, mimeType) {
  return {
    'Content-Type': mimeType || 'application/pdf',
    'Content-Disposition': contentDispositionAttachment(fileName),
  };
}

module.exports = {
  MIN_COMPLETION_LETTER_HOURS,
  SKIP_REASONS,
  skipLabel,
  classifyStudent,
  listCompletionLetters,
  previewBulkIssue,
  issueOne,
  startBulkIssue,
  processJob,
  getJob,
  retryFailedJob,
  downloadIssuedZip,
  downloadHeaders,
  findActiveJob,
  summarizeStudents,
};

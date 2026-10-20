'use strict';

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError, crossScopeForbidden } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { buildListMeta, normalizePagination } = require('../../utils/pagination');
const { recordAudit } = require('../../utils/auditRecorder');
const ftAccess = require('./fieldTraining.access');
const supervisorScope = require('./fieldTraining.supervisorScope');
const repo = require('./fieldTraining.repository');
const {
  LOGBOOK_STATUS,
  assertTransition,
  canStudentEdit,
  canStudentDelete,
  isReadOnlyAfterFinalize,
} = require('./fieldTraining.logbook.workflow');
const {
  isAllowedSubmissionFile,
  isBlockedExtension,
} = require('./fieldTraining.submissionFileRules');
const ftNotify = require('./fieldTraining.notifications');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseEntryDate(value) {
  if (!value) throw new ApiError(400, 'تاريخ السجل مطلوب', null, 'LOGBOOK_DATE_REQUIRED');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, 'تاريخ السجل غير صالح', null, 'LOGBOOK_DATE_INVALID');
  }
  return startOfDay(d);
}

function assertEntryDateInTrainingWindow(entryDate, app, opp) {
  const today = startOfDay(new Date());
  if (entryDate.getTime() > today.getTime() + 24 * 3600 * 1000) {
    throw new ApiError(400, 'لا يمكن تسجيل نشاط في تاريخ مستقبلي بعيد', null, 'LOGBOOK_DATE_FUTURE');
  }
  const start =
    app.training_started_at
      ? startOfDay(app.training_started_at)
      : opp.start_date
        ? startOfDay(opp.start_date)
        : null;
  if (start && entryDate < start) {
    throw new ApiError(400, 'تاريخ السجل قبل بداية التدريب', null, 'LOGBOOK_DATE_BEFORE_START');
  }
  const end = opp.end_date ? startOfDay(opp.end_date) : null;
  if (end && entryDate > end) {
    throw new ApiError(400, 'تاريخ السجل بعد نهاية التدريب', null, 'LOGBOOK_DATE_AFTER_END');
  }
}

function mapAttachment(row) {
  if (!row) return null;
  return {
    id: row.id,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
  };
}

function mapEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    application_id: row.application_id,
    opportunity_id: row.opportunity_id,
    student_id: row.student_id,
    entry_date: row.entry_date,
    activity: row.activity,
    learning_outcome: row.learning_outcome,
    skills: row.skills,
    challenges: row.challenges,
    outcome: row.outcome,
    reported_hours: row.reported_hours != null ? Number(row.reported_hours) : null,
    status: row.status,
    submitted_at: row.submitted_at,
    reviewed_by_id: row.reviewed_by_id,
    reviewed_at: row.reviewed_at,
    revision_comment: row.revision_comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachments: (row.field_training_logbook_attachments || []).map(mapAttachment),
    review_events: (row.field_training_logbook_review_events || []).map((e) => ({
      id: e.id,
      action: e.action,
      actor_user_id: e.actor_user_id,
      comment: e.comment,
      created_at: e.created_at,
    })),
  };
}

const entryInclude = {
  field_training_logbook_attachments: { orderBy: { created_at: 'asc' } },
  field_training_logbook_review_events: { orderBy: { created_at: 'asc' } },
};

async function loadOwnedApplication(opportunityId, studentId) {
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved') {
    throw new ApiError(404, 'طلب التدريب غير موجود أو غير معتمد');
  }
  if (isReadOnlyAfterFinalize(app.training_status)) {
    throw new ApiError(400, 'لا يمكن تعديل سجل التدريب بعد إنهاء التدريب', null, 'LOGBOOK_READONLY');
  }
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  return { app, opp };
}

async function assertStaffCanAccessEntry(user, entry) {
  const opp = await repo.findById(entry.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opp);
  await ftAccess.assertApplicationStudentAccess(user, entry.student_id);
  const app = await repo.findApplicationById(entry.application_id);
  await supervisorScope.assertReviewerCanAccessApplication(user, app);
  return { opp, app };
}

async function createDraft(opportunityId, studentId, body, userId) {
  const { app, opp } = await loadOwnedApplication(opportunityId, studentId);
  const entryDate = parseEntryDate(body.entry_date);
  assertEntryDateInTrainingWindow(entryDate, app, opp);
  const activity = String(body.activity || '').trim();
  const learning = String(body.learning_outcome || '').trim();
  if (!activity || !learning) {
    throw new ApiError(400, 'النشاط ونتيجة التعلم مطلوبان');
  }

  const row = await prisma.field_training_logbook_entries.create({
    data: {
      application_id: app.id,
      opportunity_id: opp.id,
      student_id: studentId,
      entry_date: entryDate,
      activity,
      learning_outcome: learning,
      skills: body.skills != null ? String(body.skills).trim() || null : null,
      challenges: body.challenges != null ? String(body.challenges).trim() || null : null,
      outcome: body.outcome != null ? String(body.outcome).trim() || null : null,
      reported_hours:
        body.reported_hours != null && body.reported_hours !== ''
          ? Number(body.reported_hours)
          : null,
      status: LOGBOOK_STATUS.DRAFT,
    },
    include: entryInclude,
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_LOGBOOK_CREATED',
    entityType: 'field_training_logbook_entry',
    entityId: row.id,
    newValues: { application_id: app.id, status: row.status },
  });

  return { entry: mapEntry(row) };
}

async function updateDraft(entryId, studentId, body) {
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, student_id: studentId, deleted_at: null },
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');
  if (!canStudentEdit(row.status)) {
    throw new ApiError(400, 'لا يمكن تعديل هذا السجل في حالته الحالية');
  }
  const app = await repo.findApplicationById(row.application_id);
  const opp = await repo.findById(row.opportunity_id);
  if (isReadOnlyAfterFinalize(app?.training_status)) {
    throw new ApiError(400, 'لا يمكن تعديل سجل التدريب بعد إنهاء التدريب');
  }

  const data = {};
  if (body.entry_date != null) {
    const entryDate = parseEntryDate(body.entry_date);
    assertEntryDateInTrainingWindow(entryDate, app, opp);
    data.entry_date = entryDate;
  }
  if (body.activity != null) data.activity = String(body.activity).trim();
  if (body.learning_outcome != null) data.learning_outcome = String(body.learning_outcome).trim();
  if (body.skills !== undefined) data.skills = body.skills ? String(body.skills).trim() : null;
  if (body.challenges !== undefined) {
    data.challenges = body.challenges ? String(body.challenges).trim() : null;
  }
  if (body.outcome !== undefined) data.outcome = body.outcome ? String(body.outcome).trim() : null;
  if (body.reported_hours !== undefined) {
    data.reported_hours =
      body.reported_hours === '' || body.reported_hours == null
        ? null
        : Number(body.reported_hours);
  }
  if (data.activity === '') throw new ApiError(400, 'النشاط مطلوب');
  if (data.learning_outcome === '') throw new ApiError(400, 'نتيجة التعلم مطلوبة');

  const updated = await prisma.field_training_logbook_entries.update({
    where: { id: entryId },
    data: { ...data, updated_at: new Date() },
    include: entryInclude,
  });
  return { entry: mapEntry(updated) };
}

async function submitEntry(entryId, studentId, userId) {
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, student_id: studentId, deleted_at: null },
    include: entryInclude,
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');

  const from = row.status;
  const to = LOGBOOK_STATUS.SUBMITTED;
  assertTransition(from, to);
  if (!String(row.activity || '').trim() || !String(row.learning_outcome || '').trim()) {
    throw new ApiError(400, 'أكمل الحقول المطلوبة قبل الإرسال');
  }

  const action = from === LOGBOOK_STATUS.REVISION_REQUESTED ? 'RESUBMITTED' : 'SUBMITTED';
  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.field_training_logbook_entries.update({
      where: { id: entryId },
      data: {
        status: to,
        submitted_at: new Date(),
        revision_comment: null,
        updated_at: new Date(),
      },
      include: entryInclude,
    });
    await tx.field_training_logbook_review_events.create({
      data: {
        entry_id: entryId,
        action,
        actor_user_id: userId,
      },
    });
    return entry;
  });

  await recordAudit({
    userId,
    actionType:
      action === 'RESUBMITTED'
        ? 'FIELD_TRAINING_LOGBOOK_RESUBMITTED'
        : 'FIELD_TRAINING_LOGBOOK_SUBMITTED',
    entityType: 'field_training_logbook_entry',
    entityId: entryId,
    newValues: { status: to, application_id: row.application_id },
  });

  const opp = await repo.findById(row.opportunity_id);
  await ftNotify.notifyLogbookSubmitted({
    opportunityId: row.opportunity_id,
    opportunityTitle: opp?.title,
    universityId: opp?.university_id,
    studentId,
    entryId,
    instructorId: opp?.assigned_instructor_id,
    applicationId: row.application_id,
    isResubmission: action === 'RESUBMITTED',
  });

  const fresh = await prisma.field_training_logbook_entries.findUnique({
    where: { id: entryId },
    include: entryInclude,
  });
  return { entry: mapEntry(fresh || updated) };
}

async function requestRevision(entryId, user, comment) {
  const note = String(comment || '').trim();
  if (!note) {
    throw new ApiError(400, 'سبب طلب التعديل مطلوب', null, 'LOGBOOK_REVISION_COMMENT_REQUIRED');
  }
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, deleted_at: null },
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');
  await assertStaffCanAccessEntry(user, row);
  assertTransition(row.status, LOGBOOK_STATUS.REVISION_REQUESTED);

  await prisma.$transaction(async (tx) => {
    await tx.field_training_logbook_entries.update({
      where: { id: entryId },
      data: {
        status: LOGBOOK_STATUS.REVISION_REQUESTED,
        revision_comment: note,
        reviewed_by_id: user.userId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      },
    });
    await tx.field_training_logbook_review_events.create({
      data: {
        entry_id: entryId,
        action: 'REVISION_REQUESTED',
        actor_user_id: user.userId,
        comment: note,
      },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_LOGBOOK_REVISION_REQUESTED',
    entityType: 'field_training_logbook_entry',
    entityId: entryId,
    newValues: { status: LOGBOOK_STATUS.REVISION_REQUESTED, application_id: row.application_id },
  });

  await ftNotify.notifyLogbookRevisionRequested({
    studentId: row.student_id,
    opportunityId: row.opportunity_id,
    entryId,
    comment: note,
  });

  const fresh = await prisma.field_training_logbook_entries.findUnique({
    where: { id: entryId },
    include: entryInclude,
  });
  return { entry: mapEntry(fresh) };
}

async function approveEntry(entryId, user) {
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, deleted_at: null },
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');
  await assertStaffCanAccessEntry(user, row);
  assertTransition(row.status, LOGBOOK_STATUS.APPROVED);

  await prisma.$transaction(async (tx) => {
    await tx.field_training_logbook_entries.update({
      where: { id: entryId },
      data: {
        status: LOGBOOK_STATUS.APPROVED,
        reviewed_by_id: user.userId,
        reviewed_at: new Date(),
        revision_comment: null,
        updated_at: new Date(),
      },
    });
    await tx.field_training_logbook_review_events.create({
      data: {
        entry_id: entryId,
        action: 'APPROVED',
        actor_user_id: user.userId,
      },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_LOGBOOK_APPROVED',
    entityType: 'field_training_logbook_entry',
    entityId: entryId,
    newValues: { status: LOGBOOK_STATUS.APPROVED, application_id: row.application_id },
  });

  await ftNotify.notifyLogbookApproved({
    studentId: row.student_id,
    opportunityId: row.opportunity_id,
    entryId,
  });

  const fresh = await prisma.field_training_logbook_entries.findUnique({
    where: { id: entryId },
    include: entryInclude,
  });
  return { entry: mapEntry(fresh) };
}

async function softDeleteDraft(entryId, studentId, userId) {
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, student_id: studentId, deleted_at: null },
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');
  if (!canStudentDelete(row.status)) {
    throw new ApiError(400, 'يمكن حذف المسودات فقط');
  }
  await prisma.field_training_logbook_entries.update({
    where: { id: entryId },
    data: { deleted_at: new Date() },
  });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_LOGBOOK_DELETED',
    entityType: 'field_training_logbook_entry',
    entityId: entryId,
    newValues: { soft_deleted: true },
  });
  return { ok: true };
}

async function addAttachment(entryId, studentId, file) {
  const row = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, student_id: studentId, deleted_at: null },
  });
  if (!row) throw new ApiError(404, 'سجل التدريب غير موجود');
  if (!canStudentEdit(row.status)) {
    throw new ApiError(400, 'لا يمكن إضافة مرفقات في هذه الحالة');
  }
  if (!file) throw new ApiError(400, 'الملف مطلوب');
  if (isBlockedExtension(file.originalname)) {
    throw new ApiError(400, 'نوع الملف غير مدعوم');
  }
  const check = isAllowedSubmissionFile({
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });
  if (!check.valid) throw new ApiError(400, check.message || 'نوع الملف غير مدعوم');

  const dir = path.join(env.UPLOAD_DIR || 'uploads', 'field-training', 'logbook', entryId);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.originalname || '') || '';
  const storedName = `${randomUUID()}${ext}`;
  const dest = path.join(dir, storedName);
  if (file.path && fs.existsSync(file.path)) {
    fs.renameSync(file.path, dest);
  } else if (file.buffer) {
    fs.writeFileSync(dest, file.buffer);
  } else {
    throw new ApiError(400, 'تعذر حفظ الملف');
  }
  const storageKey = path
    .join('field-training', 'logbook', entryId, storedName)
    .replace(/\\/g, '/');

  const attachment = await prisma.field_training_logbook_attachments.create({
    data: {
      entry_id: entryId,
      storage_key: storageKey,
      original_name: String(file.originalname || 'file').slice(0, 255),
      mime_type: file.mimetype || null,
      size_bytes: file.size || null,
    },
  });
  return { attachment: mapAttachment(attachment) };
}

async function resolveAttachmentAbsolutePath(storageKey) {
  return path.join(env.UPLOAD_DIR || 'uploads', storageKey);
}

async function downloadAttachment(attachmentId, user) {
  const attachment = await prisma.field_training_logbook_attachments.findUnique({
    where: { id: attachmentId },
    include: { field_training_logbook_entries: true },
  });
  if (!attachment) throw new ApiError(404, 'المرفق غير موجود');
  const entry = attachment.field_training_logbook_entries;
  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  const isStudent = roles.includes('student') && String(user.userId) === String(entry.student_id);
  if (!isStudent) {
    await assertStaffCanAccessEntry(user, entry);
  } else if (String(user.userId) !== String(entry.student_id)) {
    throw crossScopeForbidden('غير مصرح بتنزيل مرفق طالب آخر');
  }
  const abs = await resolveAttachmentAbsolutePath(attachment.storage_key);
  if (!fs.existsSync(abs)) throw new ApiError(404, 'الملف غير موجود');
  return {
    absolutePath: abs,
    originalName: attachment.original_name,
    mimeType: attachment.mime_type || 'application/octet-stream',
  };
}

async function listStudentEntries(opportunityId, studentId, query = {}) {
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app) throw new ApiError(404, 'طلب التدريب غير موجود');
  const { page, page_size, skip, take } = normalizePagination(query);
  const where = {
    application_id: app.id,
    student_id: studentId,
    deleted_at: null,
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.field_training_logbook_entries.count({ where }),
    prisma.field_training_logbook_entries.findMany({
      where,
      include: entryInclude,
      orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
      skip,
      take,
    }),
  ]);

  const allStatuses = await prisma.field_training_logbook_entries.groupBy({
    by: ['status'],
    where: { application_id: app.id, deleted_at: null },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(allStatuses.map((r) => [r.status, r._count._all]));

  return {
    entries: rows.map(mapEntry),
    summary: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      draft: counts.DRAFT || 0,
      submitted: counts.SUBMITTED || 0,
      revision_requested: counts.REVISION_REQUESTED || 0,
      approved: counts.APPROVED || 0,
    },
    meta: buildListMeta(total, page, page_size),
  };
}

async function listStaffEntries(opportunityId, query = {}, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opp);

  if (query.university_id && ftAccess.isUniversityScopedFieldTrainingUser(user)) {
    if (String(user.universityId) !== String(query.university_id)) {
      throw crossScopeForbidden('غير مصرح بالوصول إلى بيانات جامعة أخرى', {
        scopeType: 'university',
        code: 'FIELD_TRAINING_FORBIDDEN',
      });
    }
  }

  const studentUniversityId = ftAccess.resolveApplicationStudentUniversityId(
    user,
    query.university_id
  );
  const apps = await repo.findApplicationsByOpportunity(opportunityId, {
    status: 'approved',
    studentUniversityId,
    academicSupervisorWhere: supervisorScope.applicationSupervisorWhere(user),
  });
  const appIds = apps.map((a) => a.id);
  if (!appIds.length) {
    return {
      entries: [],
      summary: { pending: 0, revision_resubmissions: 0, approved: 0, total: 0 },
      meta: buildListMeta(0, 1, 25),
    };
  }

  const where = {
    opportunity_id: opportunityId,
    application_id: { in: appIds },
    deleted_at: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.student_id ? { student_id: query.student_id } : {}),
  };
  if (query.from || query.to) {
    where.entry_date = {};
    if (query.from) where.entry_date.gte = parseEntryDate(query.from);
    if (query.to) where.entry_date.lte = parseEntryDate(query.to);
  }

  const { page, page_size, skip, take } = normalizePagination({
    page: query.page,
    page_size: query.page_size || 25,
  });

  let rows = await prisma.field_training_logbook_entries.findMany({
    where,
    include: entryInclude,
    orderBy: [{ submitted_at: 'desc' }, { entry_date: 'desc' }],
  });

  if (query.search) {
    const q = String(query.search).trim().toLowerCase();
    const profiles = await repo.findStudentProfilesByIds([...new Set(rows.map((r) => r.student_id))]);
    const nameById = Object.fromEntries(
      profiles.map((p) => [p.id, `${p.full_name || ''} ${p.university_student_number || ''}`.toLowerCase()])
    );
    rows = rows.filter(
      (r) =>
        (nameById[r.student_id] || '').includes(q) ||
        String(r.activity || '')
          .toLowerCase()
          .includes(q)
    );
  }

  const summaryRows = await prisma.field_training_logbook_entries.groupBy({
    by: ['status'],
    where: {
      opportunity_id: opportunityId,
      application_id: { in: appIds },
      deleted_at: null,
    },
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(summaryRows.map((r) => [r.status, r._count._all]));

  const total = rows.length;
  const pageRows = rows.slice(skip, skip + take);
  const profiles = await repo.findStudentProfilesByIds([
    ...new Set(pageRows.map((r) => r.student_id)),
  ]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return {
    entries: pageRows.map((r) => ({
      ...mapEntry(r),
      student_name: profileById[r.student_id]?.full_name || '—',
      student_number: profileById[r.student_id]?.university_student_number || null,
    })),
    summary: {
      pending: byStatus.SUBMITTED || 0,
      revision_requested: byStatus.REVISION_REQUESTED || 0,
      approved: byStatus.APPROVED || 0,
      draft: byStatus.DRAFT || 0,
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    },
    meta: buildListMeta(total, page, page_size),
  };
}

async function getSummaryCountsForOpportunity(opportunityId, appIds) {
  if (!appIds.length) {
    return { pending: 0, revision_requested: 0, approved: 0, total: 0 };
  }
  const rows = await prisma.field_training_logbook_entries.groupBy({
    by: ['status'],
    where: {
      opportunity_id: opportunityId,
      application_id: { in: appIds },
      deleted_at: null,
    },
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  return {
    pending: byStatus.SUBMITTED || 0,
    revision_requested: byStatus.REVISION_REQUESTED || 0,
    approved: byStatus.APPROVED || 0,
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
  };
}

module.exports = {
  LOGBOOK_STATUS,
  createDraft,
  updateDraft,
  submitEntry,
  requestRevision,
  approveEntry,
  softDeleteDraft,
  addAttachment,
  downloadAttachment,
  listStudentEntries,
  listStaffEntries,
  getSummaryCountsForOpportunity,
  mapEntry,
};

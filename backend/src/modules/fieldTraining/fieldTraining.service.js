const path = require('path');
const fs = require('fs');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { uniqueSlugFromTitle } = require('./fieldTraining.slug');
const { assertPublishReady } = require('./fieldTraining.publishReadiness');
const { resolveStudentSpecialtyId } = require('../../utils/studentScope');
const {
  NO_SPECIALTY_MSG,
  requireStudentSpecialtyId,
  scopeAdminListQuery,
  assertAdminOpportunityAccess,
} = require('./fieldTraining.access');
const ftNotify = require('./fieldTraining.notifications');
const repo = require('./fieldTraining.repository');
const { assertActiveSpecialty } = require('../specialties/specialties.service');
const { prisma } = require('../../config/db');

function buildAdminWhere(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.training_mode) where.training_mode = query.training_mode;
  if (query.specialty_id) where.specialty_id = query.specialty_id;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { organization_name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
        { specialties: { name_ar: { contains: s, mode: 'insensitive' } } },
        { specialties: { name_en: { contains: s, mode: 'insensitive' } } },
      ];
    }
  }
  return where;
}

function buildStudentWhere(query, studentSpecialtyId) {
  const and = [{ specialty_id: studentSpecialtyId }];
  if (query.training_mode) and.push({ training_mode: query.training_mode });
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      and.push({
        OR: [
          { title: { contains: s, mode: 'insensitive' } },
          { organization_name: { contains: s, mode: 'insensitive' } },
          { short_description: { contains: s, mode: 'insensitive' } },
          { specialties: { name_ar: { contains: s, mode: 'insensitive' } } },
          { specialties: { name_en: { contains: s, mode: 'insensitive' } } },
        ],
      });
    }
  }
  return { AND: and };
}

async function mapBodyToCreateData(body) {
  const specialty = await assertActiveSpecialty(body.specialty_id, {
    requiredMessage: 'يرجى اختيار التخصص المرتبط بفرصة التدريب.',
    invalidMessage: 'التخصص المحدد غير متاح.',
  });
  return {
    title: body.title.trim(),
    specialty_id: specialty.id,
    university_id: null,
    organization_name: body.organization_name?.trim() || null,
    location: body.location.trim(),
    training_mode: body.training_mode,
    short_description: body.short_description ?? null,
    description: body.description ?? null,
    requirements: body.requirements ?? null,
    benefits: body.benefits ?? null,
    seats_limit: body.seats_limit ?? null,
    start_date: repo.toDateOnly(body.start_date),
    end_date: repo.toDateOnly(body.end_date),
    application_deadline: repo.toDateOnly(body.application_deadline),
    status: 'draft',
  };
}

async function mapBodyToUpdateData(body) {
  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.specialty_id != null) {
    const specialty = await assertActiveSpecialty(body.specialty_id, {
      requiredMessage: 'يرجى اختيار التخصص المرتبط بفرصة التدريب.',
      invalidMessage: 'التخصص المحدد غير متاح.',
    });
    data.specialty_id = specialty.id;
  }
  if (body.organization_name !== undefined) {
    data.organization_name = body.organization_name?.trim() || null;
  }
  if (body.location != null) data.location = body.location.trim();
  if (body.training_mode != null) data.training_mode = body.training_mode;
  if (body.short_description !== undefined) data.short_description = body.short_description;
  if (body.description !== undefined) data.description = body.description;
  if (body.requirements !== undefined) data.requirements = body.requirements;
  if (body.benefits !== undefined) data.benefits = body.benefits;
  if (body.seats_limit !== undefined) data.seats_limit = body.seats_limit;
  if (body.start_date !== undefined) data.start_date = repo.toDateOnly(body.start_date);
  if (body.end_date !== undefined) data.end_date = repo.toDateOnly(body.end_date);
  if (body.application_deadline !== undefined) {
    data.application_deadline = repo.toDateOnly(body.application_deadline);
  }
  return data;
}

async function listAdminOpportunities(query, user) {
  const scopedQuery = scopeAdminListQuery(user, query);
  const page = scopedQuery.page;
  const page_size = scopedQuery.page_size;
  const skip = (page - 1) * page_size;
  const { opportunities, total } = await repo.findManyAdmin({
    where: buildAdminWhere(scopedQuery),
    skip,
    take: page_size,
  });
  return {
    opportunities,
    meta: { page, page_size, total, total_pages: Math.max(1, Math.ceil(total / page_size)) },
  };
}

async function getAdminStats(query, user) {
  const scopedQuery = scopeAdminListQuery(user, query);
  const stats = await repo.getAdminAggregateStats(scopedQuery);
  return { stats };
}

async function getAdminOpportunityById(id, user) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, row);
  return { opportunity: repo.mapOpportunityRow(row) };
}

async function createAdminOpportunity(body, userId, user) {
  const slug = await uniqueSlugFromTitle(body.title, (s) => repo.slugExists(s));
  const opportunity = await repo.createOpportunity({
    ...(await mapBodyToCreateData(body)),
    slug,
    created_by_id: userId,
  });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_CREATED',
    entityType: 'field_training_opportunity',
    entityId: opportunity.id,
    newValues: { title: opportunity.title, status: opportunity.status },
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

async function updateAdminOpportunity(id, body, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, existing);

  const data = await mapBodyToUpdateData(body);
  if (data.title && data.title !== existing.title) {
    data.slug = await uniqueSlugFromTitle(data.title, (s) => repo.slugExists(s, id));
  }

  const opportunity = await repo.updateOpportunity(id, data);
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_UPDATED',
    entityType: 'field_training_opportunity',
    entityId: id,
    oldValues: { title: existing.title },
    newValues: data,
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

async function publishOpportunity(id, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, existing);
  assertPublishReady(existing);
  const opportunity = await repo.updateOpportunity(id, {
    status: 'published',
    published_at: new Date(),
  });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_PUBLISHED',
    entityType: 'field_training_opportunity',
    entityId: id,
    newValues: { status: 'published' },
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

async function archiveOpportunity(id, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, existing);
  const opportunity = await repo.updateOpportunity(id, { status: 'archived' });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_ARCHIVED',
    entityType: 'field_training_opportunity',
    entityId: id,
    newValues: { status: 'archived' },
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

async function listOpportunityApplications(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, opp);
  const apps = await repo.findApplicationsByOpportunity(opportunityId);
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));
  return {
    applications: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      student_name: byId[a.student_id]?.full_name ?? null,
      student_email: byId[a.student_id]?.email ?? null,
      student_university: byId[a.student_id]?.university?.name ?? null,
      student_specialty: byId[a.student_id]?.specialty ?? null,
    })),
  };
}

async function reviewApplication(applicationId, body, reviewerId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, opp);
  if (app.status !== 'pending') {
    throw new ApiError(400, 'Only pending applications can be reviewed');
  }

  const updated = await repo.updateApplication(applicationId, {
    status: body.status,
    admin_note: body.admin_note ?? null,
    reviewed_by_id: reviewerId,
    reviewed_at: new Date(),
  });

  const actionType =
    body.status === 'approved'
      ? 'FIELD_TRAINING_APPLICATION_APPROVED'
      : 'FIELD_TRAINING_APPLICATION_REJECTED';

  await recordAudit({
    userId: reviewerId,
    actionType,
    entityType: 'field_training_application',
    entityId: applicationId,
    newValues: { status: body.status },
  });

  if (body.status === 'approved') {
    await ftNotify.notifyStudentFieldTrainingApplicationApproved({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
    });
  } else {
    await ftNotify.notifyStudentFieldTrainingApplicationRejected({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
    });
  }

  return { application: repo.mapApplicationRow(updated) };
}

async function listStudentOpportunities(query, studentId) {
  const studentSpecialtyId = await resolveStudentSpecialtyId({ userId: studentId });
  if (!studentSpecialtyId) {
    return {
      opportunities: [],
      message: NO_SPECIALTY_MSG,
      profile_incomplete: true,
    };
  }

  const rows = await repo.findPublishedMany({
    where: buildStudentWhere(query, studentSpecialtyId),
  });
  const opportunities = await Promise.all(
    rows.map(async (row) => {
      const app = await repo.findApplicationByOpportunityAndStudent(row.id, studentId);
      return {
        ...repo.mapOpportunityRow(row),
        my_application_status: app?.status ?? null,
        my_application_id: app?.id ?? null,
      };
    })
  );
  return { opportunities };
}

async function listMyApplications(studentId) {
  const apps = await repo.findApplicationsByStudent(studentId);
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));
  return {
    applications: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      student_university: byId[a.student_id]?.university?.name ?? null,
      student_specialty: byId[a.student_id]?.specialty ?? null,
      opportunity: a.field_training_opportunities
        ? {
            id: a.field_training_opportunities.id,
            title: a.field_training_opportunities.title,
            specialty_id: a.field_training_opportunities.specialty_id ?? null,
            specialty: repo.mapSpecialtySummary(a.field_training_opportunities.specialties),
            organization_name: a.field_training_opportunities.organization_name,
            status: a.field_training_opportunities.status,
            training_mode: a.field_training_opportunities.training_mode,
          }
        : null,
    })),
  };
}

async function assertStudentCanAccessOpportunity(opportunity, studentId) {
  const studentSpecialtyId = await requireStudentSpecialtyId(studentId);
  if (!opportunity?.specialty_id) {
    throw new ApiError(404, 'Opportunity not found');
  }
  if (String(opportunity.specialty_id) !== String(studentSpecialtyId)) {
    throw new ApiError(404, 'Opportunity not found');
  }
}

async function getStudentOpportunityById(id, studentId) {
  const row = await repo.findPublishedById(id);
  if (!row) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(row, studentId);
  const app = await repo.findApplicationByOpportunityAndStudent(id, studentId);
  return {
    opportunity: {
      ...repo.mapOpportunityRow(row),
      my_application_status: app?.status ?? null,
      my_application_id: app?.id ?? null,
      my_application_message: app?.student_message ?? null,
    },
  };
}

async function applyToOpportunity(opportunityId, body, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(opp, studentId);

  const existing = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (existing && existing.status !== 'cancelled') {
    throw new ApiError(409, 'You have already applied to this opportunity');
  }

  if (opp.seats_limit != null) {
    const approved = await repo.countApprovedApplications(opportunityId);
    if (approved >= opp.seats_limit) {
      throw new ApiError(400, 'No seats available for this opportunity');
    }
  }

  if (opp.application_deadline) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const deadline = new Date(opp.application_deadline);
    if (today > deadline) {
      throw new ApiError(400, 'Application deadline has passed');
    }
  }

  let application;
  if (existing?.status === 'cancelled') {
    application = await repo.updateApplication(existing.id, {
      status: 'pending',
      student_message: body.student_message ?? null,
      admin_note: null,
      reviewed_by_id: null,
      reviewed_at: null,
    });
  } else {
    application = await repo.createApplication({
      opportunity_id: opportunityId,
      student_id: studentId,
      status: 'pending',
      student_message: body.student_message ?? null,
    });
  }

  await ftNotify.notifyAdminsFieldTrainingApplicationSubmitted({
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    studentId,
  });

  return { application: repo.mapApplicationRow(application) };
}

async function cancelApplication(applicationId, studentId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  if (app.student_id !== studentId) {
    throw new ApiError(403, 'Forbidden');
  }
  if (app.status !== 'pending') {
    throw new ApiError(400, 'Only pending applications can be cancelled');
  }
  const updated = await repo.updateApplication(applicationId, { status: 'cancelled' });
  return { application: repo.mapApplicationRow(updated) };
}

async function assertApprovedApplication(opportunityId, studentId) {
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved') {
    throw new ApiError(403, 'يجب قبول طلبك أولًا للوصول إلى المهام');
  }
  return app;
}

async function listOpportunityTasks(opportunityId, { studentId, user } = {}) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  if (user) assertAdminOpportunityAccess(user, opp);

  let applicationId;
  if (studentId) {
    const app = await assertApprovedApplication(opportunityId, studentId);
    applicationId = app.id;
  }

  const tasks = await repo.findTasksByOpportunity(opportunityId, { applicationId });
  return { tasks };
}

async function createOpportunityTask(opportunityId, body, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, opp);

  const count = await repo.countTasksByOpportunity(opportunityId);
  const task = await repo.createTask({
    opportunity_id: opportunityId,
    title: body.title.trim(),
    description: body.description ?? null,
    sort_order: body.sort_order ?? count,
    due_date: repo.toDateOnly(body.due_date),
  });
  return { task: repo.mapTaskRow(task) };
}

async function updateOpportunityTask(taskId, body, user) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  assertAdminOpportunityAccess(user, task.field_training_opportunities);

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.sort_order != null) data.sort_order = body.sort_order;
  if (body.due_date !== undefined) data.due_date = repo.toDateOnly(body.due_date);

  const updated = await repo.updateTask(taskId, data);
  return { task: repo.mapTaskRow(updated) };
}

async function deleteOpportunityTask(taskId, user) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  assertAdminOpportunityAccess(user, task.field_training_opportunities);
  await repo.deleteTask(taskId);
  return { ok: true };
}

async function listOpportunitySubmissions(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertAdminOpportunityAccess(user, opp);
  const submissions = await repo.findSubmissionsByOpportunity(opportunityId);
  const profiles = await repo.findStudentProfilesByIds([...new Set(submissions.map((s) => s.student_id))]);
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));
  return {
    submissions: submissions.map((s) => ({
      ...s,
      student_name: byId[s.student_id]?.full_name ?? null,
      student_email: byId[s.student_id]?.email ?? null,
      student_university: byId[s.student_id]?.university?.name ?? null,
      student_specialty: byId[s.student_id]?.specialty ?? null,
    })),
  };
}

async function downloadSubmissionFile(submissionId, user, { asAdmin = false } = {}) {
  const submission = await repo.findSubmissionById(submissionId);
  if (!submission) throw new ApiError(404, 'Submission not found');
  const opp = submission.field_training_tasks?.field_training_opportunities;
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  if (asAdmin) {
    assertAdminOpportunityAccess(user, opp);
  } else {
    if (submission.student_id !== user.userId) {
      throw new ApiError(403, 'Forbidden');
    }
    await assertStudentCanAccessOpportunity(opp, user.userId);
  }

  if (!repo.submissionFileExists(submission.file_path)) {
    throw new ApiError(404, 'File not found');
  }

  return {
    absPath: repo.resolveSubmissionAbsolutePath(submission.file_path),
    fileName: submission.file_name,
    mimeType: submission.mime_type || 'application/octet-stream',
  };
}

async function submitTaskFile(taskId, file, studentId) {
  if (!file) throw new ApiError(400, 'الملف مطلوب');

  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  if (task.field_training_opportunities?.status !== 'published') {
    throw new ApiError(400, 'الفرصة غير متاحة');
  }

  const app = await assertApprovedApplication(task.opportunity_id, studentId);
  const relative = repo.buildRelativeFilePath(taskId, path.basename(file.filename));

  const submission = await repo.upsertSubmission({
    taskId,
    applicationId: app.id,
    studentId,
    filePath: relative,
    fileName: file.originalname || file.filename,
    mimeType: file.mimetype,
  });

  await ftNotify.notifyAdminsFieldTrainingTaskSubmitted({
    opportunityId: task.opportunity_id,
    opportunityTitle: task.field_training_opportunities?.title,
    studentId,
    taskTitle: task.title,
  });

  return { submission: repo.mapSubmissionRow(submission) };
}

async function listStudentOpportunityTasks(opportunityId, studentId) {
  const published = await repo.findPublishedById(opportunityId);
  if (!published) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(published, studentId);
  return listOpportunityTasks(opportunityId, { studentId });
}

module.exports = {
  listAdminOpportunities,
  getAdminStats,
  getAdminOpportunityById,
  createAdminOpportunity,
  updateAdminOpportunity,
  publishOpportunity,
  archiveOpportunity,
  listOpportunityApplications,
  reviewApplication,
  listStudentOpportunities,
  listMyApplications,
  getStudentOpportunityById,
  applyToOpportunity,
  cancelApplication,
  listOpportunityTasks,
  createOpportunityTask,
  updateOpportunityTask,
  deleteOpportunityTask,
  listOpportunitySubmissions,
  downloadSubmissionFile,
  submitTaskFile,
  listStudentOpportunityTasks,
};

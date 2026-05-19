const path = require('path');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { uniqueSlugFromTitle } = require('./fieldTraining.slug');
const { assertPublishReady } = require('./fieldTraining.publishReadiness');
const repo = require('./fieldTraining.repository');

function buildAdminWhere(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.training_mode) where.training_mode = query.training_mode;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { organization_name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
      ];
    }
  }
  return where;
}

function buildStudentWhere(query) {
  const where = {};
  if (query.training_mode) where.training_mode = query.training_mode;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { organization_name: { contains: s, mode: 'insensitive' } },
        { short_description: { contains: s, mode: 'insensitive' } },
      ];
    }
  }
  return where;
}

function mapBodyToCreateData(body) {
  return {
    title: body.title.trim(),
    organization_name: body.organization_name.trim(),
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

function mapBodyToUpdateData(body) {
  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.organization_name != null) data.organization_name = body.organization_name.trim();
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

async function listAdminOpportunities(query) {
  const page = query.page;
  const page_size = query.page_size;
  const skip = (page - 1) * page_size;
  const { opportunities, total } = await repo.findManyAdmin({
    where: buildAdminWhere(query),
    skip,
    take: page_size,
  });
  return {
    opportunities,
    meta: { page, page_size, total, total_pages: Math.max(1, Math.ceil(total / page_size)) },
  };
}

async function getAdminOpportunityById(id) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Opportunity not found');
  return { opportunity: repo.mapOpportunityRow(row) };
}

async function createAdminOpportunity(body, userId) {
  const slug = await uniqueSlugFromTitle(body.title, (s) => repo.slugExists(s));
  const opportunity = await repo.createOpportunity({
    ...mapBodyToCreateData(body),
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

async function updateAdminOpportunity(id, body, userId) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');

  const data = mapBodyToUpdateData(body);
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

async function publishOpportunity(id, userId) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
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

async function archiveOpportunity(id, userId) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
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

async function listOpportunityApplications(opportunityId) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const apps = await repo.findApplicationsByOpportunity(opportunityId);
  const users = await repo.findUsersByIds([...new Set(apps.map((a) => a.student_id))]);
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return {
    applications: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      student_name: byId[a.student_id]?.full_name ?? null,
      student_email: byId[a.student_id]?.email ?? null,
    })),
  };
}

async function reviewApplication(applicationId, body, reviewerId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
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

  return { application: repo.mapApplicationRow(updated) };
}

async function listStudentOpportunities(query, studentId) {
  const rows = await repo.findPublishedMany({ where: buildStudentWhere(query) });
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
  return {
    applications: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      opportunity: a.field_training_opportunities
        ? {
            id: a.field_training_opportunities.id,
            title: a.field_training_opportunities.title,
            organization_name: a.field_training_opportunities.organization_name,
            status: a.field_training_opportunities.status,
            training_mode: a.field_training_opportunities.training_mode,
          }
        : null,
    })),
  };
}

async function getStudentOpportunityById(id, studentId) {
  const row = await repo.findPublishedById(id);
  if (!row) throw new ApiError(404, 'Opportunity not found');
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

async function listOpportunityTasks(opportunityId, { studentId } = {}) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  let applicationId;
  if (studentId) {
    const app = await assertApprovedApplication(opportunityId, studentId);
    applicationId = app.id;
  }

  const tasks = await repo.findTasksByOpportunity(opportunityId, { applicationId });
  return { tasks };
}

async function createOpportunityTask(opportunityId, body) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

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

async function updateOpportunityTask(taskId, body) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.sort_order != null) data.sort_order = body.sort_order;
  if (body.due_date !== undefined) data.due_date = repo.toDateOnly(body.due_date);

  const updated = await repo.updateTask(taskId, data);
  return { task: repo.mapTaskRow(updated) };
}

async function deleteOpportunityTask(taskId) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  await repo.deleteTask(taskId);
  return { ok: true };
}

async function listOpportunitySubmissions(opportunityId) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const submissions = await repo.findSubmissionsByOpportunity(opportunityId);
  const studentIds = [...new Set(submissions.map((s) => s.student_id))];
  const users = await repo.findUsersByIds(studentIds);
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return {
    submissions: submissions.map((s) => ({
      ...s,
      student_name: byId[s.student_id]?.full_name ?? null,
      student_email: byId[s.student_id]?.email ?? null,
    })),
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

  return { submission: repo.mapSubmissionRow(submission) };
}

async function listStudentOpportunityTasks(opportunityId, studentId) {
  const published = await repo.findPublishedById(opportunityId);
  if (!published) throw new ApiError(404, 'Opportunity not found');
  return listOpportunityTasks(opportunityId, { studentId });
}

module.exports = {
  listAdminOpportunities,
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
  submitTaskFile,
  listStudentOpportunityTasks,
};

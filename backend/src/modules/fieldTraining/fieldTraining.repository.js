const path = require('path');
const { prisma } = require('../../config/db');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');

function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function mapOpportunityRow(row, { applicationsCount } = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    organization_name: row.organization_name,
    location: row.location,
    training_mode: row.training_mode,
    short_description: row.short_description,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    seats_limit: row.seats_limit,
    start_date: formatDateOnly(row.start_date),
    end_date: formatDateOnly(row.end_date),
    application_deadline: formatDateOnly(row.application_deadline),
    status: row.status,
    created_by_id: row.created_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    applications_count: applicationsCount ?? row._count?.field_training_applications ?? 0,
  };
}

function mapApplicationRow(row) {
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    student_id: row.student_id,
    status: row.status,
    student_message: row.student_message,
    admin_note: row.admin_note,
    reviewed_by_id: row.reviewed_by_id,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findManyAdmin({ where, skip, take }) {
  const [rows, total] = await Promise.all([
    prisma.field_training_opportunities.findMany({
      where,
      skip,
      take,
      orderBy: { updated_at: 'desc' },
      include: { _count: { select: { field_training_applications: true } } },
    }),
    prisma.field_training_opportunities.count({ where }),
  ]);
  return {
    opportunities: rows.map((r) => mapOpportunityRow(r)),
    total,
  };
}

async function findById(id) {
  return prisma.field_training_opportunities.findUnique({
    where: { id },
    include: { _count: { select: { field_training_applications: true } } },
  });
}

async function findPublishedById(id) {
  return prisma.field_training_opportunities.findFirst({
    where: { id, status: 'published' },
  });
}

async function findPublishedMany({ where }) {
  return prisma.field_training_opportunities.findMany({
    where: { ...where, status: 'published' },
    orderBy: { published_at: 'desc' },
  });
}

async function slugExists(slug, excludeId) {
  const row = await prisma.field_training_opportunities.findFirst({
    where: {
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function createOpportunity(data) {
  return prisma.field_training_opportunities.create({ data });
}

async function updateOpportunity(id, data) {
  return prisma.field_training_opportunities.update({ where: { id }, data });
}

async function findApplicationByOpportunityAndStudent(opportunityId, studentId) {
  return prisma.field_training_applications.findUnique({
    where: {
      opportunity_id_student_id: { opportunity_id: opportunityId, student_id: studentId },
    },
  });
}

async function findApplicationById(id) {
  return prisma.field_training_applications.findUnique({ where: { id } });
}

async function findApplicationsByOpportunity(opportunityId) {
  return prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { created_at: 'desc' },
  });
}

async function findApplicationsByStudent(studentId) {
  return prisma.field_training_applications.findMany({
    where: { student_id: studentId },
    orderBy: { created_at: 'desc' },
    include: {
      field_training_opportunities: {
        select: {
          id: true,
          title: true,
          organization_name: true,
          status: true,
          training_mode: true,
        },
      },
    },
  });
}

async function createApplication(data) {
  return prisma.field_training_applications.create({ data });
}

async function updateApplication(id, data) {
  return prisma.field_training_applications.update({ where: { id }, data });
}

async function findUsersByIds(ids) {
  if (!ids.length) return [];
  return prisma.users.findMany({
    where: { id: { in: ids } },
    select: { id: true, full_name: true, email: true },
  });
}

async function countApprovedApplications(opportunityId) {
  return prisma.field_training_applications.count({
    where: { opportunity_id: opportunityId, status: 'approved' },
  });
}

function mapTaskRow(row) {
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    title: row.title,
    description: row.description,
    sort_order: row.sort_order,
    due_date: formatDateOnly(row.due_date),
    created_at: row.created_at,
    updated_at: row.updated_at,
    submission: row.field_training_task_submissions?.[0]
      ? mapSubmissionRow(row.field_training_task_submissions[0])
      : null,
  };
}

function mapSubmissionRow(row) {
  const stored = row.file_path;
  return {
    id: row.id,
    task_id: row.task_id,
    application_id: row.application_id,
    student_id: row.student_id,
    file_path: stored,
    file_url: resolvePublicUrl(stored),
    file_name: row.file_name,
    mime_type: row.mime_type,
    submitted_at: row.submitted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findTasksByOpportunity(opportunityId, { applicationId } = {}) {
  const rows = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { sort_order: 'asc' },
    include: applicationId
      ? {
          field_training_task_submissions: {
            where: { application_id: applicationId },
            take: 1,
          },
        }
      : undefined,
  });
  return rows.map((r) => mapTaskRow(r));
}

async function findTaskById(taskId) {
  return prisma.field_training_tasks.findUnique({
    where: { id: taskId },
    include: { field_training_opportunities: { select: { id: true, status: true, title: true } } },
  });
}

async function createTask(data) {
  return prisma.field_training_tasks.create({ data });
}

async function updateTask(taskId, data) {
  return prisma.field_training_tasks.update({ where: { id: taskId }, data });
}

async function deleteTask(taskId) {
  return prisma.field_training_tasks.delete({ where: { id: taskId } });
}

async function countTasksByOpportunity(opportunityId) {
  return prisma.field_training_tasks.count({ where: { opportunity_id: opportunityId } });
}

async function findSubmissionsByOpportunity(opportunityId) {
  const rows = await prisma.field_training_task_submissions.findMany({
    where: {
      field_training_tasks: { opportunity_id: opportunityId },
    },
    orderBy: { submitted_at: 'desc' },
    include: {
      field_training_tasks: { select: { id: true, title: true } },
      field_training_applications: { select: { id: true, student_id: true } },
    },
  });
  return rows.map((r) => ({
    ...mapSubmissionRow(r),
    task_title: r.field_training_tasks?.title ?? null,
    application_id: r.application_id,
  }));
}

async function findSubmissionByTaskAndApplication(taskId, applicationId) {
  return prisma.field_training_task_submissions.findUnique({
    where: {
      task_id_application_id: { task_id: taskId, application_id: applicationId },
    },
  });
}

async function upsertSubmission({ taskId, applicationId, studentId, filePath, fileName, mimeType }) {
  const relative = filePath.replace(/\\/g, '/');
  return prisma.field_training_task_submissions.upsert({
    where: {
      task_id_application_id: { task_id: taskId, application_id: applicationId },
    },
    create: {
      task_id: taskId,
      application_id: applicationId,
      student_id: studentId,
      file_path: relative,
      file_name: fileName,
      mime_type: mimeType,
    },
    update: {
      file_path: relative,
      file_name: fileName,
      mime_type: mimeType,
      submitted_at: new Date(),
    },
  });
}

function buildRelativeFilePath(taskId, filename) {
  return path.posix.join('field-training', taskId, filename);
}

module.exports = {
  toDateOnly,
  mapOpportunityRow,
  mapApplicationRow,
  findManyAdmin,
  findById,
  findPublishedById,
  findPublishedMany,
  slugExists,
  createOpportunity,
  updateOpportunity,
  findApplicationByOpportunityAndStudent,
  findApplicationById,
  findApplicationsByOpportunity,
  findApplicationsByStudent,
  createApplication,
  updateApplication,
  findUsersByIds,
  countApprovedApplications,
  mapTaskRow,
  mapSubmissionRow,
  findTasksByOpportunity,
  findTaskById,
  createTask,
  updateTask,
  deleteTask,
  countTasksByOpportunity,
  findSubmissionsByOpportunity,
  findSubmissionByTaskAndApplication,
  upsertSubmission,
  buildRelativeFilePath,
};

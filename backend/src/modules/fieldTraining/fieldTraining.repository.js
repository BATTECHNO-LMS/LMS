const path = require('path');
const fs = require('fs');
const { prisma } = require('../../config/db');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const { env } = require('../../config/env');

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

const opportunityInclude = {
  _count: { select: { field_training_applications: true } },
  universities: {
    select: {
      id: true,
      name: true,
      university_email_domains: {
        where: { is_active: true },
        select: { domain: true },
        orderBy: { domain: 'asc' },
      },
    },
  },
  specialties: {
    select: {
      id: true,
      name_ar: true,
      name_en: true,
      code: true,
      status: true,
    },
  },
};

function mapSpecialtySummary(specialty) {
  if (!specialty) return null;
  return {
    id: specialty.id,
    name_ar: specialty.name_ar,
    name_en: specialty.name_en,
    code: specialty.code ?? null,
    status: specialty.status,
  };
}

function mapUniversitySummary(university) {
  if (!university) return null;
  return {
    id: university.id,
    name: university.name,
    logoUrl: null,
    domains: (university.university_email_domains ?? []).map((d) => d.domain),
  };
}

function mapOpportunityRow(row, { applicationsCount } = {}) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    university_id: row.university_id ?? null,
    university: mapUniversitySummary(row.universities),
    specialty_id: row.specialty_id ?? null,
    specialty: mapSpecialtySummary(row.specialties),
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
      include: opportunityInclude,
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
    include: opportunityInclude,
  });
}

async function findPublishedById(id) {
  return prisma.field_training_opportunities.findFirst({
    where: { id, status: 'published' },
    include: opportunityInclude,
  });
}

async function findPublishedMany({ where }) {
  return prisma.field_training_opportunities.findMany({
    where: { ...where, status: 'published' },
    orderBy: { published_at: 'desc' },
    include: opportunityInclude,
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
  return prisma.field_training_opportunities.create({
    data,
    include: opportunityInclude,
  });
}

async function updateOpportunity(id, data) {
  return prisma.field_training_opportunities.update({
    where: { id },
    data,
    include: opportunityInclude,
  });
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
          university_id: true,
          specialty_id: true,
          status: true,
          training_mode: true,
          specialties: {
            select: { id: true, name_ar: true, name_en: true, code: true, status: true },
          },
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

async function findStudentProfilesByIds(ids) {
  if (!ids.length) return [];
  const users = await prisma.users.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      full_name: true,
      email: true,
      primary_university_id: true,
      specialty_id: true,
      specialties: {
        select: { id: true, name_ar: true, name_en: true, code: true, status: true },
      },
    },
  });
  const uniIds = [...new Set(users.map((u) => u.primary_university_id).filter(Boolean))];
  const universities = uniIds.length
    ? await prisma.universities.findMany({
        where: { id: { in: uniIds } },
        select: { id: true, name: true },
      })
    : [];
  const uniById = Object.fromEntries(universities.map((u) => [u.id, u]));
  return users.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    primary_university_id: u.primary_university_id,
    university: u.primary_university_id ? uniById[u.primary_university_id] ?? null : null,
    specialty: mapSpecialtySummary(u.specialties),
  }));
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

function mapSubmissionRow(row, { exposePublicUrl = false } = {}) {
  const stored = row.file_path;
  return {
    id: row.id,
    task_id: row.task_id,
    application_id: row.application_id,
    student_id: row.student_id,
    file_path: stored,
    file_url: exposePublicUrl ? resolvePublicUrl(stored) : null,
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

function inDateRange(field, filters) {
  if (!filters?.from && !filters?.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

function buildStatsWhere(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.training_mode) where.training_mode = filters.training_mode;
  if (filters.university_id) where.university_id = filters.university_id;
  if (filters.specialty_id) where.specialty_id = filters.specialty_id;
  if (filters.search) {
    const s = filters.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { organization_name: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
        { universities: { name: { contains: s, mode: 'insensitive' } } },
      ];
    }
  }
  return where;
}

async function getAdminAggregateStats(filters = {}) {
  const oppWhere = buildStatsWhere(filters);
  const oppDateWhere = inDateRange('created_at', filters);
  const appDateWhere = inDateRange('created_at', filters);
  const taskDateWhere = inDateRange('created_at', filters);
  const subDateWhere = inDateRange('submitted_at', filters);

  const [
    totalOpportunities,
    publishedOpportunities,
    draftOpportunities,
    archivedOpportunities,
    totalApplications,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    totalTasks,
    totalSubmissions,
    byUniversityRows,
    byModeRows,
  ] = await Promise.all([
    prisma.field_training_opportunities.count({ where: { ...oppWhere, ...oppDateWhere } }),
    prisma.field_training_opportunities.count({
      where: { ...oppWhere, ...oppDateWhere, status: 'published' },
    }),
    prisma.field_training_opportunities.count({
      where: { ...oppWhere, ...oppDateWhere, status: 'draft' },
    }),
    prisma.field_training_opportunities.count({
      where: { ...oppWhere, ...oppDateWhere, status: 'archived' },
    }),
    prisma.field_training_applications.count({
      where: {
        ...appDateWhere,
        ...(filters.university_id
          ? { field_training_opportunities: { university_id: filters.university_id } }
          : {}),
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'pending',
        ...appDateWhere,
        ...(filters.university_id
          ? { field_training_opportunities: { university_id: filters.university_id } }
          : {}),
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'approved',
        ...appDateWhere,
        ...(filters.university_id
          ? { field_training_opportunities: { university_id: filters.university_id } }
          : {}),
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'rejected',
        ...appDateWhere,
        ...(filters.university_id
          ? { field_training_opportunities: { university_id: filters.university_id } }
          : {}),
      },
    }),
    prisma.field_training_tasks.count({
      where: {
        ...taskDateWhere,
        ...(filters.university_id
          ? { field_training_opportunities: { university_id: filters.university_id } }
          : {}),
      },
    }),
    prisma.field_training_task_submissions.count({
      where: {
        ...subDateWhere,
        ...(filters.university_id
          ? {
              field_training_tasks: {
                field_training_opportunities: { university_id: filters.university_id },
              },
            }
          : {}),
      },
    }),
    prisma.field_training_opportunities.groupBy({
      by: ['university_id'],
      where: { ...oppWhere, ...oppDateWhere, university_id: { not: null } },
      _count: { _all: true },
    }),
    prisma.field_training_opportunities.groupBy({
      by: ['training_mode'],
      where: { ...oppWhere, ...oppDateWhere },
      _count: { _all: true },
    }),
  ]);

  const uniIds = byUniversityRows.map((r) => r.university_id).filter(Boolean);
  const universities = uniIds.length
    ? await prisma.universities.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } })
    : [];
  const uniName = new Map(universities.map((u) => [u.id, u.name]));

  return {
    totalOpportunities,
    publishedOpportunities,
    draftOpportunities,
    archivedOpportunities,
    totalApplications,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    totalTasks,
    totalSubmissions,
    byUniversity: byUniversityRows.map((r) => ({
      university_id: r.university_id,
      name: uniName.get(r.university_id) || r.university_id,
      count: r._count._all,
    })),
    byTrainingMode: byModeRows.map((r) => ({
      training_mode: r.training_mode,
      count: r._count._all,
    })),
  };
}

async function findSubmissionById(submissionId) {
  return prisma.field_training_task_submissions.findUnique({
    where: { id: submissionId },
    include: {
      field_training_tasks: {
        select: {
          id: true,
          title: true,
          opportunity_id: true,
          field_training_opportunities: {
            select: { id: true, title: true, university_id: true, status: true },
          },
        },
      },
    },
  });
}

function resolveSubmissionAbsolutePath(relativePath) {
  const uploadRoot = path.resolve(env.UPLOAD_DIR || 'uploads');
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid file path');
  }
  const abs = path.resolve(uploadRoot, normalized);
  if (!abs.startsWith(uploadRoot)) {
    throw new Error('Invalid file path');
  }
  return abs;
}

function submissionFileExists(relativePath) {
  try {
    const abs = resolveSubmissionAbsolutePath(relativePath);
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

module.exports = {
  toDateOnly,
  mapUniversitySummary,
  mapSpecialtySummary,
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
  findStudentProfilesByIds,
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
  getAdminAggregateStats,
  findSubmissionById,
  resolveSubmissionAbsolutePath,
  submissionFileExists,
};

const path = require('path');
const fs = require('fs');
const { prisma } = require('../../config/db');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const { env } = require('../../config/env');
const hoursMod = require('./fieldTraining.hours');

function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

const opportunityListInclude = {
  _count: { select: { field_training_applications: true } },
  universities: {
    select: { id: true, name: true },
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

function formatSpecialtyLabel(specialty, fallback = 'غير محدد') {
  if (!specialty) return fallback;
  return specialty.name_ar || specialty.name_en || fallback;
}

function mapUniversitySummary(university) {
  if (!university) return null;
  // Already-mapped API shape
  if (Array.isArray(university.domains) && university.university_email_domains == null) {
    return {
      id: university.id,
      name: university.name,
      logoUrl: university.logoUrl ?? null,
      domains: university.domains,
    };
  }
  return {
    id: university.id,
    name: university.name,
    logoUrl: null,
    domains: (university.university_email_domains ?? []).map((d) => d.domain),
  };
}

function mapApplicationRow(row) {
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    student_id: row.student_id,
    status: row.status,
    training_status: row.training_status ?? 'none',
    student_message: row.student_message,
    admin_note: row.admin_note,
    reviewed_by_id: row.reviewed_by_id,
    reviewed_at: row.reviewed_at,
    training_started_at: row.training_started_at ?? null,
    pre_assessment_score: row.pre_assessment_score != null ? Number(row.pre_assessment_score) : null,
    pre_assessment_level: row.pre_assessment_level ?? null,
    post_assessment_score: row.post_assessment_score != null ? Number(row.post_assessment_score) : null,
    attendance_percentage:
      row.attendance_percentage != null ? Number(row.attendance_percentage) : null,
    completed_training_hours:
      row.completed_training_hours != null ? Number(row.completed_training_hours) : 0,
    hours_updated_at: row.hours_updated_at ?? null,
    hours_updated_by_id: row.hours_updated_by_id ?? null,
    final_task_status: row.final_task_status ?? 'not_required',
    completion_eligibility_status: row.completion_eligibility_status ?? 'pending',
    eligibility_reason: row.eligibility_reason ?? null,
    expelled_at: row.expelled_at ?? null,
    expelled_by_id: row.expelled_by_id ?? null,
    expulsion_reason: row.expulsion_reason ?? null,
    completion_letter_issued_at: row.completion_letter_issued_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOpportunityRow(row, { applicationsCount, compact = false } = {}) {
  // Accept Prisma include shape (`specialties` / `universities`) or an already-mapped API row
  // (`specialty` / `university`) so list endpoints never wipe nested summaries on remapping.
  const specialtySource = row.specialties ?? row.specialty ?? null;
  const universitySource = row.universities ?? row.university ?? null;
  const mapped = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    university_id: row.university_id ?? null,
    university: mapUniversitySummary(universitySource),
    specialty_id: row.specialty_id ?? specialtySource?.id ?? null,
    specialty: mapSpecialtySummary(specialtySource),
    assigned_instructor_id: row.assigned_instructor_id ?? null,
    organization_name: row.organization_name,
    location: row.location,
    training_mode: row.training_mode,
    short_description: row.short_description,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    seats_limit: row.seats_limit,
    required_training_hours:
      row.required_training_hours != null ? Number(row.required_training_hours) : null,
    start_date: formatDateOnly(row.start_date),
    end_date: formatDateOnly(row.end_date),
    application_deadline: formatDateOnly(row.application_deadline),
    requires_pre_assessment: row.requires_pre_assessment ?? true,
    requires_post_assessment: row.requires_post_assessment ?? true,
    requires_final_task: row.requires_final_task ?? true,
    minimum_attendance_percentage: row.minimum_attendance_percentage ?? null,
    minimum_post_assessment_score:
      row.minimum_post_assessment_score != null ? Number(row.minimum_post_assessment_score) : null,
    completion_rules: row.completion_rules ?? null,
    status: row.status,
    training_started_at: row.training_started_at ?? null,
    created_by_id: row.created_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    applications_count:
      applicationsCount ??
      row._count?.field_training_applications ??
      row.applications_count ??
      0,
  };
  if (!compact) return mapped;
  const { description, requirements, benefits, completion_rules, ...listRow } = mapped;
  return listRow;
}

async function findManyAdmin({ where, skip, take }) {
  const [rows, total] = await Promise.all([
    prisma.field_training_opportunities.findMany({
      where,
      skip,
      take,
      orderBy: { updated_at: 'desc' },
      include: opportunityListInclude,
    }),
    prisma.field_training_opportunities.count({ where }),
  ]);
  // Return raw Prisma rows — callers map once (avoids double-map wiping specialty/university).
  return {
    opportunities: rows,
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
    where: { id, status: { in: ['published', 'in_progress'] } },
    include: opportunityInclude,
  });
}

async function findPublishedMany({ where }) {
  return prisma.field_training_opportunities.findMany({
    where: { ...where, status: { in: ['published', 'in_progress'] } },
    orderBy: { published_at: 'desc' },
    include: opportunityListInclude,
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

async function findApplicationsByOpportunity(opportunityId, filters = {}) {
  const { status, training_status, university_id, university_specialty_id, studentUniversityId } =
    filters;
  let studentIds;
  if (university_id || university_specialty_id || studentUniversityId) {
    const userWhere = {};
    if (studentUniversityId) userWhere.primary_university_id = studentUniversityId;
    if (university_id) userWhere.primary_university_id = university_id;
    if (university_specialty_id) userWhere.university_specialty_id = university_specialty_id;
    const users = await prisma.users.findMany({ where: userWhere, select: { id: true } });
    studentIds = users.map((user) => user.id);
    if (!studentIds.length) return [];
  }

  const where = { opportunity_id: opportunityId };
  if (status) where.status = status;
  if (training_status) where.training_status = training_status;
  if (studentIds) where.student_id = { in: studentIds };

  return prisma.field_training_applications.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
}

async function aggregateApplicationCounts(opportunityId, { studentUniversityId } = {}) {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId },
    select: { student_id: true },
  });
  if (!apps.length) {
    return { by_university: [], by_university_specialty: {}, total: 0 };
  }

  const studentWhere = { id: { in: [...new Set(apps.map((app) => app.student_id))] } };
  if (studentUniversityId) studentWhere.primary_university_id = studentUniversityId;

  const students = await prisma.users.findMany({
    where: studentWhere,
    select: { id: true, primary_university_id: true, university_specialty_id: true },
  });
  const studentById = Object.fromEntries(students.map((student) => [student.id, student]));
  const byUniversity = new Map();
  const byUniversitySpecialty = {};

  for (const app of apps) {
    const student = studentById[app.student_id];
    if (!student) continue;
    if (student.primary_university_id) {
      byUniversity.set(
        student.primary_university_id,
        (byUniversity.get(student.primary_university_id) || 0) + 1
      );
    }
    if (student.university_specialty_id) {
      byUniversitySpecialty[student.university_specialty_id] =
        (byUniversitySpecialty[student.university_specialty_id] || 0) + 1;
    }
  }

  const universityIds = [...byUniversity.keys()];
  const universities = universityIds.length
    ? await prisma.universities.findMany({
        where: { id: { in: universityIds } },
        select: { id: true, name: true },
      })
    : [];
  const universityById = Object.fromEntries(universities.map((university) => [university.id, university]));

  return {
    by_university: [...byUniversity.entries()].map(([university_id, count]) => ({
      university_id,
      name: universityById[university_id]?.name ?? null,
      count,
    })),
    by_university_specialty: byUniversitySpecialty,
    total: Object.values(studentById).length
      ? apps.filter((app) => studentById[app.student_id]).length
      : 0,
  };
}

async function aggregateApplicationCountsForOpportunities(opportunityIds = [], { studentUniversityId } = {}) {
  const ids = [...new Set(opportunityIds.filter(Boolean))];
  const empty = Object.fromEntries(ids.map((id) => [id, { by_university: [], by_university_specialty: {}, total: 0 }]));
  if (!ids.length) return empty;

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: { in: ids } },
    select: { opportunity_id: true, student_id: true },
  });
  if (!apps.length) return empty;

  const studentWhere = { id: { in: [...new Set(apps.map((app) => app.student_id))] } };
  if (studentUniversityId) studentWhere.primary_university_id = studentUniversityId;

  const students = await prisma.users.findMany({
    where: studentWhere,
    select: { id: true, primary_university_id: true, university_specialty_id: true },
  });
  const studentById = Object.fromEntries(students.map((student) => [student.id, student]));

  const universityIds = new Set();
  const result = { ...empty };

  for (const app of apps) {
    const student = studentById[app.student_id];
    if (!student) continue;
    const bucket =
      result[app.opportunity_id] ?? (result[app.opportunity_id] = { by_university: [], by_university_specialty: {}, total: 0 });
    bucket.total += 1;
    if (student.primary_university_id) {
      universityIds.add(student.primary_university_id);
      const existing = bucket._uniMap ?? (bucket._uniMap = new Map());
      existing.set(student.primary_university_id, (existing.get(student.primary_university_id) || 0) + 1);
    }
    if (student.university_specialty_id) {
      bucket.by_university_specialty[student.university_specialty_id] =
        (bucket.by_university_specialty[student.university_specialty_id] || 0) + 1;
    }
  }

  const universities = universityIds.size
    ? await prisma.universities.findMany({
        where: { id: { in: [...universityIds] } },
        select: { id: true, name: true },
      })
    : [];
  const universityById = Object.fromEntries(universities.map((university) => [university.id, university]));

  for (const id of ids) {
    const bucket = result[id];
    if (!bucket?._uniMap) continue;
    bucket.by_university = [...bucket._uniMap.entries()].map(([university_id, count]) => ({
      university_id,
      name: universityById[university_id]?.name ?? null,
      count,
    }));
    delete bucket._uniMap;
  }

  return result;
}

async function findApplicationsByOpportunityIdsForStudent(opportunityIds, studentId) {
  if (!opportunityIds.length) return [];
  return prisma.field_training_applications.findMany({
    where: { student_id: studentId, opportunity_id: { in: opportunityIds } },
    select: { id: true, opportunity_id: true, status: true, training_status: true },
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
      phone: true,
      status: true,
      primary_university_id: true,
      university_specialty_id: true,
      specialty_id: true,
      specialties: {
        select: { id: true, name_ar: true, name_en: true, code: true, status: true },
      },
      university_specialty: {
        select: {
          id: true,
          name_ar: true,
          name_en: true,
          code: true,
          status: true,
          specialty_id: true,
        },
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
  return users.map((u) => {
    const displaySpecialty = u.university_specialty
      ? {
          id: u.university_specialty.id,
          name_ar: u.university_specialty.name_ar,
          name_en: u.university_specialty.name_en,
          code: u.university_specialty.code,
          status: u.university_specialty.status,
          canonical_specialty_id: u.university_specialty.specialty_id,
        }
      : mapSpecialtySummary(u.specialties);

    return {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone ?? null,
      status: u.status ?? null,
      primary_university_id: u.primary_university_id,
      university: u.primary_university_id ? uniById[u.primary_university_id] ?? null : null,
      specialty: displaySpecialty,
      canonical_specialty: mapSpecialtySummary(u.specialties),
      university_specialty: u.university_specialty
        ? {
            id: u.university_specialty.id,
            name_ar: u.university_specialty.name_ar,
            name_en: u.university_specialty.name_en,
            code: u.university_specialty.code,
            status: u.university_specialty.status,
            canonical_specialty_id: u.university_specialty.specialty_id,
          }
        : null,
    };
  });
}

async function countApprovedApplications(opportunityId) {
  return prisma.field_training_applications.count({
    where: { opportunity_id: opportunityId, status: 'approved' },
  });
}

async function countApprovedApplicationsForEligibility(
  opportunityId,
  universityId,
  universitySpecialtyId
) {
  if (!universityId || !universitySpecialtyId) return 0;
  const students = await prisma.users.findMany({
    where: {
      primary_university_id: universityId,
      university_specialty_id: universitySpecialtyId,
    },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return 0;
  return prisma.field_training_applications.count({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      student_id: { in: studentIds },
    },
  });
}

async function opportunityHasApprovedStudentFromUniversity(opportunityId, universityId) {
  if (!universityId) return false;
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { student_id: true },
  });
  if (!apps.length) return false;
  const studentIds = [...new Set(apps.map((a) => a.student_id))];
  const count = await prisma.users.count({
    where: { id: { in: studentIds }, primary_university_id: universityId },
  });
  return count > 0;
}

function mapTaskRow(row, { exposeStudentSubmissionAudit = false } = {}) {
  const hasInstruction = Boolean(row.instruction_file_path);
  const gradingMode = row.grading_mode
    ? String(row.grading_mode).toUpperCase()
    : row.requires_ai_self_evaluation
      ? 'AI'
      : 'MANUAL';
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    title: row.title,
    description: row.description,
    sort_order: row.sort_order,
    due_date: formatDateOnly(row.due_date),
    ai_self_evaluation_prompt: row.ai_self_evaluation_prompt ?? null,
    requires_ai_self_evaluation: gradingMode === 'AI',
    grading_mode: gradingMode,
    is_final_task: Boolean(row.is_final_task),
    has_instruction_file: hasInstruction,
    instruction_file_name: hasInstruction ? row.instruction_file_name : null,
    instruction_file_mime_type: hasInstruction ? row.instruction_file_mime_type : null,
    instruction_file_size: hasInstruction ? row.instruction_file_size : null,
    instruction_file_uploaded_at: hasInstruction ? row.instruction_file_uploaded_at : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submission: row.field_training_task_submissions?.[0]
      ? mapSubmissionRow(row.field_training_task_submissions[0], {
          exposeStudentOwnAudit: exposeStudentSubmissionAudit,
        })
      : null,
  };
}

function mapSubmissionFileRow(row) {
  return {
    id: row.id,
    submission_id: row.submission_id,
    file_id: row.file_id ?? null,
    file_name: row.file_name,
    mime_type: row.mime_type ?? null,
    file_size: row.file_size ?? null,
    sort_order: row.sort_order ?? 0,
    extraction_status: row.extraction_status ?? null,
    is_archive: Boolean(row.is_archive),
    created_at: row.created_at,
  };
}

function mapSubmissionRow(row, { exposePublicUrl = false, exposeAiAudit = false, exposeStudentOwnAudit = false } = {}) {
  const stored = row.file_path;
  const hasFile = Boolean(stored) || (row.field_training_task_submission_files?.length > 0);
  const files = (row.field_training_task_submission_files || []).map(mapSubmissionFileRow);
  const base = {
    id: row.id,
    task_id: row.task_id,
    application_id: row.application_id,
    student_id: row.student_id,
    has_file: hasFile,
    file_url: exposePublicUrl && stored ? resolvePublicUrl(stored) : null,
    file_name: hasFile ? row.file_name || files[0]?.file_name || null : null,
    mime_type: hasFile ? row.mime_type || files[0]?.mime_type || null : null,
    files,
    project_url: row.project_url ?? null,
    solution_notes: row.solution_notes ?? null,
    submitted_at: row.submitted_at,
    is_late: Boolean(row.is_late),
    review_status: row.review_status ?? 'pending',
    instructor_feedback: row.instructor_feedback ?? null,
    manual_score: row.manual_score ?? null,
    max_score: row.max_score ?? null,
    reviewed_by_id: row.reviewed_by_id ?? null,
    reviewed_at: row.reviewed_at ?? null,
    final_student_notes: row.final_student_notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (exposeAiAudit) {
    base.student_self_evaluation_input = row.student_self_evaluation_input ?? null;
    base.ai_prompt_used = row.ai_prompt_used ?? null;
    base.ai_model_provider = row.ai_model_provider ?? null;
    base.ai_model_name = row.ai_model_name ?? null;
    base.ai_raw_response = row.ai_raw_response ?? null;
    base.ai_response_inserted_text = row.ai_response_inserted_text ?? null;
    base.ai_evaluated_at = row.ai_evaluated_at ?? null;
    base.analysis_file_id = row.analysis_file_id ?? null;
    base.file_extraction_status = row.file_extraction_status ?? null;
    base.file_extracted_text = row.file_extracted_text ?? null;
    base.url_extraction_status = row.url_extraction_status ?? null;
    base.url_extracted_text = row.url_extracted_text ?? null;
    base.extraction_errors = row.extraction_errors ?? null;
  } else if (exposeStudentOwnAudit) {
    base.student_self_evaluation_input = row.student_self_evaluation_input ?? null;
    base.ai_response_inserted_text = row.ai_response_inserted_text ?? null;
    base.final_student_notes = row.final_student_notes ?? null;
    base.ai_evaluated_at = row.ai_evaluated_at ?? null;
    base.project_url = row.project_url ?? null;
    base.file_extraction_status = row.file_extraction_status ?? null;
    base.url_extraction_status = row.url_extraction_status ?? null;
    base.extraction_errors = row.extraction_errors ?? null;
    base.has_ai_self_evaluation = Boolean(
      row.student_self_evaluation_input || row.ai_response_inserted_text
    );
  } else {
    base.has_ai_self_evaluation = Boolean(
      row.student_self_evaluation_input || row.ai_response_inserted_text
    );
  }
  return base;
}

async function findTasksByOpportunity(opportunityId, { applicationId, exposeStudentSubmissionAudit = false } = {}) {
  const rows = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { sort_order: 'asc' },
    include: applicationId
      ? {
          field_training_task_submissions: {
            where: { application_id: applicationId },
            take: 1,
            include: {
              field_training_task_submission_files: { orderBy: { sort_order: 'asc' } },
            },
          },
        }
      : undefined,
  });
  return rows.map((r) => mapTaskRow(r, { exposeStudentSubmissionAudit }));
}

async function findTaskById(taskId) {
  return prisma.field_training_tasks.findUnique({
    where: { id: taskId },
    include: {
      field_training_opportunities: {
        select: {
          id: true,
          status: true,
          title: true,
          university_id: true,
          assigned_instructor_id: true,
        },
      },
    },
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
      field_training_tasks: {
        select: { id: true, title: true, grading_mode: true, requires_ai_self_evaluation: true, is_final_task: true },
      },
      field_training_applications: { select: { id: true, student_id: true } },
      field_training_task_submission_files: { orderBy: { sort_order: 'asc' } },
    },
  });
  return rows.map((r) => ({
    ...mapSubmissionRow(r, { exposeAiAudit: true }),
    task_title: r.field_training_tasks?.title ?? null,
    grading_mode: r.field_training_tasks?.grading_mode
      ? String(r.field_training_tasks.grading_mode).toUpperCase()
      : r.field_training_tasks?.requires_ai_self_evaluation
        ? 'AI'
        : 'MANUAL',
    is_final_task: Boolean(r.field_training_tasks?.is_final_task),
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
  if (filters.specialty_id) where.specialty_id = filters.specialty_id;
  if (filters.assigned_instructor_id) {
    where.assigned_instructor_id = filters.assigned_instructor_id;
  }
  if (filters.university_id) {
    where.field_training_opportunity_eligibility = {
      some: { university_id: filters.university_id, is_active: true },
    };
  }
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

  const studentIds = filters.university_id
    ? (
        await prisma.users.findMany({
          where: { primary_university_id: filters.university_id },
          select: { id: true },
        })
      ).map((row) => row.id)
    : null;
  const appUniversityWhere =
    studentIds !== null
      ? {
          student_id: studentIds.length
            ? { in: studentIds }
            : { in: ['00000000-0000-0000-0000-000000000000'] },
        }
      : {};
  const oppUniversityWhere = filters.university_id
    ? {
        field_training_opportunities: {
          field_training_opportunity_eligibility: {
            some: { university_id: filters.university_id, is_active: true },
          },
        },
      }
    : {};

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
    eligibilityRows,
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
        ...appUniversityWhere,
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'pending',
        ...appDateWhere,
        ...appUniversityWhere,
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'approved',
        ...appDateWhere,
        ...appUniversityWhere,
      },
    }),
    prisma.field_training_applications.count({
      where: {
        status: 'rejected',
        ...appDateWhere,
        ...appUniversityWhere,
      },
    }),
    prisma.field_training_tasks.count({
      where: {
        ...taskDateWhere,
        ...oppUniversityWhere,
      },
    }),
    prisma.field_training_task_submissions.count({
      where: {
        ...subDateWhere,
        ...(filters.university_id
          ? {
              field_training_tasks: {
                field_training_opportunities: {
                  field_training_opportunity_eligibility: {
                    some: { university_id: filters.university_id, is_active: true },
                  },
                },
              },
            }
          : {}),
      },
    }),
    prisma.field_training_opportunity_eligibility.findMany({
      where: {
        is_active: true,
        ...(filters.university_id ? { university_id: filters.university_id } : {}),
      },
      select: { university_id: true, opportunity_id: true },
    }),
    prisma.field_training_opportunities.groupBy({
      by: ['training_mode'],
      where: { ...oppWhere, ...oppDateWhere },
      _count: { _all: true },
    }),
  ]);

  const byUniversityMap = new Map();
  for (const row of eligibilityRows) {
    if (!byUniversityMap.has(row.university_id)) byUniversityMap.set(row.university_id, new Set());
    byUniversityMap.get(row.university_id).add(row.opportunity_id);
  }
  const uniIds = [...byUniversityMap.keys()];
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
    byUniversity: [...byUniversityMap.entries()].map(([university_id, opportunityIds]) => ({
      university_id,
      name: uniName.get(university_id) || university_id,
      count: opportunityIds.size,
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
      field_training_task_submission_files: { orderBy: { sort_order: 'asc' } },
      field_training_tasks: {
        select: {
          id: true,
          title: true,
          opportunity_id: true,
          is_final_task: true,
          grading_mode: true,
          requires_ai_self_evaluation: true,
          field_training_opportunities: {
            select: {
              id: true,
              title: true,
              university_id: true,
              status: true,
              assigned_instructor_id: true,
            },
          },
        },
      },
    },
  });
}

async function findSubmissionFileById(fileRowId) {
  return prisma.field_training_task_submission_files.findUnique({
    where: { id: fileRowId },
    include: {
      field_training_task_submissions: {
        include: {
          field_training_tasks: {
            select: {
              id: true,
              opportunity_id: true,
              field_training_opportunities: {
                select: {
                  id: true,
                  title: true,
                  university_id: true,
                  status: true,
                  assigned_instructor_id: true,
                },
              },
            },
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

function mapSessionRow(row) {
  const durationMinutes = hoursMod.sessionDurationMinutes(row.start_time, row.end_time);
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    title: row.title,
    description: row.description,
    session_date: formatDateOnly(row.session_date),
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: durationMinutes,
    duration_hours: durationMinutes != null ? hoursMod.minutesToHours(durationMinutes) : null,
    zoom_link: row.zoom_link,
    is_required: Boolean(row.is_required),
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attendance: row.field_training_attendance?.[0]
      ? mapAttendanceRow(row.field_training_attendance[0])
      : null,
  };
}

function mapAttendanceRow(row) {
  return {
    id: row.id,
    session_id: row.session_id,
    application_id: row.application_id,
    student_id: row.student_id,
    status: row.status,
    note: row.note,
    method: row.method ?? null,
    confirmed_at: row.confirmed_at ?? null,
    manual_reason: row.manual_reason ?? null,
    attendance_window_id: row.attendance_window_id ?? null,
    recorded_by_id: row.recorded_by_id,
    recorded_at: row.recorded_at,
  };
}

function mapAssessmentRow(row, { includeQuestions = false } = {}) {
  const base = {
    id: row.id,
    opportunity_id: row.opportunity_id,
    type: row.type,
    title: row.title,
    description: row.description,
    passing_score: row.passing_score != null ? Number(row.passing_score) : null,
    status: row.status,
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includeQuestions && row.field_training_assessment_questions) {
    base.questions = row.field_training_assessment_questions.map(mapAssessmentQuestionRow);
  }
  return base;
}

function mapAssessmentQuestionRow(row) {
  const type = row.question_type === 'short_answer' ? 'short_text' : row.question_type;
  return {
    id: row.id,
    assessment_id: row.assessment_id,
    question_text: row.question_text,
    question_type: type,
    options: row.options,
    points: row.points != null ? Number(row.points) : 1,
    is_required: row.is_required !== false,
    sort_order: row.sort_order,
  };
}

function mapAssessmentQuestionRowAdmin(row) {
  return {
    ...mapAssessmentQuestionRow(row),
    correct_answer: row.correct_answer,
  };
}

async function findSessionsByOpportunity(opportunityId, { applicationId } = {}) {
  const rows = await prisma.field_training_sessions.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
    include: applicationId
      ? {
          field_training_attendance: {
            where: { application_id: applicationId },
            take: 1,
          },
        }
      : undefined,
  });
  return rows.map((r) => mapSessionRow(r));
}

async function findSessionById(sessionId) {
  return prisma.field_training_sessions.findUnique({
    where: { id: sessionId },
    include: {
      field_training_opportunities: {
        select: {
          id: true,
          title: true,
          status: true,
          assigned_instructor_id: true,
          university_id: true,
        },
      },
      _count: { select: { field_training_attendance: true } },
    },
  });
}

async function createSession(data) {
  return prisma.field_training_sessions.create({ data });
}

async function updateSession(id, data) {
  return prisma.field_training_sessions.update({ where: { id }, data });
}

async function deleteSession(id) {
  return prisma.field_training_sessions.delete({ where: { id } });
}

async function upsertAttendanceRecords(sessionId, records, recordedById) {
  const now = new Date();
  const results = [];
  for (const rec of records) {
    const row = await prisma.field_training_attendance.upsert({
      where: {
        session_id_application_id: {
          session_id: sessionId,
          application_id: rec.applicationId,
        },
      },
      create: {
        session_id: sessionId,
        application_id: rec.applicationId,
        student_id: rec.studentId,
        status: rec.status,
        note: rec.note ?? null,
        method: rec.method || 'manual',
        manual_reason: rec.manual_reason ?? null,
        recorded_by_id: recordedById,
        recorded_at: now,
        confirmed_at: ['present', 'late', 'excused'].includes(rec.status) ? now : null,
      },
      update: {
        status: rec.status,
        note: rec.note ?? null,
        method: rec.method || 'manual',
        manual_reason: rec.manual_reason ?? null,
        recorded_by_id: recordedById,
        recorded_at: now,
        confirmed_at: ['present', 'late', 'excused'].includes(rec.status) ? now : null,
        updated_at: now,
      },
    });
    results.push(row);
  }
  return results;
}

async function findAssessmentByOpportunityAndType(opportunityId, type) {
  return prisma.field_training_assessments.findUnique({
    where: { opportunity_id_type: { opportunity_id: opportunityId, type } },
    include: {
      field_training_assessment_questions: { orderBy: { sort_order: 'asc' } },
    },
  });
}

async function findAssessmentById(id) {
  return prisma.field_training_assessments.findUnique({
    where: { id },
    include: {
      field_training_assessment_questions: { orderBy: { sort_order: 'asc' } },
      field_training_opportunities: {
        select: { id: true, assigned_instructor_id: true, university_id: true, requires_pre_assessment: true, requires_post_assessment: true },
      },
    },
  });
}

async function upsertAssessment(data) {
  return prisma.field_training_assessments.upsert({
    where: { opportunity_id_type: { opportunity_id: data.opportunity_id, type: data.type } },
    create: data,
    update: {
      title: data.title,
      description: data.description,
      passing_score: data.passing_score,
      status: data.status,
    },
  });
}

async function replaceAssessmentQuestions(assessmentId, questions) {
  await prisma.field_training_assessment_questions.deleteMany({ where: { assessment_id: assessmentId } });
  if (!questions.length) return [];
  await prisma.field_training_assessment_questions.createMany({
    data: questions.map((q, i) => ({
      assessment_id: assessmentId,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      correct_answer: q.correct_answer ?? null,
      points: q.points ?? 1,
      is_required: q.is_required !== false,
      sort_order: q.sort_order ?? i,
    })),
  });
  return prisma.field_training_assessment_questions.findMany({
    where: { assessment_id: assessmentId },
    orderBy: { sort_order: 'asc' },
  });
}

async function findAssessmentAttempt(assessmentId, applicationId) {
  return prisma.field_training_assessment_attempts.findUnique({
    where: { assessment_id_application_id: { assessment_id: assessmentId, application_id: applicationId } },
  });
}

async function upsertAssessmentAttempt(data) {
  return prisma.field_training_assessment_attempts.upsert({
    where: {
      assessment_id_application_id: {
        assessment_id: data.assessment_id,
        application_id: data.application_id,
      },
    },
    create: data,
    update: {
      answers: data.answers,
      grading_details: data.grading_details ?? undefined,
      score: data.score,
      max_score: data.max_score,
      level: data.level,
      submitted_at: data.submitted_at,
    },
  });
}

async function findAssessmentAttemptById(attemptId) {
  return prisma.field_training_assessment_attempts.findUnique({
    where: { id: attemptId },
    include: {
      field_training_assessments: {
        include: {
          field_training_assessment_questions: { orderBy: { sort_order: 'asc' } },
          field_training_opportunities: true,
        },
      },
      field_training_applications: true,
    },
  });
}

async function updateAssessmentAttempt(attemptId, data) {
  return prisma.field_training_assessment_attempts.update({
    where: { id: attemptId },
    data,
  });
}

async function findActiveParticipants(opportunityId) {
  return prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: { not: 'expelled' },
      expelled_at: null,
    },
  });
}

/**
 * Eligible attendance participants: approved, not expelled, and active student accounts only.
 * Scoped to the opportunity of the session (never accepts client-supplied studentIds).
 */
async function findEligibleAttendanceParticipants(opportunityId) {
  const apps = await findActiveParticipants(opportunityId);
  if (!apps.length) return [];
  const activeUsers = await prisma.users.findMany({
    where: {
      id: { in: apps.map((a) => a.student_id) },
      status: 'active',
    },
    select: { id: true },
  });
  const activeIds = new Set(activeUsers.map((u) => u.id));
  return apps.filter((a) => activeIds.has(a.student_id));
}

async function countApprovedReadyForTraining(opportunityId) {
  return prisma.field_training_applications.count({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: {
        in: ['pre_assessment_completed', 'ready_for_training', 'in_training'],
      },
      expelled_at: null,
    },
  });
}

async function upsertSubmissionExtended({
  taskId,
  applicationId,
  studentId,
  filePath,
  fileName,
  mimeType,
  extra = {},
  files = [],
}) {
  const relative = filePath ? String(filePath).replace(/\\/g, '/') : null;
  const primary = files[0]
    ? {
        file_path: String(files[0].file_path).replace(/\\/g, '/'),
        file_name: files[0].file_name || 'file',
        mime_type: files[0].mime_type ?? null,
      }
    : relative
      ? {
          file_path: relative,
          file_name: fileName || 'file',
          mime_type: mimeType ?? null,
        }
      : {
          file_path: null,
          file_name: null,
          mime_type: null,
        };

  return prisma.$transaction(async (tx) => {
    const submission = await tx.field_training_task_submissions.upsert({
      where: {
        task_id_application_id: { task_id: taskId, application_id: applicationId },
      },
      create: {
        task_id: taskId,
        application_id: applicationId,
        student_id: studentId,
        ...primary,
        ...extra,
      },
      update: {
        ...primary,
        submitted_at: new Date(),
        ...extra,
      },
    });

    if (files.length) {
      await tx.field_training_task_submission_files.deleteMany({
        where: { submission_id: submission.id },
      });
      await tx.field_training_task_submission_files.createMany({
        data: files.map((f, index) => ({
          submission_id: submission.id,
          file_id: f.file_id || null,
          file_path: String(f.file_path).replace(/\\/g, '/'),
          file_name: f.file_name || 'file',
          mime_type: f.mime_type ?? null,
          file_size: f.file_size ?? null,
          sort_order: f.sort_order ?? index,
          extraction_status: f.extraction_status ?? null,
          is_archive: Boolean(f.is_archive),
        })),
      });
    } else if (primary.file_path) {
      const existingCount = await tx.field_training_task_submission_files.count({
        where: { submission_id: submission.id },
      });
      if (existingCount === 0) {
        await tx.field_training_task_submission_files.create({
          data: {
            submission_id: submission.id,
            file_id: extra.analysis_file_id || null,
            file_path: primary.file_path,
            file_name: primary.file_name,
            mime_type: primary.mime_type,
            sort_order: 0,
            is_archive: false,
          },
        });
      }
    }

    return tx.field_training_task_submissions.findUnique({
      where: { id: submission.id },
      include: {
        field_training_task_submission_files: { orderBy: { sort_order: 'asc' } },
      },
    });
  });
}

async function findCompletionLetterByApplication(applicationId) {
  return prisma.field_training_completion_letters.findFirst({
    where: { application_id: applicationId, status: 'issued' },
  });
}

async function createCompletionLetter(data) {
  return prisma.field_training_completion_letters.create({ data });
}

async function findInstructorsForSelect() {
  const instructorRole = await prisma.roles.findFirst({ where: { code: 'instructor' } });
  if (!instructorRole) return [];
  const links = await prisma.user_roles.findMany({
    where: { role_id: instructorRole.id },
    select: { user_id: true },
  });
  const ids = [...new Set(links.map((l) => l.user_id))];
  if (!ids.length) return [];
  return prisma.users.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true, full_name: true, email: true },
    orderBy: { full_name: 'asc' },
  });
}

async function findAssessmentsByOpportunity(opportunityId) {
  const rows = await prisma.field_training_assessments.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { type: 'asc' },
    include: {
      field_training_assessment_questions: {
        orderBy: { sort_order: 'asc' },
      },
      _count: { select: { field_training_assessment_questions: true, field_training_assessment_attempts: true } },
      field_training_assessment_attempts: {
        orderBy: { submitted_at: 'desc' },
        include: {
          field_training_applications: {
            select: {
              id: true,
              student_id: true,
              status: true,
              training_status: true,
              post_assessment_score: true,
              completion_eligibility_status: true,
            },
          },
        },
      },
    },
  });

  const studentIds = [
    ...new Set(
      rows.flatMap((r) =>
        (r.field_training_assessment_attempts || [])
          .map((a) => a.field_training_applications?.student_id)
          .filter(Boolean)
      )
    ),
  ];
  const profiles = studentIds.length ? await findStudentProfilesByIds(studentIds) : [];
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...mapAssessmentRow(r),
    questions: (r.field_training_assessment_questions || []).map(mapAssessmentQuestionRowAdmin),
    questions_count: r._count?.field_training_assessment_questions ?? 0,
    attempts_count: r._count?.field_training_assessment_attempts ?? 0,
    total_points: (r.field_training_assessment_questions || []).reduce(
      (sum, q) => sum + (q.points != null ? Number(q.points) : 1),
      0
    ),
    attempts: (r.field_training_assessment_attempts || []).map((attempt) => {
      const app = attempt.field_training_applications;
      const profile = app?.student_id ? profileById[app.student_id] : null;
      return {
        id: attempt.id,
        application_id: attempt.application_id,
        student_id: app?.student_id ?? null,
        student_name: profile?.full_name ?? null,
        student_university: profile?.university?.name ?? null,
        student_university_specialty_label: formatSpecialtyLabel(profile?.university_specialty || profile?.specialty, null),
        score: attempt.score != null ? Number(attempt.score) : null,
        level: attempt.level ?? null,
        submitted_at: attempt.submitted_at,
        training_status: app?.training_status ?? null,
        completion_eligibility_status: app?.completion_eligibility_status ?? null,
        grading_details: attempt.grading_details ?? null,
        answers: attempt.answers ?? null,
        has_pending_manual: Array.isArray(attempt.grading_details)
          ? attempt.grading_details.some((row) => row?.gradingStatus === 'pending_manual')
          : false,
      };
    }),
  }));
}

/**
 * Operational KPIs for instructor/admin opportunity list cards.
 */
async function aggregateInstructorListStats(opportunityIds = []) {
  const ids = [...new Set(opportunityIds.filter(Boolean))];
  const empty = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        participants_count: 0,
        sessions_count: 0,
        pending_submissions_count: 0,
        average_attendance: null,
        next_session: null,
        eligible_count: 0,
        at_risk_count: 0,
      },
    ])
  );
  if (!ids.length) return empty;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [apps, sessionGroups, pendingSubs, upcomingSessions] = await Promise.all([
    prisma.field_training_applications.findMany({
      where: { opportunity_id: { in: ids }, status: 'approved' },
      select: {
        opportunity_id: true,
        attendance_percentage: true,
        training_status: true,
        completion_eligibility_status: true,
      },
    }),
    prisma.field_training_sessions.groupBy({
      by: ['opportunity_id'],
      where: { opportunity_id: { in: ids } },
      _count: { _all: true },
    }),
    prisma.field_training_task_submissions.findMany({
      where: {
        review_status: 'pending',
        field_training_tasks: { opportunity_id: { in: ids } },
      },
      select: {
        id: true,
        field_training_tasks: { select: { opportunity_id: true } },
      },
    }),
    prisma.field_training_sessions.findMany({
      where: {
        opportunity_id: { in: ids },
        session_date: { gte: today },
      },
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
      select: {
        id: true,
        opportunity_id: true,
        title: true,
        session_date: true,
        start_time: true,
        end_time: true,
        zoom_link: true,
      },
    }),
  ]);

  for (const g of sessionGroups) {
    if (empty[g.opportunity_id]) empty[g.opportunity_id].sessions_count = g._count._all;
  }

  for (const sub of pendingSubs) {
    const oppId = sub.field_training_tasks?.opportunity_id;
    if (oppId && empty[oppId]) empty[oppId].pending_submissions_count += 1;
  }

  const attendanceBuckets = Object.fromEntries(ids.map((id) => [id, []]));
  for (const app of apps) {
    const bucket = empty[app.opportunity_id];
    if (!bucket) continue;
    bucket.participants_count += 1;
    if (app.completion_eligibility_status === 'eligible') bucket.eligible_count += 1;
    if (
      app.training_status === 'failed' ||
      app.completion_eligibility_status === 'ineligible' ||
      app.training_status === 'expelled'
    ) {
      bucket.at_risk_count += 1;
    }
    if (app.attendance_percentage != null) {
      attendanceBuckets[app.opportunity_id].push(Number(app.attendance_percentage));
    }
  }

  for (const id of ids) {
    const values = attendanceBuckets[id];
    if (values?.length) {
      empty[id].average_attendance = Math.round(
        values.reduce((sum, n) => sum + n, 0) / values.length
      );
    }
  }

  const nextByOpp = {};
  for (const session of upcomingSessions) {
    if (nextByOpp[session.opportunity_id]) continue;
    nextByOpp[session.opportunity_id] = {
      id: session.id,
      title: session.title,
      session_date: formatDateOnly(session.session_date),
      start_time: session.start_time,
      end_time: session.end_time,
      has_zoom_link: Boolean(session.zoom_link),
    };
  }
  for (const id of ids) {
    empty[id].next_session = nextByOpp[id] ?? null;
  }

  return empty;
}

async function findCompletionLetterById(id) {
  return prisma.field_training_completion_letters.findUnique({ where: { id } });
}

async function findCompletionLetterByApplicationForStudent(applicationId, studentId) {
  return prisma.field_training_completion_letters.findFirst({
    where: { application_id: applicationId, student_id: studentId, status: 'issued' },
  });
}

async function updateSubmissionReview(
  submissionId,
  { review_status, instructor_feedback, reviewed_by_id, manual_score, max_score }
) {
  return prisma.field_training_task_submissions.update({
    where: { id: submissionId },
    data: {
      review_status,
      instructor_feedback: instructor_feedback ?? null,
      manual_score: manual_score === undefined ? undefined : manual_score,
      max_score: max_score === undefined ? undefined : max_score,
      reviewed_by_id,
      reviewed_at: new Date(),
    },
    include: {
      field_training_task_submission_files: { orderBy: { sort_order: 'asc' } },
    },
  });
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
  opportunityInclude,
  opportunityListInclude,
  mapUniversitySummary,
  mapSpecialtySummary,
  formatSpecialtyLabel,
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
  aggregateApplicationCounts,
  aggregateApplicationCountsForOpportunities,
  aggregateInstructorListStats,
  findApplicationsByOpportunityIdsForStudent,
  findApplicationsByStudent,
  createApplication,
  updateApplication,
  findUsersByIds,
  findStudentProfilesByIds,
  countApprovedApplications,
  countApprovedApplicationsForEligibility,
  opportunityHasApprovedStudentFromUniversity,
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
  updateSubmissionReview,
  resolveSubmissionAbsolutePath,
  submissionFileExists,
  mapSessionRow,
  mapAttendanceRow,
  mapAssessmentRow,
  mapAssessmentQuestionRow,
  mapAssessmentQuestionRowAdmin,
  findSessionsByOpportunity,
  findSessionById,
  createSession,
  updateSession,
  deleteSession,
  upsertAttendanceRecords,
  findAssessmentByOpportunityAndType,
  findAssessmentById,
  upsertAssessment,
  replaceAssessmentQuestions,
  findAssessmentAttempt,
  findAssessmentAttemptById,
  upsertAssessmentAttempt,
  updateAssessmentAttempt,
  findActiveParticipants,
  findEligibleAttendanceParticipants,
  countApprovedReadyForTraining,
  upsertSubmissionExtended,
  findCompletionLetterByApplication,
  createCompletionLetter,
  findInstructorsForSelect,
  findAssessmentsByOpportunity,
  findCompletionLetterById,
  findCompletionLetterByApplicationForStudent,
  findSubmissionFileById,
  mapSubmissionFileRow,
};

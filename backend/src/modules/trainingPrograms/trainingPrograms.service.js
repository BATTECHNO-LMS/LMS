'use strict';

const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { recordAudit } = require('../../shared/services/audit.service');
const { emitDomainEvent } = require('../notificationEngine');

function requireOrgWrite(requester) {
  if (isSystemWideAdmin(requester)) return;
  if (requester.roles?.includes('reviewer')) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only');
  }
  if (
    !requester.roles?.includes('admin') &&
    !requester.roles?.includes('instructor') &&
    !requester.roles?.includes('trainer')
  ) {
    throw new ApiError(403, 'Forbidden');
  }
}

function isTrainerOnly(requester) {
  return (
    Boolean(requester?.roles?.includes('trainer')) &&
    !requester?.roles?.includes('admin') &&
    !isSystemWideAdmin(requester)
  );
}

async function assertTrainerProgramAccess(requester, programId, permissionKey = null) {
  if (!isTrainerOnly(requester)) return null;
  const { assertTrainerCanAccessProgram } = require('./trainerAssignments.service');
  return assertTrainerCanAccessProgram(requester, programId, permissionKey);
}

async function assertTrainerCohortAccess(requester, cohortId, permissionKey = null) {
  if (!isTrainerOnly(requester)) return null;
  const cohort = await prisma.training_cohorts.findUnique({
    where: { id: cohortId },
    select: { program_id: true },
  });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  return assertTrainerProgramAccess(requester, cohort.program_id, permissionKey);
}

function mapProgramRow(r, organization = null) {
  const settings = r.settings_json && typeof r.settings_json === 'object' ? r.settings_json : {};
  return {
    id: r.id,
    organizationId: r.organization_id,
    organizationName: organization?.name || null,
    organizationCode: organization?.code || null,
    code: r.code || null,
    title: r.title,
    description: r.description,
    shortDescription: settings.shortDescription || null,
    field: r.field,
    objectives: r.objectives,
    outcomes: r.outcomes,
    level: r.level,
    language: r.language,
    status: r.status,
    deliveryMode: r.delivery_mode,
    requiredHours: r.required_hours,
    requiredAttendancePct: r.required_attendance_pct,
    maxParticipants: r.max_participants,
    startDate: r.start_date,
    endDate: r.end_date,
    type: r.type,
    settings,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listPrograms(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  const where = { organization_id: organizationId, type: 'TRAINING_COURSE' };
  if (isTrainerOnly(requester)) {
    const assigned = await prisma.training_trainer_assignments.findMany({
      where: {
        trainer_user_id: requester.userId,
        organization_id: organizationId,
        is_active: true,
        revoked_at: null,
      },
      select: { training_program_id: true },
    });
    where.id = { in: assigned.map((a) => a.training_program_id) };
  }
  const rows = await prisma.training_programs.findMany({
    where,
    orderBy: { updated_at: 'desc' },
  });
  return rows.map((r) => mapProgramRow(r));
}

/**
 * Admin/super_admin course directory for TRAINING_COURSE only.
 * Super admin: all institutions. Institution admin: own organization only.
 */
async function listTrainingCourses(requester, query = {}) {
  if (
    !isSystemWideAdmin(requester) &&
    !requester.roles?.includes('admin') &&
    !requester.roles?.includes('reviewer')
  ) {
    throw new ApiError(403, 'Forbidden');
  }

  const where = { type: 'TRAINING_COURSE' };
  if (!isSystemWideAdmin(requester)) {
    const orgId = requester.organizationId;
    if (!orgId) return [];
    if (requester.organizationType && requester.organizationType !== 'INSTITUTION') {
      throw new ApiError(403, 'هذه الصفحة مخصصة لمؤسسات التدريب.');
    }
    where.organization_id = orgId;
  } else if (query.organizationId) {
    where.organization_id = query.organizationId;
  }
  if (query.status) where.status = query.status;

  const rows = await prisma.training_programs.findMany({
    where,
    orderBy: { updated_at: 'desc' },
    include: {
      organizations: { select: { id: true, name: true, code: true, type: true } },
      _count: {
        select: {
          training_cohorts: true,
          training_trainer_assignments: true,
        },
      },
    },
  });

  const programIds = rows.map((r) => r.id);
  const enrollmentCounts = programIds.length
    ? await prisma.training_enrollments.groupBy({
        by: ['cohort_id'],
        where: {
          training_cohorts: { program_id: { in: programIds } },
          status: { in: ['ACTIVE', 'APPROVED', 'COMPLETED', 'REQUIREMENTS_COMPLETED', 'INVITED', 'PENDING'] },
        },
        _count: { _all: true },
      })
    : [];
  const cohortProgram = programIds.length
    ? await prisma.training_cohorts.findMany({
        where: { program_id: { in: programIds } },
        select: { id: true, program_id: true },
      })
    : [];
  const cohortToProgram = new Map(cohortProgram.map((c) => [c.id, c.program_id]));
  const traineeByProgram = new Map();
  for (const row of enrollmentCounts) {
    const programId = cohortToProgram.get(row.cohort_id);
    if (!programId) continue;
    traineeByProgram.set(programId, (traineeByProgram.get(programId) || 0) + row._count._all);
  }

  return rows.map((r) => ({
    ...mapProgramRow(r, r.organizations),
    cohortCount: r._count?.training_cohorts || 0,
    trainerCount: r._count?.training_trainer_assignments || 0,
    traineeCount: traineeByProgram.get(r.id) || 0,
  }));
}

async function syncProgramRequirements(programId, body = {}) {
  const defs = [
    {
      code: 'PRE_TEST',
      label: 'الاختبار القبلي',
      is_required: body.requires_pre_test === true,
      threshold_json: body.pass_score != null ? { pass_score: Number(body.pass_score) } : null,
    },
    {
      code: 'POST_TEST',
      label: 'الاختبار البعدي',
      is_required: body.requires_post_test === true,
      threshold_json: body.pass_score != null ? { pass_score: Number(body.pass_score) } : null,
    },
    {
      code: 'TASKS',
      label: 'المهمات',
      is_required: body.requires_tasks !== false,
    },
    {
      code: 'FINAL_TASK',
      label: 'المهمة النهائية',
      is_required: body.requires_final_task === true,
    },
    {
      code: 'EVALUATION',
      label: 'تقييم الدورة',
      is_required: body.requires_evaluation === true,
    },
  ];
  for (let i = 0; i < defs.length; i += 1) {
    const d = defs[i];
    await prisma.training_requirements.upsert({
      where: { program_id_code: { program_id: programId, code: d.code } },
      create: {
        program_id: programId,
        code: d.code,
        label: d.label,
        is_required: d.is_required,
        threshold_json: d.threshold_json ?? undefined,
        sort_order: i,
      },
      update: {
        is_required: d.is_required,
        threshold_json: d.threshold_json ?? undefined,
        sort_order: i,
        updated_at: new Date(),
      },
    });
  }
}

async function getProgram(requester, programId) {
  const row = await prisma.training_programs.findUnique({
    where: { id: programId },
    include: {
      organizations: { select: { id: true, name: true, code: true, type: true, status: true } },
      training_requirements: { orderBy: { sort_order: 'asc' } },
      _count: { select: { training_cohorts: true, training_trainer_assignments: true } },
    },
  });
  if (!row || row.type !== 'TRAINING_COURSE') throw new ApiError(404, 'الدورة التدريبية غير موجودة');
  assertOrganizationAccess(requester, row.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId);
  }
  const reqMap = Object.fromEntries((row.training_requirements || []).map((r) => [r.code, r]));
  return {
    ...mapProgramRow(row, row.organizations),
    organization: row.organizations,
    cohortCount: row._count?.training_cohorts || 0,
    trainerCount: row._count?.training_trainer_assignments || 0,
    requirements: (row.training_requirements || []).map((r) => ({
      code: r.code,
      label: r.label,
      isRequired: r.is_required,
      threshold: r.threshold_json,
    })),
    requiresPreTest: Boolean(reqMap.PRE_TEST?.is_required),
    requiresPostTest: Boolean(reqMap.POST_TEST?.is_required),
    requiresTasks: reqMap.TASKS ? Boolean(reqMap.TASKS.is_required) : true,
    requiresFinalTask: Boolean(reqMap.FINAL_TASK?.is_required),
    requiresEvaluation: Boolean(reqMap.EVALUATION?.is_required),
  };
}

async function createProgram(requester, organizationId, body) {
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  if (!isSystemWideAdmin(requester) && requester.organizationType && requester.organizationType !== 'INSTITUTION') {
    throw new ApiError(403, 'إنشاء الدورات التدريبية متاح لمسؤولي المؤسسات فقط.');
  }
  const org = await prisma.organizations.findUnique({ where: { id: organizationId } });
  if (!org || org.type !== 'INSTITUTION') {
    throw new ApiError(400, 'يمكن إنشاء الدورات التدريبية لمؤسسات من نوع INSTITUTION فقط.');
  }
  if (org.status !== 'active') {
    throw new ApiError(400, 'المؤسسة غير نشطة.');
  }
  if (body.start_date && body.end_date && new Date(body.end_date) < new Date(body.start_date)) {
    throw new ApiError(400, 'تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.');
  }
  if (body.required_attendance_pct != null) {
    const pct = Number(body.required_attendance_pct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new ApiError(400, 'نسبة الحضور يجب أن تكون بين 0 و 100.');
    }
  }
  if (body.max_participants != null && Number(body.max_participants) <= 0) {
    throw new ApiError(400, 'السعة القصوى يجب أن تكون رقمًا موجبًا.');
  }
  if (body.required_hours != null && Number(body.required_hours) < 0) {
    throw new ApiError(400, 'الساعات المطلوبة غير صالحة.');
  }

  const description =
    body.description ||
    (body.short_description
      ? String(body.short_description)
      : null);

  const row = await prisma.training_programs.create({
    data: {
      organization_id: organizationId,
      type: 'TRAINING_COURSE',
      title: body.title,
      description,
      field: body.field ?? null,
      objectives: body.objectives ?? null,
      outcomes: body.outcomes ?? null,
      level: body.level ?? null,
      language: body.language ?? 'ar',
      delivery_mode: body.delivery_mode ?? null,
      required_hours: body.required_hours ?? null,
      required_attendance_pct: body.required_attendance_pct ?? 80,
      max_participants: body.max_participants ?? null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      status: body.status || 'DRAFT',
      created_by: requester.userId,
    },
  });
  await syncProgramRequirements(row.id, body);
  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'TRAINING_PROGRAM_CREATED',
    entityType: 'training_program',
    entityId: row.id,
    newValues: { title: row.title },
  });
  if (row.status === 'PUBLISHED' || row.status === 'REGISTRATION_OPEN') {
    await emitDomainEvent('COURSE_PUBLISHED', {
      organizationId,
      entityType: 'training_program',
      entityId: row.id,
      templateVars: { course_title: row.title },
    }).catch(() => null);
  }
  return getProgram(requester, row.id);
}

async function updateProgram(requester, programId, body = {}) {
  const existing = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!existing) throw new ApiError(404, 'Program not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, existing.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'تحديث إعدادات الدورة متاح لمسؤول المؤسسة فقط.');
  }
  const payload = body && typeof body === 'object' ? body : {};
  const row = await prisma.training_programs.update({
    where: { id: programId },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.field !== undefined ? { field: payload.field } : {}),
      ...(payload.objectives !== undefined ? { objectives: payload.objectives } : {}),
      ...(payload.outcomes !== undefined ? { outcomes: payload.outcomes } : {}),
      ...(payload.level !== undefined ? { level: payload.level } : {}),
      ...(payload.language !== undefined ? { language: payload.language } : {}),
      ...(payload.delivery_mode !== undefined ? { delivery_mode: payload.delivery_mode } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.required_hours !== undefined ? { required_hours: payload.required_hours } : {}),
      ...(payload.required_attendance_pct !== undefined
        ? { required_attendance_pct: payload.required_attendance_pct }
        : {}),
      ...(payload.max_participants !== undefined
        ? { max_participants: payload.max_participants }
        : {}),
      ...(payload.start_date !== undefined
        ? { start_date: payload.start_date ? new Date(payload.start_date) : null }
        : {}),
      ...(payload.end_date !== undefined
        ? { end_date: payload.end_date ? new Date(payload.end_date) : null }
        : {}),
      updated_at: new Date(),
    },
  });
  const touchesRequirements =
    payload.requires_pre_test !== undefined ||
    payload.requires_post_test !== undefined ||
    payload.requires_tasks !== undefined ||
    payload.requires_final_task !== undefined ||
    payload.requires_evaluation !== undefined ||
    payload.pass_score !== undefined;
  if (touchesRequirements) {
    const existingReqs = await prisma.training_requirements.findMany({
      where: { program_id: row.id },
    });
    const byCode = Object.fromEntries(existingReqs.map((r) => [r.code, r]));
    await syncProgramRequirements(row.id, {
      requires_pre_test:
        payload.requires_pre_test !== undefined
          ? payload.requires_pre_test
          : Boolean(byCode.PRE_TEST?.is_required),
      requires_post_test:
        payload.requires_post_test !== undefined
          ? payload.requires_post_test
          : Boolean(byCode.POST_TEST?.is_required),
      requires_tasks:
        payload.requires_tasks !== undefined
          ? payload.requires_tasks
          : byCode.TASKS
            ? Boolean(byCode.TASKS.is_required)
            : true,
      requires_final_task:
        payload.requires_final_task !== undefined
          ? payload.requires_final_task
          : Boolean(byCode.FINAL_TASK?.is_required),
      requires_evaluation:
        payload.requires_evaluation !== undefined
          ? payload.requires_evaluation
          : Boolean(byCode.EVALUATION?.is_required),
      pass_score:
        payload.pass_score !== undefined
          ? payload.pass_score
          : byCode.PRE_TEST?.threshold_json?.pass_score ??
            byCode.POST_TEST?.threshold_json?.pass_score ??
            null,
    });
  }
  return getProgram(requester, row.id);
}

async function createCohort(requester, programId, body) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program) throw new ApiError(404, 'Program not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, program.organization_id);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  if (body.start_date && body.end_date && new Date(body.end_date) < new Date(body.start_date)) {
    throw new ApiError(400, 'تاريخ نهاية الدفعة لا يمكن أن يسبق تاريخ البداية.');
  }
  if (body.branch_id) {
    const branch = await prisma.organization_branches.findFirst({
      where: { id: body.branch_id, organization_id: program.organization_id },
    });
    if (!branch) throw new ApiError(400, 'الفرع لا يتبع هذه المؤسسة.');
  }
  if (body.department_id) {
    const dept = await prisma.organization_departments.findFirst({
      where: { id: body.department_id, organization_id: program.organization_id },
    });
    if (!dept) throw new ApiError(400, 'القسم لا يتبع هذه المؤسسة.');
  }
  const cohort = await prisma.training_cohorts.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      name: body.name,
      branch_id: body.branch_id ?? null,
      department_id: body.department_id ?? null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      capacity: body.capacity ?? null,
      status: body.status || 'DRAFT',
      created_by: requester.userId,
    },
  });
  if (Array.isArray(body.instructor_ids)) {
    for (const instructorId of body.instructor_ids) {
      await prisma.training_cohort_instructors.create({
        data: {
          cohort_id: cohort.id,
          instructor_id: instructorId,
          is_primary: instructorId === body.instructor_ids[0],
        },
      });
    }
  }
  if (Array.isArray(body.trainer_ids) && body.trainer_ids.length) {
    const { assignTrainerToCourse } = require('./trainerAssignments.service');
    for (let i = 0; i < body.trainer_ids.length; i += 1) {
      await assignTrainerToCourse(requester, program.organization_id, {
        trainer_user_id: body.trainer_ids[i],
        training_program_id: programId,
        training_cohort_id: cohort.id,
        is_lead_trainer: i === 0,
      });
    }
  }
  return { id: cohort.id, name: cohort.name, programId, organizationId: program.organization_id };
}

async function listProgramTasks(requester, programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program) throw new ApiError(404, 'Program not found');
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_tasks');
  const rows = await prisma.training_tasks.findMany({
    where: { program_id: programId },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    isRequired: r.is_required,
    isFinalTask: r.is_final_task,
    dueAt: r.due_at,
    publishedAt: r.published_at,
    maxScore: r.max_score,
  }));
}

async function listCohortSessions(requester, cohortId) {
  const cohort = await prisma.training_cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  assertOrganizationAccess(requester, cohort.organization_id);
  await assertTrainerCohortAccess(requester, cohortId, 'can_manage_sessions');
  const rows = await prisma.training_sessions.findMany({
    where: { cohort_id: cohortId },
    orderBy: { starts_at: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    hours: r.hours,
    status: r.status,
    location: r.location,
    meetingUrl: r.meeting_url,
  }));
}

async function listCohorts(requester, programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program) throw new ApiError(404, 'Program not found');
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId);

  let cohortFilter = {};
  if (isTrainerOnly(requester)) {
    const {
      listTrainerAssignmentsForProgram,
      resolveAccessibleCohortIds,
    } = require('./trainerScope');
    const rows = await listTrainerAssignmentsForProgram(requester.userId, programId);
    const accessible = resolveAccessibleCohortIds(rows);
    if (Array.isArray(accessible)) {
      cohortFilter = { id: { in: accessible.length ? accessible : ['00000000-0000-4000-8000-000000000000'] } };
    }
  }

  const rows = await prisma.training_cohorts.findMany({
    where: {
      program_id: programId,
      ...cohortFilter,
    },
    orderBy: { created_at: 'desc' },
    include: { training_cohort_instructors: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    capacity: r.capacity,
    instructorIds: r.training_cohort_instructors.map((i) => i.instructor_id),
  }));
}

async function enrollUser(requester, cohortId, body) {
  const cohort = await prisma.training_cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, cohort.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'تسجيل المتدربين متاح لمسؤول المؤسسة فقط.');
  }

  const targetUser = await prisma.users.findUnique({ where: { id: body.user_id }, select: { id: true } });
  if (!targetUser) throw new ApiError(404, 'المستخدم غير موجود');
  const [roleLinks, orgAssignments] = await Promise.all([
    prisma.user_roles.findMany({
      where: { user_id: body.user_id },
      select: { role_id: true },
    }),
    prisma.user_organization_assignments.findMany({
      where: { user_id: body.user_id, organization_id: cohort.organization_id, is_active: true },
      select: { role_code: true, organization_id: true },
    }),
  ]);
  const roleIds = roleLinks.map((r) => r.role_id);
  const roles = roleIds.length
    ? await prisma.roles.findMany({ where: { id: { in: roleIds } }, select: { code: true } })
    : [];
  const roleCodes = new Set([
    ...roles.map((r) => r.code).filter(Boolean),
    ...orgAssignments.map((a) => a.role_code).filter(Boolean),
  ]);
  if (!roleCodes.has('trainee') && !roleCodes.has('student')) {
    throw new ApiError(400, 'يمكن تسجيل مستخدم بدور متدرب فقط في دورات المؤسسة.');
  }
  if (!isSystemWideAdmin(requester) && !orgAssignments.length) {
    throw new ApiError(400, 'المتدرب غير مرتبط بهذه المؤسسة.');
  }

  const status = body.status || (body.invite ? 'INVITED' : 'ACTIVE');
  const row = await prisma.training_enrollments.upsert({
    where: { cohort_id_user_id: { cohort_id: cohortId, user_id: body.user_id } },
    create: {
      cohort_id: cohortId,
      user_id: body.user_id,
      organization_id: cohort.organization_id,
      status,
      invited_by: body.invite ? requester.userId : null,
      approved_by: status === 'ACTIVE' || status === 'APPROVED' ? requester.userId : null,
      approved_at: status === 'ACTIVE' || status === 'APPROVED' ? new Date() : null,
    },
    update: {
      status,
      status_reason: body.status_reason ?? null,
      updated_at: new Date(),
    },
  });

  await prisma.training_progress.upsert({
    where: { enrollment_id: row.id },
    create: { enrollment_id: row.id },
    update: {},
  });

  const event =
    status === 'INVITED' ? 'TRAINEE_INVITED' : status === 'APPROVED' || status === 'ACTIVE' ? 'ENROLLMENT_APPROVED' : null;
  if (event) {
    await emitDomainEvent(event, {
      organizationId: cohort.organization_id,
      affectedUserId: body.user_id,
      entityType: 'training_enrollment',
      entityId: row.id,
    }).catch(() => null);
  }

  return { id: row.id, status: row.status, userId: row.user_id, cohortId };
}

async function listEnrollments(requester, cohortId) {
  const cohort = await prisma.training_cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  assertOrganizationAccess(requester, cohort.organization_id);
  await assertTrainerCohortAccess(requester, cohortId, 'can_view_trainees');
  const rows = await prisma.training_enrollments.findMany({
    where: { cohort_id: cohortId },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    status: r.status,
    statusReason: r.status_reason,
  }));
}

async function importEnrollmentsPreview(requester, cohortId, rows) {
  const cohort = await prisma.training_cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, cohort.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'استيراد المتدربين متاح لمسؤول المؤسسة فقط.');
  }

  const results = [];
  for (const row of rows || []) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      results.push({ email, status: 'error', message: 'Invalid email' });
      continue;
    }
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      results.push({ email, status: 'missing_user', message: 'User not registered' });
      continue;
    }
    const existing = await prisma.training_enrollments.findUnique({
      where: { cohort_id_user_id: { cohort_id: cohortId, user_id: user.id } },
    });
    if (existing) {
      results.push({ email, status: 'duplicate', userId: user.id });
      continue;
    }
    results.push({ email, status: 'ok', userId: user.id, fullName: user.full_name });
  }
  return { preview: results };
}

async function importEnrollmentsCommit(requester, cohortId, rows) {
  const preview = await importEnrollmentsPreview(requester, cohortId, rows);
  const created = [];
  for (const item of preview.preview) {
    if (item.status !== 'ok') continue;
    const enrollment = await enrollUser(requester, cohortId, {
      user_id: item.userId,
      status: 'ACTIVE',
    });
    created.push(enrollment);
  }
  return { createdCount: created.length, created };
}

async function createSession(requester, cohortId, body) {
  const cohort = await prisma.training_cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, cohort.organization_id);
  await assertTrainerCohortAccess(requester, cohortId, 'can_manage_sessions');
  const row = await prisma.training_sessions.create({
    data: {
      cohort_id: cohortId,
      title: body.title,
      description: body.description ?? null,
      instructor_id: body.instructor_id ?? null,
      starts_at: new Date(body.starts_at),
      ends_at: new Date(body.ends_at),
      hours: body.hours ?? null,
      session_type: body.session_type ?? null,
      meeting_url: body.meeting_url ?? null,
      location: body.location ?? null,
      attendance_required: body.attendance_required ?? true,
      counts_toward_hours: body.counts_toward_hours ?? true,
      status: body.status || 'SCHEDULED',
    },
  });
  await emitDomainEvent('SESSION_CREATED', {
    organizationId: cohort.organization_id,
    entityType: 'training_session',
    entityId: row.id,
    templateVars: { session_title: row.title },
  }).catch(() => null);
  return { id: row.id, title: row.title, startsAt: row.starts_at, endsAt: row.ends_at };
}

async function openAttendanceWindow(requester, sessionId, body = {}) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, session.training_cohorts.organization_id);
  await assertTrainerCohortAccess(requester, session.cohort_id, 'can_manage_attendance');

  const code = String(body.code || Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const duration = Number(body.duration_seconds || 120);
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + duration * 1000);
  const lateClosesAt = new Date(closesAt.getTime() + (Number(body.late_seconds || 120) * 1000));

  await prisma.training_attendance_windows.updateMany({
    where: { session_id: sessionId, is_active: true },
    data: { is_active: false, updated_at: new Date() },
  });

  const window = await prisma.training_attendance_windows.create({
    data: {
      session_id: sessionId,
      code_hash: codeHash,
      opens_at: opensAt,
      closes_at: closesAt,
      late_closes_at: lateClosesAt,
      duration_seconds: duration,
      is_active: true,
      created_by: requester.userId,
    },
  });

  await emitDomainEvent('ATTENDANCE_WINDOW_OPENED', {
    organizationId: session.training_cohorts.organization_id,
    entityType: 'training_attendance_window',
    entityId: window.id,
  }).catch(() => null);

  // Never expose code via public APIs except to opener response.
  return {
    id: window.id,
    opensAt: window.opens_at,
    closesAt: window.closes_at,
    lateClosesAt: window.late_closes_at,
    code,
  };
}

async function confirmAttendance(requester, sessionId, code) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found');

  const enrollment = await prisma.training_enrollments.findFirst({
    where: {
      cohort_id: session.cohort_id,
      user_id: requester.userId,
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
    },
  });
  if (!enrollment) throw new ApiError(403, 'Not enrolled in this cohort');

  const window = await prisma.training_attendance_windows.findFirst({
    where: { session_id: sessionId, is_active: true },
    orderBy: { created_at: 'desc' },
  });
  if (!window) {
    throw new ApiError(400, 'لا توجد نافذة حضور مفتوحة', null, 'ATTENDANCE_WINDOW_CLOSED');
  }

  const now = new Date();
  const hash = crypto.createHash('sha256').update(String(code || '')).digest('hex');
  if (hash !== window.code_hash) {
    throw new ApiError(400, 'رمز الحضور غير صحيح', null, 'ATTENDANCE_CODE_INVALID');
  }

  let status = 'present';
  if (now > window.closes_at) {
    if (window.late_closes_at && now <= window.late_closes_at) status = 'late';
    else throw new ApiError(400, 'انتهت نافذة الحضور', null, 'ATTENDANCE_CODE_EXPIRED');
  }

  const record = await prisma.training_attendance_records.upsert({
    where: {
      session_id_enrollment_id: { session_id: sessionId, enrollment_id: enrollment.id },
    },
    create: {
      session_id: sessionId,
      enrollment_id: enrollment.id,
      user_id: requester.userId,
      window_id: window.id,
      status,
      marked_via: 'CODE',
      confirmed_at: now,
    },
    update: {
      status,
      window_id: window.id,
      marked_via: 'CODE',
      confirmed_at: now,
      updated_at: now,
    },
  });

  await emitDomainEvent('ATTENDANCE_CONFIRMED', {
    organizationId: session.training_cohorts.organization_id,
    affectedUserId: requester.userId,
    entityType: 'training_attendance_record',
    entityId: record.id,
  }).catch(() => null);

  return { id: record.id, status: record.status };
}

async function markAllPresent(requester, sessionId, { mode = 'safe' } = {}) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, session.training_cohorts.organization_id);
  await assertTrainerCohortAccess(requester, session.cohort_id, 'can_manage_attendance');

  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      cohort_id: session.cohort_id,
      status: { in: ['ACTIVE', 'APPROVED'] },
    },
  });
  let updated = 0;
  for (const enrollment of enrollments) {
    const existing = await prisma.training_attendance_records.findUnique({
      where: {
        session_id_enrollment_id: { session_id: sessionId, enrollment_id: enrollment.id },
      },
    });
    if (mode === 'safe' && existing && !['absent', 'unconfirmed'].includes(String(existing.status).toLowerCase())) {
      continue;
    }
    await prisma.training_attendance_records.upsert({
      where: {
        session_id_enrollment_id: { session_id: sessionId, enrollment_id: enrollment.id },
      },
      create: {
        session_id: sessionId,
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        status: 'present',
        marked_via: 'MARK_ALL_PRESENT',
        marked_by: requester.userId,
        confirmed_at: new Date(),
        reason: 'mark_all_present',
      },
      update: {
        status: 'present',
        marked_via: 'MARK_ALL_PRESENT',
        marked_by: requester.userId,
        reason: 'mark_all_present',
        updated_at: new Date(),
      },
    });
    updated += 1;
  }
  await recordAudit({
    userId: requester.userId,
    organizationId: session.training_cohorts.organization_id,
    actionType: 'TRAINING_MARK_ALL_PRESENT',
    entityType: 'training_session',
    entityId: sessionId,
    newValues: { mode, updated },
  });
  return { updated };
}

async function createTask(requester, programId, body) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program) throw new ApiError(404, 'Program not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_tasks');
  const row = await prisma.training_tasks.create({
    data: {
      program_id: programId,
      cohort_id: body.cohort_id ?? null,
      title: body.title,
      instructions: body.instructions ?? null,
      max_score: body.max_score ?? null,
      grading_mode: body.grading_mode || 'MANUAL',
      is_final_task: Boolean(body.is_final_task),
      is_required: body.is_required !== false,
      allow_resubmit: body.allow_resubmit !== false,
      max_attempts: body.max_attempts ?? 3,
      published_at: body.publish ? new Date() : null,
      due_at: body.due_at ? new Date(body.due_at) : null,
      created_by: requester.userId,
    },
  });
  if (row.published_at) {
    await emitDomainEvent('TASK_PUBLISHED', {
      organizationId: program.organization_id,
      entityType: 'training_task',
      entityId: row.id,
      templateVars: { task_title: row.title },
    }).catch(() => null);
  }
  return { id: row.id, title: row.title, isFinalTask: row.is_final_task };
}

async function submitTask(requester, taskId, body) {
  const task = await prisma.training_tasks.findUnique({
    where: { id: taskId },
    include: { training_programs: true },
  });
  if (!task) throw new ApiError(404, 'Task not found');
  const enrollment = await prisma.training_enrollments.findFirst({
    where: {
      user_id: requester.userId,
      organization_id: task.training_programs.organization_id,
      status: { in: ['ACTIVE', 'APPROVED'] },
      ...(task.cohort_id ? { cohort_id: task.cohort_id } : {}),
    },
  });
  if (!enrollment) throw new ApiError(403, 'Not enrolled');

  const attempts = await prisma.training_task_submissions.count({
    where: { task_id: taskId, enrollment_id: enrollment.id },
  });
  if (attempts >= task.max_attempts) throw new ApiError(400, 'Max attempts reached');

  const row = await prisma.training_task_submissions.create({
    data: {
      task_id: taskId,
      enrollment_id: enrollment.id,
      user_id: requester.userId,
      attempt_no: attempts + 1,
      content_text: body.content_text ?? null,
      content_url: body.content_url ?? null,
      status: task.grading_mode === 'NONE' ? 'ACCEPTED' : 'SUBMITTED',
    },
  });
  await emitDomainEvent('TASK_SUBMITTED', {
    organizationId: task.training_programs.organization_id,
    affectedUserId: requester.userId,
    entityType: 'training_task_submission',
    entityId: row.id,
  }).catch(() => null);
  return { id: row.id, status: row.status, attemptNo: row.attempt_no };
}

async function gradeTask(requester, submissionId, body) {
  const submission = await prisma.training_task_submissions.findUnique({
    where: { id: submissionId },
    include: { training_tasks: { include: { training_programs: true } } },
  });
  if (!submission) throw new ApiError(404, 'Submission not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, submission.training_tasks.training_programs.organization_id);
  await assertTrainerProgramAccess(
    requester,
    submission.training_tasks.program_id,
    'can_grade_tasks'
  );
  const row = await prisma.training_task_submissions.update({
    where: { id: submissionId },
    data: {
      score: body.score ?? null,
      feedback: body.feedback ?? null,
      status: body.status || 'GRADED',
      graded_by: requester.userId,
      graded_at: new Date(),
      updated_at: new Date(),
    },
  });
  await emitDomainEvent('TASK_GRADED', {
    organizationId: submission.training_tasks.training_programs.organization_id,
    affectedUserId: submission.user_id,
    entityType: 'training_task_submission',
    entityId: row.id,
  }).catch(() => null);
  return { id: row.id, score: row.score, status: row.status };
}

const trainingAssessment = require('./trainingAssessment.service');

async function listProgramAssessments(requester, programId) {
  return trainingAssessment.listProgramAssessments(requester, programId);
}
async function getAssessment(requester, assessmentId) {
  return trainingAssessment.getAssessment(requester, assessmentId);
}
async function upsertAssessment(requester, programId, kind, body) {
  return trainingAssessment.upsertAssessment(requester, programId, kind, body);
}
async function publishAssessment(requester, assessmentId) {
  return trainingAssessment.publishAssessment(requester, assessmentId);
}
async function startAssessmentAttempt(requester, assessmentId) {
  return trainingAssessment.startAttempt(requester, assessmentId);
}
async function saveAssessmentAttemptAnswers(requester, attemptId, answers) {
  return trainingAssessment.saveAttemptAnswers(requester, attemptId, answers);
}
async function submitAssessmentAttempt(requester, attemptId, answers) {
  return trainingAssessment.submitAttempt(requester, attemptId, answers);
}
async function submitAssessment(requester, assessmentId, answers) {
  return trainingAssessment.submitAssessment(requester, assessmentId, answers);
}
async function gradeAssessmentAttempt(requester, attemptId, body) {
  return trainingAssessment.gradeAttempt(requester, attemptId, body);
}
async function listAssessmentResults(requester, assessmentId) {
  return trainingAssessment.listAssessmentResults(requester, assessmentId);
}
async function getPrePostComparison(requester, programId, query) {
  return trainingAssessment.getPrePostComparison(requester, programId, query);
}
async function getTraineeAssessmentStatus(requester, programId) {
  return trainingAssessment.getTraineeAssessmentStatus(requester, programId);
}

async function recomputeProgress(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      training_cohorts: { include: { training_programs: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (!isOwner) {
    await assertTrainerCohortAccess(requester, enrollment.cohort_id, 'can_view_progress');
  }

  const program = enrollment.training_cohorts.training_programs;
  const sessions = await prisma.training_sessions.findMany({
    where: { cohort_id: enrollment.cohort_id, counts_toward_hours: true },
  });
  const attendance = await prisma.training_attendance_records.findMany({
    where: { enrollment_id: enrollmentId },
  });
  const presentLike = attendance.filter((a) => ['present', 'late', 'excused'].includes(String(a.status).toLowerCase()));
  const attendancePct = sessions.length ? (presentLike.length / sessions.length) * 100 : 0;
  const hoursCompleted = presentLike.reduce((sum, a) => {
    const session = sessions.find((s) => s.id === a.session_id);
    return sum + Number(session?.hours || 0);
  }, 0);
  const hoursRequired = Number(program.required_hours || 0);
  const requiredAttendance = Number(program.required_attendance_pct || 0);

  const tasks = await prisma.training_tasks.findMany({
    where: { program_id: program.id, is_required: true },
  });
  const submissions = await prisma.training_task_submissions.findMany({
    where: { enrollment_id: enrollmentId, status: { in: ['ACCEPTED', 'GRADED'] } },
  });
  const completedTaskIds = new Set(submissions.map((s) => s.task_id));
  const tasksDone = tasks.filter((t) => completedTaskIds.has(t.id)).length;

  const reqRows = await prisma.training_requirements.findMany({ where: { program_id: program.id } });
  const reqByCode = Object.fromEntries(reqRows.map((r) => [r.code, r]));
  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: program.id, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
    include: { training_assessment_attempts: { where: { enrollment_id: enrollmentId } } },
  });
  function assessmentOk(kind) {
    const cfg = reqByCode[kind];
    if (!cfg?.is_required) return { required: false, ok: true, value: null };
    const assessment = assessments.find((a) => a.kind === kind);
    if (!assessment) return { required: true, ok: false, value: 0, completed: false, passed: false };
    const threshold = cfg.threshold_json && typeof cfg.threshold_json === 'object' ? cfg.threshold_json : {};
    const passScoreRaw = assessment.pass_score ?? threshold.pass_score;
    const passScore = passScoreRaw != null ? Number(passScoreRaw) : null;
    const passingRequired = threshold.passing_required === true || (passScore != null && threshold.passing_required !== false);
    const attempts = assessment.training_assessment_attempts || [];
    const pendingManual = attempts.some((a) => a.status === 'SUBMITTED' && !a.graded_at);
    const graded = attempts.filter((a) => a.status === 'GRADED');
    const submittedOrGraded = attempts.filter((a) => ['SUBMITTED', 'GRADED'].includes(a.status));
    const best = graded.reduce((max, a) => Math.max(max, Number(a.score || 0)), 0);
    const completed = submittedOrGraded.length > 0 && !pendingManual;
    const passed = passingRequired ? completed && best >= Number(passScore || 0) : completed;
    return {
      required: true,
      ok: passed,
      value: best,
      passScore,
      passingRequired,
      completed,
      passed,
      pendingManual,
    };
  }

  const requirements = {
    attendance: { value: attendancePct, required: requiredAttendance, ok: attendancePct >= requiredAttendance },
    hours: { value: hoursCompleted, required: hoursRequired, ok: !hoursRequired || hoursCompleted >= hoursRequired },
    tasks: {
      value: tasksDone,
      required: reqByCode.TASKS?.is_required === false ? 0 : tasks.length,
      ok: reqByCode.TASKS?.is_required === false ? true : tasksDone >= tasks.length,
    },
    preTest: assessmentOk('PRE_TEST'),
    postTest: assessmentOk('POST_TEST'),
  };
  const allOk = Object.values(requirements).every((r) => r.ok);
  const requirementChecks = Object.values(requirements);
  const completionPct = allOk
    ? 100
    : Math.min(
        99,
        Math.round((requirementChecks.filter((r) => r.ok).length / Math.max(requirementChecks.length, 1)) * 100)
      );

  const progress = await prisma.training_progress.upsert({
    where: { enrollment_id: enrollmentId },
    create: {
      enrollment_id: enrollmentId,
      completion_pct: completionPct,
      hours_completed: hoursCompleted,
      hours_required: hoursRequired || null,
      attendance_pct: attendancePct,
      status: allOk ? 'PENDING_REVIEW' : 'INCOMPLETE',
      requirements_json: requirements,
    },
    update: {
      completion_pct: completionPct,
      hours_completed: hoursCompleted,
      hours_required: hoursRequired || null,
      attendance_pct: attendancePct,
      status: allOk ? 'PENDING_REVIEW' : 'INCOMPLETE',
      requirements_json: requirements,
      updated_at: new Date(),
    },
  });

  if (allOk && enrollment.status !== 'COMPLETED') {
    await prisma.training_enrollments.update({
      where: { id: enrollmentId },
      data: { status: 'REQUIREMENTS_COMPLETED', updated_at: new Date() },
    });
  }

  return {
    enrollmentId,
    completionPct: Number(progress.completion_pct),
    hoursCompleted: Number(progress.hours_completed),
    attendancePct: Number(progress.attendance_pct || 0),
    status: progress.status,
    requirements,
  };
}

async function approveCompletion(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, enrollment.organization_id);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  const progress = await recomputeProgress(requester, enrollmentId);
  const requirementsMet =
    progress.status === 'PENDING_REVIEW' ||
    progress.status === 'COMPLETED' ||
    Number(progress.completionPct) >= 100;
  if (!requirementsMet) {
    throw new ApiError(
      400,
      'لا يمكن اعتماد الإكمال قبل استيفاء متطلبات الدورة.',
      progress.requirements,
      'COURSE_REQUIREMENTS_INCOMPLETE'
    );
  }
  await prisma.training_enrollments.update({
    where: { id: enrollmentId },
    data: { status: 'COMPLETED', completed_at: new Date(), updated_at: new Date() },
  });
  await prisma.training_progress.update({
    where: { enrollment_id: enrollmentId },
    data: {
      status: 'COMPLETED',
      completion_pct: 100,
      approved_by: requester.userId,
      approved_at: new Date(),
      updated_at: new Date(),
    },
  });
  await emitDomainEvent('COURSE_COMPLETED', {
    organizationId: enrollment.organization_id,
    affectedUserId: enrollment.user_id,
    entityType: 'training_enrollment',
    entityId: enrollmentId,
  }).catch(() => null);
  return { enrollmentId, status: 'COMPLETED' };
}

async function listSessionAttendance(requester, sessionId) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found', null, 'TRAINING_PROGRAM_NOT_FOUND');
  assertOrganizationAccess(requester, session.training_cohorts.organization_id);
  await assertTrainerCohortAccess(requester, session.cohort_id, 'can_manage_attendance');
  const rows = await prisma.training_attendance_records.findMany({
    where: { session_id: sessionId },
    orderBy: { updated_at: 'desc' },
  });
  const windows = await prisma.training_attendance_windows.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
    take: 5,
  });
  return {
    sessionId,
    records: rows.map((r) => ({
      id: r.id,
      enrollmentId: r.enrollment_id,
      userId: r.user_id,
      status: r.status,
      confirmedAt: r.confirmed_at,
      markedVia: r.marked_via,
    })),
    windows: windows.map((w) => ({
      id: w.id,
      opensAt: w.opens_at,
      closesAt: w.closes_at,
      lateClosesAt: w.late_closes_at,
      isActive: w.is_active,
    })),
  };
}

async function getEnrollmentProgress(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (!isOwner) {
    await assertTrainerCohortAccess(requester, enrollment.cohort_id, 'can_view_progress');
  }
  return recomputeProgress(requester, enrollmentId);
}

async function getEnrollmentCertificate(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (!isOwner && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  const row = await prisma.training_certificates.findFirst({
    where: { enrollment_id: enrollmentId, status: 'ISSUED' },
    orderBy: { issued_at: 'desc' },
  });
  if (!row) {
    throw new ApiError(404, 'لا توجد شهادة صادرة لهذا التسجيل.', null, 'CERTIFICATE_NOT_ELIGIBLE');
  }
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    verificationCode: row.verification_code,
    status: row.status,
    issuedAt: row.issued_at,
    hours: row.hours,
    metadata: row.metadata_json,
  };
}

async function getTraineeProgramDetail(requester, programId) {
  const enrollment = await prisma.training_enrollments.findFirst({
    where: {
      user_id: requester.userId,
      training_cohorts: { program_id: programId },
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED', 'PENDING', 'INVITED'] },
    },
    include: {
      training_cohorts: { include: { training_programs: true } },
      training_progress: true,
    },
    orderBy: { created_at: 'desc' },
  });
  if (!enrollment) {
    throw new ApiError(403, 'غير مسجّل في هذه الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
  }
  if (['PENDING', 'INVITED'].includes(enrollment.status)) {
    throw new ApiError(403, 'بانتظار الموافقة على التسجيل', null, 'ENROLLMENT_PENDING');
  }
  const program = enrollment.training_cohorts.training_programs;
  if (program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  const [sessions, tasks, assessments, materials, certificate] = await Promise.all([
    prisma.training_sessions.findMany({
      where: { cohort_id: enrollment.cohort_id },
      orderBy: { starts_at: 'asc' },
    }),
    prisma.training_tasks.findMany({
      where: { program_id: programId, published_at: { not: null } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.training_assessments.findMany({
      where: { program_id: programId, is_published: true },
      include: {
        training_assessment_questions: { orderBy: { sort_order: 'asc' } },
        training_assessment_attempts: { where: { enrollment_id: enrollment.id } },
      },
    }),
    prisma.training_materials.findMany({
      where: { program_id: programId, is_published: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    }),
    prisma.training_certificates.findFirst({
      where: { enrollment_id: enrollment.id, status: 'ISSUED' },
      orderBy: { issued_at: 'desc' },
    }),
  ]);
  const submissions = await prisma.training_task_submissions.findMany({
    where: { enrollment_id: enrollment.id },
  });
  const attendance = await prisma.training_attendance_records.findMany({
    where: { enrollment_id: enrollment.id },
  });
  let progressSnapshot = enrollment.training_progress
    ? {
        completionPct: Number(enrollment.training_progress.completion_pct),
        hoursCompleted: Number(enrollment.training_progress.hours_completed),
        attendancePct: Number(enrollment.training_progress.attendance_pct || 0),
        status: enrollment.training_progress.status,
        requirements: enrollment.training_progress.requirements_json,
      }
    : null;
  try {
    progressSnapshot = await recomputeProgress(requester, enrollment.id);
  } catch {
    /* keep cached progress */
  }
  const settings = program.settings_json && typeof program.settings_json === 'object' ? program.settings_json : {};
  const preReq = progressSnapshot?.requirements?.preTest;
  const contentLocked = Boolean(
    settings.preTestBlocksContent && preReq?.required && !preReq?.ok
  );
  const mappedSessions = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    status: s.status,
    location: s.location,
    meetingUrl: s.meeting_url,
    attendance: attendance.find((a) => a.session_id === s.id)
      ? {
          status: attendance.find((a) => a.session_id === s.id).status,
          confirmedAt: attendance.find((a) => a.session_id === s.id).confirmed_at,
        }
      : null,
  }));
  const mappedTasks = tasks.map((t) => {
    const sub = submissions.find((s) => s.task_id === t.id);
    return {
      id: t.id,
      title: t.title,
      instructions: t.instructions,
      dueAt: t.due_at,
      isRequired: t.is_required,
      isFinalTask: t.is_final_task,
      maxScore: t.max_score,
      submission: sub
        ? { id: sub.id, status: sub.status, score: sub.score, feedback: sub.feedback }
        : null,
    };
  });
  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    program: mapProgramRow(program),
    cohort: {
      id: enrollment.training_cohorts.id,
      name: enrollment.training_cohorts.name,
      code: enrollment.training_cohorts.code || null,
      status: enrollment.training_cohorts.status,
    },
    contentLocked,
    contentLockReason: contentLocked
      ? 'يجب إكمال الاختبار القبلي قبل الوصول إلى محتوى الدورة.'
      : null,
    trainerAssignmentNote:
      (await prisma.training_trainer_assignments.count({
        where: { training_program_id: programId, is_active: true, revoked_at: null },
      })) === 0
        ? 'لم يتم تعيين مدرب بعد'
        : null,
    progress: progressSnapshot,
    sessions: contentLocked ? [] : mappedSessions,
    tasks: contentLocked ? [] : mappedTasks,
    assessments: assessments.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      code: a.code || null,
      durationMinutes: a.duration_minutes,
      maxAttempts: a.max_attempts,
      passScore: a.pass_score,
      questions: (a.training_assessment_questions || []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        questionType: q.question_type,
        options: q.options_json,
        points: q.points,
      })),
      attempts: (a.training_assessment_attempts || []).map((at) => ({
        id: at.id,
        score: at.score,
        status: at.status,
        submittedAt: at.submitted_at,
      })),
    })),
    materials: contentLocked
      ? []
      : materials.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          materialType: m.material_type,
          url: m.url,
          visibility: m.visibility,
        })),
    certificate: certificate
      ? {
          id: certificate.id,
          certificateNumber: certificate.certificate_number,
          verificationCode: certificate.verification_code,
          issuedAt: certificate.issued_at,
        }
      : null,
  };
}

async function listProgramMaterials(requester, programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  assertOrganizationAccess(requester, program.organization_id);
  const isLearner =
    requester.roles?.includes('trainee') || requester.roles?.includes('student');
  if (isLearner && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    const enrolled = await prisma.training_enrollments.findFirst({
      where: {
        user_id: requester.userId,
        organization_id: program.organization_id,
        training_cohorts: { program_id: programId },
        status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
      },
    });
    if (!enrolled) {
      throw new ApiError(403, 'COURSE_ENROLLMENT_REQUIRED', null, 'COURSE_ENROLLMENT_REQUIRED');
    }
  } else if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId, 'can_manage_materials');
  }
  const rows = await prisma.training_materials.findMany({
    where: {
      program_id: programId,
      ...(isLearner && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')
        ? { is_published: true }
        : {}),
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    materialType: m.material_type,
    url: m.url,
    isPublished: m.is_published,
    visibility: m.visibility,
    cohortId: m.cohort_id,
    sessionId: m.session_id,
  }));
}

async function createProgramMaterial(requester, programId, body = {}) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_materials');
  if (!body.title?.trim()) throw new ApiError(400, 'عنوان المادة مطلوب');
  if (!body.url?.trim() && !body.storage_key) {
    throw new ApiError(400, 'يلزم رابط أو ملف للمادة التدريبية');
  }
  const row = await prisma.training_materials.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      cohort_id: body.cohort_id || null,
      session_id: body.session_id || null,
      title: body.title.trim(),
      description: body.description || null,
      material_type: body.material_type || 'LINK',
      url: body.url || null,
      storage_key: body.storage_key || null,
      mime_type: body.mime_type || null,
      visibility: body.visibility || 'ENROLLED',
      is_published: body.is_published !== false,
      sort_order: Number(body.sort_order || 0),
      created_by: requester.userId,
    },
  });
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    materialType: row.material_type,
    isPublished: row.is_published,
  };
}

async function publishProgram(requester, programId) {
  const existing = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!existing || existing.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, existing.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  if (!existing.title?.trim()) {
    throw new ApiError(400, 'لا يمكن نشر دورة بدون عنوان');
  }
  const row = await prisma.training_programs.update({
    where: { id: programId },
    data: { status: 'PUBLISHED', updated_at: new Date() },
  });
  await emitDomainEvent('COURSE_PUBLISHED', {
    organizationId: existing.organization_id,
    entityType: 'training_program',
    entityId: row.id,
    templateVars: { course_title: row.title },
  }).catch(() => null);
  await recordAudit({
    userId: requester.userId,
    organizationId: existing.organization_id,
    actionType: 'TRAINING_PROGRAM_PUBLISHED',
    entityType: 'training_program',
    entityId: row.id,
    newValues: { status: row.status },
  });
  return { id: row.id, status: row.status, title: row.title };
}

async function issueCertificate(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      training_progress: true,
      training_cohorts: { include: { training_programs: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, enrollment.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'إصدار الشهادات متاح لمسؤول المؤسسة فقط.');
  }
  if (enrollment.status !== 'COMPLETED' && enrollment.training_progress?.status !== 'COMPLETED') {
    throw new ApiError(400, 'التسجيل غير مكتمل لإصدار الشهادة', null, 'CERTIFICATE_NOT_ELIGIBLE');
  }

  const certificateNumber = `TRN-${Date.now()}-${enrollmentId.slice(0, 8).toUpperCase()}`;
  const verificationCode = crypto.randomBytes(16).toString('hex');
  const row = await prisma.training_certificates.create({
    data: {
      enrollment_id: enrollmentId,
      organization_id: enrollment.organization_id,
      certificate_number: certificateNumber,
      verification_code: verificationCode,
      status: 'ISSUED',
      issued_at: new Date(),
      issued_by: requester.userId,
      hours: enrollment.training_progress?.hours_completed ?? null,
      metadata_json: {
        programTitle: enrollment.training_cohorts.training_programs.title,
        cohortName: enrollment.training_cohorts.name,
      },
    },
  });
  await emitDomainEvent('CERTIFICATE_ISSUED', {
    organizationId: enrollment.organization_id,
    affectedUserId: enrollment.user_id,
    entityType: 'training_certificate',
    entityId: row.id,
  }).catch(() => null);
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    verificationCode: row.verification_code,
    status: row.status,
  };
}

async function verifyCertificate(code) {
  const row = await prisma.training_certificates.findUnique({
    where: { verification_code: code },
  });
  if (!row || row.status !== 'ISSUED') {
    return { valid: false };
  }
  return {
    valid: true,
    certificateNumber: row.certificate_number,
    issuedAt: row.issued_at,
    hours: row.hours,
    metadata: row.metadata_json,
  };
}

async function listStudentPrograms(requester) {
  const enrollments = await prisma.training_enrollments.findMany({
    where: { user_id: requester.userId },
    include: {
      training_cohorts: { include: { training_programs: true } },
      training_progress: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return enrollments.map((e) => ({
    enrollmentId: e.id,
    status: e.status,
    programId: e.training_cohorts.training_programs.id,
    programTitle: e.training_cohorts.training_programs.title,
    cohortId: e.cohort_id,
    cohortName: e.training_cohorts.name,
    progress: e.training_progress
      ? {
          completionPct: Number(e.training_progress.completion_pct),
          hoursCompleted: Number(e.training_progress.hours_completed),
          status: e.training_progress.status,
        }
      : null,
  }));
}

module.exports = {
  listPrograms,
  listTrainingCourses,
  getProgram,
  createProgram,
  updateProgram,
  createCohort,
  listCohorts,
  enrollUser,
  listEnrollments,
  importEnrollmentsPreview,
  importEnrollmentsCommit,
  createSession,
  listCohortSessions,
  openAttendanceWindow,
  confirmAttendance,
  markAllPresent,
  createTask,
  listProgramTasks,
  submitTask,
  gradeTask,
  upsertAssessment,
  listProgramAssessments,
  getAssessment,
  publishAssessment,
  startAssessmentAttempt,
  saveAssessmentAttemptAnswers,
  submitAssessmentAttempt,
  submitAssessment,
  gradeAssessmentAttempt,
  listAssessmentResults,
  getPrePostComparison,
  getTraineeAssessmentStatus,
  recomputeProgress,
  getEnrollmentProgress,
  approveCompletion,
  issueCertificate,
  getEnrollmentCertificate,
  verifyCertificate,
  listStudentPrograms,
  getTraineeProgramDetail,
  listSessionAttendance,
  listProgramMaterials,
  createProgramMaterial,
  publishProgram,
};

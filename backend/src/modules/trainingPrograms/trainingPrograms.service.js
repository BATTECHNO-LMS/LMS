'use strict';

const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { recordAudit } = require('../../shared/services/audit.service');
const { emitDomainEvent } = require('../notificationEngine');
const { isTrainerOnly, assertTrainerProgramAccess } = require('./trainerGuards');
const { resolveTraineeDetailSections } = require('./traineeProgramDetailSections');

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
    titleEn: settings.titleEn || null,
    targetAudience: settings.targetAudience || null,
    prerequisites: settings.prerequisites || null,
    venue: settings.venue || null,
    meetingUrl: settings.meetingUrl || null,
    expectedSessions: settings.expectedSessions ?? null,
    registrationOpenAt: settings.registrationOpenAt || null,
    registrationCloseAt: settings.registrationCloseAt || null,
    enrollmentOpen: settings.enrollmentOpen ?? null,
    visibilitySetting: settings.visibility || null,
    timezone: settings.timezone || null,
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

function mergeRequirementThreshold(existing, patch) {
  const prev = existing && typeof existing === 'object' ? existing : {};
  if (patch == null) return Object.keys(prev).length ? prev : undefined;
  return { ...prev, ...patch };
}

async function syncProgramRequirements(programId, body = {}) {
  const existingRows = await prisma.training_requirements.findMany({ where: { program_id: programId } });
  const existingByCode = Object.fromEntries(existingRows.map((r) => [r.code, r]));
  const passPatch = body.pass_score != null ? { pass_score: Number(body.pass_score) } : null;
  const defs = [
    {
      code: 'PRE_TEST',
      label: 'الاختبار القبلي',
      is_required: body.requires_pre_test === true,
      threshold_json: mergeRequirementThreshold(existingByCode.PRE_TEST?.threshold_json, passPatch),
    },
    {
      code: 'POST_TEST',
      label: 'الاختبار البعدي',
      is_required: body.requires_post_test === true,
      threshold_json: mergeRequirementThreshold(existingByCode.POST_TEST?.threshold_json, passPatch),
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
  await Promise.all(
    defs.map((d, i) =>
      prisma.training_requirements.upsert({
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
      })
    )
  );
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

  const leadAssignment = await prisma.training_trainer_assignments.findFirst({
    where: {
      training_program_id: programId,
      is_active: true,
      revoked_at: null,
      is_lead_trainer: true,
    },
    orderBy: { assigned_at: 'asc' },
  });
  let leadTrainer = null;
  if (leadAssignment) {
    const leadUser = await prisma.users.findUnique({
      where: { id: leadAssignment.trainer_user_id },
      select: { id: true, full_name: true, email: true, status: true },
    });
    if (leadUser) {
      leadTrainer = {
        userId: leadUser.id,
        fullName: leadUser.full_name,
        email: leadUser.email,
        status: leadUser.status,
        assignmentId: leadAssignment.id,
        isLeadTrainer: true,
      };
    }
  }

  const settings = row.settings_json && typeof row.settings_json === 'object' ? row.settings_json : {};
  const domains = Array.isArray(settings.domains)
    ? settings.domains.map((d) => String(d).trim()).filter(Boolean)
    : String(row.field || '')
        .split(/[،,•|]/)
        .map((d) => d.trim())
        .filter(Boolean);

  return {
    ...mapProgramRow(row, row.organizations),
    organization: row.organizations,
    cohortCount: row._count?.training_cohorts || 0,
    trainerCount: row._count?.training_trainer_assignments || 0,
    leadTrainer,
    domains,
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

  const settingsJson = {};
  if (body.expected_sessions !== undefined) settingsJson.expectedSessions = body.expected_sessions;
  if (body.timezone !== undefined) settingsJson.timezone = body.timezone;

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
      ...(Object.keys(settingsJson).length ? { settings_json: settingsJson } : {}),
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

  const trainerOnly = isTrainerOnly(requester);
  if (trainerOnly) {
    await assertTrainerProgramAccess(requester, programId);
  }

  const payload = body && typeof body === 'object' ? body : {};

  // Trainers may edit operational course fields for assigned programs only.
  // High-risk admin actions remain blocked (status transitions / publish / cancel / archive).
  if (trainerOnly) {
    const blockedKeys = ['status', 'organization_id', 'type', 'code'];
    for (const key of blockedKeys) {
      if (payload[key] !== undefined) {
        throw new ApiError(
          403,
          'لا يمكن للمدرب تغيير الحالة الإدارية أو ملكية الدورة. حدّث التفاصيل التشغيلية فقط.',
          null,
          'TRAINER_ADMIN_SETTING_FORBIDDEN'
        );
      }
    }
  }

  const prevSettings =
    existing.settings_json && typeof existing.settings_json === 'object' ? existing.settings_json : {};
  const nextSettings = { ...prevSettings };
  let settingsTouched = false;

  const settingsMap = [
    ['short_description', 'shortDescription'],
    ['title_en', 'titleEn'],
    ['target_audience', 'targetAudience'],
    ['prerequisites', 'prerequisites'],
    ['venue', 'venue'],
    ['meeting_url', 'meetingUrl'],
    ['online_meeting', 'meetingUrl'],
    ['expected_sessions', 'expectedSessions'],
    ['registration_open_at', 'registrationOpenAt'],
    ['registration_close_at', 'registrationCloseAt'],
    ['enrollment_open', 'enrollmentOpen'],
    ['visibility', 'visibility'],
    ['timezone', 'timezone'],
  ];
  for (const [bodyKey, settingsKey] of settingsMap) {
    if (payload[bodyKey] !== undefined) {
      nextSettings[settingsKey] = payload[bodyKey];
      settingsTouched = true;
    }
  }
  if (payload.domains !== undefined) {
    const domains = Array.isArray(payload.domains)
      ? payload.domains.map((d) => String(d).trim()).filter(Boolean)
      : String(payload.domains || '')
          .split(/[،,•|]/)
          .map((d) => d.trim())
          .filter(Boolean);
    nextSettings.domains = domains;
    settingsTouched = true;
    if (payload.field === undefined) {
      payload.field = domains.join('، ') || null;
    }
  }

  const changed = {};
  const track = (key, oldVal, newVal) => {
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed[key] = { from: oldVal ?? null, to: newVal ?? null };
    }
  };

  const data = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.field !== undefined ? { field: payload.field } : {}),
    ...(payload.objectives !== undefined ? { objectives: payload.objectives } : {}),
    ...(payload.outcomes !== undefined ? { outcomes: payload.outcomes } : {}),
    ...(payload.level !== undefined ? { level: payload.level } : {}),
    ...(payload.language !== undefined ? { language: payload.language } : {}),
    ...(payload.delivery_mode !== undefined ? { delivery_mode: payload.delivery_mode } : {}),
    ...(!trainerOnly && payload.status !== undefined ? { status: payload.status } : {}),
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
    ...(settingsTouched ? { settings_json: nextSettings } : {}),
    updated_at: new Date(),
  };

  if (payload.title !== undefined) track('title', existing.title, payload.title);
  if (payload.description !== undefined) track('description', existing.description, payload.description);
  if (payload.field !== undefined) track('field', existing.field, payload.field);
  if (payload.objectives !== undefined) track('objectives', existing.objectives, payload.objectives);
  if (payload.outcomes !== undefined) track('outcomes', existing.outcomes, payload.outcomes);
  if (payload.level !== undefined) track('level', existing.level, payload.level);
  if (payload.language !== undefined) track('language', existing.language, payload.language);
  if (payload.delivery_mode !== undefined) {
    track('delivery_mode', existing.delivery_mode, payload.delivery_mode);
  }
  if (!trainerOnly && payload.status !== undefined) track('status', existing.status, payload.status);
  if (payload.required_hours !== undefined) {
    track('required_hours', existing.required_hours, payload.required_hours);
  }
  if (payload.required_attendance_pct !== undefined) {
    track('required_attendance_pct', existing.required_attendance_pct, payload.required_attendance_pct);
  }
  if (payload.max_participants !== undefined) {
    track('max_participants', existing.max_participants, payload.max_participants);
  }
  if (payload.start_date !== undefined) track('start_date', existing.start_date, payload.start_date);
  if (payload.end_date !== undefined) track('end_date', existing.end_date, payload.end_date);
  if (settingsTouched) track('settings', prevSettings, nextSettings);

  const row = await prisma.training_programs.update({
    where: { id: programId },
    data,
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
    track('requirements', true, {
      requires_pre_test: payload.requires_pre_test,
      requires_post_test: payload.requires_post_test,
      requires_tasks: payload.requires_tasks,
      requires_final_task: payload.requires_final_task,
      requires_evaluation: payload.requires_evaluation,
      pass_score: payload.pass_score,
    });
  }

  if (Object.keys(changed).length) {
    await recordAudit({
      userId: requester.userId,
      organizationId: existing.organization_id,
      actionType: 'COURSE_UPDATED',
      entityType: 'training_program',
      entityId: row.id,
      oldValues: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.from])),
      newValues: {
        ...Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.to])),
        role: trainerOnly ? 'trainer' : requester.roles?.includes('admin') ? 'admin' : 'super_admin',
      },
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
  const isLearner =
    (requester.roles?.includes('trainee') || requester.roles?.includes('student')) &&
    !isSystemWideAdmin(requester) &&
    !requester.roles?.includes('admin') &&
    !requester.roles?.includes('trainer');
  const rows = await prisma.training_tasks.findMany({
    where: {
      program_id: programId,
      ...(isLearner ? { published_at: { not: null } } : {}),
    },
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

async function updateSession(requester, sessionId, body = {}) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, session.training_cohorts.organization_id);
  await assertTrainerCohortAccess(requester, session.cohort_id, 'can_manage_sessions');

  const payload = body && typeof body === 'object' ? body : {};
  const row = await prisma.training_sessions.update({
    where: { id: sessionId },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.starts_at !== undefined ? { starts_at: new Date(payload.starts_at) } : {}),
      ...(payload.ends_at !== undefined ? { ends_at: new Date(payload.ends_at) } : {}),
      ...(payload.hours !== undefined ? { hours: payload.hours } : {}),
      ...(payload.session_type !== undefined ? { session_type: payload.session_type } : {}),
      ...(payload.meeting_url !== undefined ? { meeting_url: payload.meeting_url } : {}),
      ...(payload.location !== undefined ? { location: payload.location } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.attendance_required !== undefined
        ? { attendance_required: Boolean(payload.attendance_required) }
        : {}),
      updated_at: new Date(),
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: session.training_cohorts.organization_id,
    actionType: 'TRAINING_SESSION_UPDATED',
    entityType: 'training_session',
    entityId: row.id,
    newValues: {
      title: row.title,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    },
  });

  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    location: row.location,
    meetingUrl: row.meeting_url,
    hours: row.hours,
  };
}

async function setAttendanceStatus(requester, sessionId, body = {}) {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    include: { training_cohorts: true },
  });
  if (!session) throw new ApiError(404, 'Session not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, session.training_cohorts.organization_id);
  await assertTrainerCohortAccess(requester, session.cohort_id, 'can_manage_attendance');

  const enrollmentId = body.enrollment_id;
  const status = String(body.status || '').trim().toLowerCase();
  const allowed = new Set(['present', 'absent', 'late', 'excused']);
  if (!enrollmentId || !allowed.has(status)) {
    throw new ApiError(400, 'enrollment_id وحالة حضور صالحة مطلوبان (present|absent|late|excused).');
  }

  const enrollment = await prisma.training_enrollments.findFirst({
    where: { id: enrollmentId, cohort_id: session.cohort_id },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود في دفعة هذه الجلسة.');

  const now = new Date();
  const record = await prisma.training_attendance_records.upsert({
    where: {
      session_id_enrollment_id: { session_id: sessionId, enrollment_id: enrollmentId },
    },
    create: {
      session_id: sessionId,
      enrollment_id: enrollmentId,
      user_id: enrollment.user_id,
      status,
      marked_via: 'TRAINER_MANUAL',
      marked_by: requester.userId,
      confirmed_at: now,
      reason: body.note || body.reason || null,
    },
    update: {
      status,
      marked_via: 'TRAINER_MANUAL',
      marked_by: requester.userId,
      reason: body.note || body.reason || null,
      confirmed_at: now,
      updated_at: now,
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: session.training_cohorts.organization_id,
    actionType: 'TRAINING_ATTENDANCE_SET',
    entityType: 'training_attendance_record',
    entityId: record.id,
    newValues: { sessionId, enrollmentId, status },
  });

  return {
    id: record.id,
    sessionId,
    enrollmentId,
    status: record.status,
    markedVia: record.marked_via,
  };
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

  await computeAndPersistProgress(enrollment.id).catch(() => null);

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
    select: { id: true, user_id: true },
  });
  const enrollmentIds = enrollments.map((e) => e.id);
  const existingRows = enrollmentIds.length
    ? await prisma.training_attendance_records.findMany({
        where: { session_id: sessionId, enrollment_id: { in: enrollmentIds } },
        select: { id: true, enrollment_id: true, status: true },
      })
    : [];
  const existingByEnrollment = new Map(existingRows.map((row) => [row.enrollment_id, row]));
  const toCreate = [];
  const toUpdateIds = [];
  const now = new Date();
  for (const enrollment of enrollments) {
    const existing = existingByEnrollment.get(enrollment.id);
    if (mode === 'safe' && existing && !['absent', 'unconfirmed'].includes(String(existing.status).toLowerCase())) {
      continue;
    }
    if (!existing) {
      toCreate.push({
        session_id: sessionId,
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        status: 'present',
        marked_via: 'MARK_ALL_PRESENT',
        marked_by: requester.userId,
        confirmed_at: now,
        reason: 'mark_all_present',
      });
    } else {
      toUpdateIds.push(existing.id);
    }
  }
  if (toCreate.length) {
    await prisma.training_attendance_records.createMany({ data: toCreate });
  }
  if (toUpdateIds.length) {
    await prisma.training_attendance_records.updateMany({
      where: { id: { in: toUpdateIds } },
      data: {
        status: 'present',
        marked_via: 'MARK_ALL_PRESENT',
        marked_by: requester.userId,
        reason: 'mark_all_present',
        updated_at: now,
      },
    });
  }
  const updated = toCreate.length + toUpdateIds.length;
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
  const { hydrateAttachmentSettings } = require('./trainingTaskWorkflow.service');
  let settings = {};
  if (Array.isArray(body.external_links)) settings.externalLinks = body.external_links;
  if (Array.isArray(body.allowed_file_types)) settings.allowedFileTypes = body.allowed_file_types;
  if (body.attachment_url) settings.attachmentUrl = body.attachment_url;
  if (body.settings && typeof body.settings === 'object') Object.assign(settings, body.settings);
  settings = await hydrateAttachmentSettings(settings, body);

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
      settings_json: Object.keys(settings).length ? settings : undefined,
      created_by: requester.userId,
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'TASK_CREATED',
    entityType: 'training_task',
    entityId: row.id,
    newValues: {
      title: row.title,
      published: Boolean(row.published_at),
      programId,
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
  return { id: row.id, title: row.title, isFinalTask: row.is_final_task, isPublished: Boolean(row.published_at) };
}

async function submitTask(requester, taskId, body) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.submitTask(requester, taskId, body || {});
}

async function gradeTask(requester, submissionId, body) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.gradeTask(requester, submissionId, body || {});
}

async function getTaskForRequester(requester, taskId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.getTaskForRequester(requester, taskId);
}

async function getTaskInstructionFile(requester, taskId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.getInstructionFileUrl(requester, taskId);
}

async function getMyTaskSubmission(requester, taskId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.getMySubmission(requester, taskId);
}

async function resubmitTask(requester, taskId, submissionId, body) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.resubmitTask(requester, taskId, submissionId, body || {});
}

async function getTaskSubmissionFile(requester, submissionId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.getSubmissionFileUrl(requester, submissionId);
}

async function listTaskSubmissions(requester, taskId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.listTaskSubmissions(requester, taskId);
}

async function getTaskSubmission(requester, submissionId) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.getTaskSubmission(requester, submissionId);
}

async function requestTaskRevision(requester, submissionId, body) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.requestRevision(requester, submissionId, body || {});
}

async function reopenTaskSubmission(requester, submissionId, body) {
  const workflow = require('./trainingTaskWorkflow.service');
  return workflow.reopenSubmission(requester, submissionId, body || {});
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

const trainingEvaluation = require('./trainingEvaluation.service');
const trainingCompletion = require('./trainingCompletion.service');

async function getProgramEvaluation(requester, programId) {
  return trainingEvaluation.getProgramEvaluation(requester, programId);
}
async function getEnrollmentEvaluation(requester, enrollmentId) {
  return trainingEvaluation.getEnrollmentEvaluation(requester, enrollmentId);
}
async function saveEvaluationDraft(requester, responseId, answers) {
  return trainingEvaluation.saveDraft(requester, responseId, answers);
}
async function submitEvaluation(requester, responseId, answers) {
  return trainingEvaluation.submitEvaluation(requester, responseId, answers);
}
async function reopenEvaluation(requester, assignmentId, reason) {
  return trainingEvaluation.reopenEvaluation(requester, assignmentId, reason);
}

async function getProgramCompletionReadiness(requester, programId, query) {
  return trainingCompletion.getProgramCompletionReadiness(requester, programId, query);
}
async function finalizeTraining(requester, payload) {
  return trainingCompletion.finalizeTraining(requester, payload);
}
async function reopenTraining(requester, programId, payload) {
  return trainingCompletion.reopenTraining(requester, programId, payload);
}
async function getIndividualReport(requester, enrollmentId) {
  return trainingCompletion.getIndividualReport(requester, enrollmentId);
}
async function generateIndividualReport(requester, enrollmentId) {
  return trainingCompletion.generateIndividualReport(requester, enrollmentId);
}
async function getCourseReport(requester, programId, query) {
  return trainingCompletion.getCourseReport(requester, programId, query);
}
async function generateCourseReport(requester, programId, payload) {
  return trainingCompletion.generateCourseReport(requester, programId, payload);
}

/**
 * Auth-checked entry point used by API routes: verifies the requester may see
 * this enrollment's progress, then delegates the actual computation to
 * computeAndPersistProgress (also used internally by trainingCompletion.service.js
 * without a requester).
 */
async function recomputeProgress(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (!isOwner) {
    await assertTrainerCohortAccess(requester, enrollment.cohort_id, 'can_view_progress');
  }
  return computeAndPersistProgress(enrollmentId);
}

async function computeAndPersistProgress(enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      training_cohorts: { include: { training_programs: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');

  const program = enrollment.training_cohorts.training_programs;
  const [
    sessions,
    attendance,
    tasks,
    submissions,
    reqRows,
    assessments,
    finalTaskRow,
    evaluationAssignment,
  ] = await Promise.all([
    prisma.training_sessions.findMany({
      where: { cohort_id: enrollment.cohort_id, counts_toward_hours: true },
      select: { id: true, hours: true, starts_at: true, ends_at: true },
    }),
    prisma.training_attendance_records.findMany({
      where: { enrollment_id: enrollmentId },
      select: { session_id: true, status: true },
    }),
    prisma.training_tasks.findMany({
      where: { program_id: program.id, is_required: true, published_at: { not: null } },
      select: { id: true },
    }),
    prisma.training_task_submissions.findMany({
      where: { enrollment_id: enrollmentId, status: { in: ['ACCEPTED', 'GRADED'] } },
      select: { task_id: true, score: true, submitted_at: true },
    }),
    prisma.training_requirements.findMany({ where: { program_id: program.id } }),
    prisma.training_assessments.findMany({
      where: { program_id: program.id, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
      select: {
        id: true,
        kind: true,
        pass_score: true,
        training_assessment_attempts: {
          where: { enrollment_id: enrollmentId },
          select: { status: true, score: true, graded_at: true },
        },
      },
    }),
    prisma.training_tasks.findFirst({
      where: { program_id: program.id, is_final_task: true },
      select: { id: true },
    }),
    prisma.training_evaluation_assignments.findUnique({
      where: { enrollment_id: enrollmentId },
      select: { status: true },
    }),
  ]);
  const { buildProgressRequirements } = require('./trainingProgress.helpers');
  const snapshot = buildProgressRequirements({
    program,
    sessions,
    attendance,
    requiredTasks: tasks,
    submissions,
    reqRows,
    assessments,
    finalTaskRow,
    evaluationAssignment,
  });
  const { requirements, completionPct, hoursCompleted, attendancePct, allOk } = snapshot;
  const hoursRequired = Number(program.required_hours || 0);

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

  const wasAlreadyReadyOrDone = ['COMPLETED', 'REQUIREMENTS_COMPLETED'].includes(enrollment.status);
  if (allOk && enrollment.status !== 'COMPLETED') {
    await prisma.training_enrollments.update({
      where: { id: enrollmentId },
      data: { status: 'REQUIREMENTS_COMPLETED', updated_at: new Date() },
    });
  }
  if (allOk && !wasAlreadyReadyOrDone) {
    await emitDomainEvent('TRAINING_REQUIREMENTS_COMPLETED', {
      organizationId: enrollment.organization_id,
      affectedUserId: enrollment.user_id,
      entityType: 'training_enrollment',
      entityId: enrollmentId,
    }).catch(() => null);
    await emitDomainEvent('TRAINING_READY_TO_COMPLETE', {
      organizationId: enrollment.organization_id,
      affectedUserId: enrollment.user_id,
      entityType: 'training_enrollment',
      entityId: enrollmentId,
      templateVars: { course_title: program.title },
    }).catch(() => null);
    const existingCertificate = await prisma.training_certificates.findFirst({
      where: { enrollment_id: enrollmentId },
    });
    if (!existingCertificate) {
      await emitDomainEvent('CERTIFICATE_ELIGIBLE', {
        organizationId: enrollment.organization_id,
        affectedUserId: enrollment.user_id,
        entityType: 'training_enrollment',
        entityId: enrollmentId,
      }).catch(() => null);
    }
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
    if (isTrainerOnly(requester)) {
      await assertTrainerCohortAccess(requester, enrollment.cohort_id, 'can_view_reports');
    } else {
      throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
    }
  }
  const row = await prisma.training_certificates.findFirst({
    where: { enrollment_id: enrollmentId, status: 'ISSUED' },
    orderBy: { issued_at: 'desc' },
  });
  if (!row) {
    throw new ApiError(404, 'لا توجد شهادة صادرة لهذا التسجيل.', null, 'CERTIFICATE_NOT_ISSUED');
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

async function getTraineeProgramDetail(requester, programId, { sections } = {}) {
  const wanted = resolveTraineeDetailSections(sections);
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

  const jobs = {
    trainerCount: prisma.training_trainer_assignments.count({
      where: { training_program_id: programId, is_active: true, revoked_at: null },
    }),
  };
  if (wanted.has('sessions')) {
    jobs.sessions = prisma.training_sessions.findMany({
      where: { cohort_id: enrollment.cohort_id },
      orderBy: { starts_at: 'asc' },
      select: {
        id: true,
        title: true,
        starts_at: true,
        ends_at: true,
        status: true,
        location: true,
        meeting_url: true,
      },
    });
    jobs.attendance = prisma.training_attendance_records.findMany({
      where: { enrollment_id: enrollment.id },
      select: { session_id: true, status: true, confirmed_at: true },
    });
  }
  if (wanted.has('tasks')) {
    jobs.tasks = prisma.training_tasks.findMany({
      where: { program_id: programId, published_at: { not: null } },
      orderBy: { created_at: 'desc' },
    });
    jobs.submissions = prisma.training_task_submissions.findMany({
      where: { enrollment_id: enrollment.id },
    });
  }
  if (wanted.has('assessments')) {
    jobs.assessments = prisma.training_assessments.findMany({
      where: { program_id: programId, is_published: true },
      select: {
        id: true,
        kind: true,
        title: true,
        code: true,
        duration_minutes: true,
        max_attempts: true,
        pass_score: true,
        _count: { select: { training_assessment_questions: true } },
        training_assessment_attempts: {
          where: { enrollment_id: enrollment.id },
          select: { id: true, score: true, status: true, submitted_at: true },
        },
      },
    });
  }
  if (wanted.has('materials')) {
    jobs.materials = prisma.training_materials.findMany({
      where: {
        program_id: programId,
        is_published: true,
        OR: [{ available_from: null }, { available_from: { lte: new Date() } }],
      },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        material_type: true,
        url: true,
        storage_key: true,
        file_id: true,
        visibility: true,
        duration_seconds: true,
        session_id: true,
        sort_order: true,
      },
    });
  }
  if (wanted.has('certificate')) {
    jobs.certificate = prisma.training_certificates.findFirst({
      where: { enrollment_id: enrollment.id, status: 'ISSUED' },
      orderBy: { issued_at: 'desc' },
      select: {
        id: true,
        certificate_number: true,
        verification_code: true,
        issued_at: true,
      },
    });
  }

  const jobKeys = Object.keys(jobs);
  const jobValues = await Promise.all(jobKeys.map((key) => jobs[key]));
  const bag = Object.fromEntries(jobKeys.map((key, i) => [key, jobValues[i]]));

  const { snapshotFromProgressRow } = require('./trainingProgress.helpers');
  let progressSnapshot = snapshotFromProgressRow(enrollment.training_progress, enrollment.id);
  if (!progressSnapshot) {
    try {
      progressSnapshot = await recomputeProgress(requester, enrollment.id);
    } catch {
      progressSnapshot = null;
    }
  }
  const settings = program.settings_json && typeof program.settings_json === 'object' ? program.settings_json : {};
  const preReq = progressSnapshot?.requirements?.preTest;
  const contentLocked = Boolean(
    settings.preTestBlocksContent && preReq?.required && !preReq?.ok
  );

  const payload = {
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
    trainerAssignmentNote: bag.trainerCount === 0 ? 'لم يتم تعيين مدرب بعد' : null,
    progress: progressSnapshot,
  };

  if (wanted.has('sessions')) {
    const sessions = bag.sessions || [];
    const attendance = bag.attendance || [];
    const attendanceBySession = new Map(attendance.map((a) => [a.session_id, a]));
    payload.sessions = contentLocked
      ? []
      : sessions.map((s) => {
          const rec = attendanceBySession.get(s.id);
          return {
            id: s.id,
            title: s.title,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            status: s.status,
            location: s.location,
            meetingUrl: s.meeting_url,
            attendance: rec ? { status: rec.status, confirmedAt: rec.confirmed_at } : null,
          };
        });
  }
  if (wanted.has('tasks')) {
    const { getTraineeTaskListExtras } = require('./trainingTaskWorkflow.service');
    payload.tasks = contentLocked
      ? []
      : await getTraineeTaskListExtras(programId, bag.tasks || [], bag.submissions || []);
  }
  if (wanted.has('assessments')) {
    payload.assessments = (bag.assessments || []).map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      code: a.code || null,
      durationMinutes: a.duration_minutes,
      maxAttempts: a.max_attempts,
      passScore: a.pass_score != null ? Number(a.pass_score) : null,
      questionCount: a._count?.training_assessment_questions ?? 0,
      attempts: (a.training_assessment_attempts || []).map((at) => ({
        id: at.id,
        score: at.score,
        status: at.status,
        submittedAt: at.submitted_at,
      })),
    }));
  }
  if (wanted.has('materials')) {
    const materials = bag.materials || [];
    payload.materials = contentLocked
      ? []
      : materials
          .filter((m) => m.material_type !== 'RECORDED_LECTURE')
          .map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            materialType: m.material_type,
            url: m.url,
            hasFile: Boolean(m.storage_key || m.file_id),
            visibility: m.visibility,
          }));
    payload.recordedLectures = contentLocked
      ? []
      : materials
          .filter((m) => m.material_type === 'RECORDED_LECTURE')
          .map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            durationSeconds: m.duration_seconds,
            sessionId: m.session_id,
            hasFile: Boolean(m.storage_key || m.file_id),
            hasExternalUrl: Boolean(m.url),
            sortOrder: m.sort_order,
          }));
  }
  if (wanted.has('certificate')) {
    payload.certificate = bag.certificate
      ? {
          id: bag.certificate.id,
          certificateNumber: bag.certificate.certificate_number,
          verificationCode: bag.certificate.verification_code,
          issuedAt: bag.certificate.issued_at,
        }
      : null;
  }

  return payload;
}

async function listProgramMaterials(requester, programId) {
  const courseContent = require('./courseContent.service');
  return courseContent.listProgramMaterials(requester, programId, { excludeRecordedLectures: true });
}

async function createProgramMaterial(requester, programId, body = {}) {
  const courseContent = require('./courseContent.service');
  return courseContent.createProgramMaterial(requester, programId, body);
}

async function updateProgramMaterial(requester, materialId, body = {}) {
  const courseContent = require('./courseContent.service');
  return courseContent.updateProgramMaterial(requester, materialId, body);
}

async function deleteProgramMaterial(requester, materialId) {
  const courseContent = require('./courseContent.service');
  return courseContent.deleteProgramMaterial(requester, materialId);
}

async function listRecordedLectures(requester, programId) {
  const courseContent = require('./courseContent.service');
  return courseContent.listRecordedLectures(requester, programId);
}

async function createRecordedLecture(requester, programId, body = {}) {
  const courseContent = require('./courseContent.service');
  return courseContent.createRecordedLecture(requester, programId, body);
}

async function updateRecordedLecture(requester, lectureId, body = {}) {
  const courseContent = require('./courseContent.service');
  return courseContent.updateRecordedLecture(requester, lectureId, body);
}

async function publishRecordedLecture(requester, lectureId, body = {}) {
  const courseContent = require('./courseContent.service');
  const publish = body?.publish !== false && body?.unpublish !== true;
  return courseContent.publishRecordedLecture(requester, lectureId, publish);
}

async function deleteRecordedLecture(requester, lectureId) {
  const courseContent = require('./courseContent.service');
  return courseContent.deleteRecordedLecture(requester, lectureId);
}

async function getMaterialPlaybackUrl(requester, materialId) {
  const courseContent = require('./courseContent.service');
  return courseContent.getMaterialPlaybackUrl(requester, materialId);
}

async function updateTask(requester, taskId, body = {}) {
  const courseContent = require('./courseContent.service');
  return courseContent.updateTask(requester, taskId, body);
}

async function listProgramTasksDetailed(requester, programId) {
  const courseContent = require('./courseContent.service');
  return courseContent.listProgramTasksDetailed(requester, programId);
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

/**
 * Idempotent certificate issuance core: returns the existing ISSUED certificate
 * when present instead of creating a duplicate. No requester/permission checks —
 * callers (issueCertificate route handler, trainingCompletion finalize flow)
 * are responsible for authorization.
 */
async function issueCertificateCore(enrollmentId, issuedByUserId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      training_progress: true,
      training_cohorts: { include: { training_programs: true } },
    },
  });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');

  const existing = await prisma.training_certificates.findFirst({
    where: { enrollment_id: enrollmentId, status: 'ISSUED' },
    orderBy: { issued_at: 'desc' },
  });
  if (existing) {
    return {
      id: existing.id,
      certificateNumber: existing.certificate_number,
      verificationCode: existing.verification_code,
      status: existing.status,
      alreadyIssued: true,
    };
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
      issued_by: issuedByUserId || null,
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
    alreadyIssued: false,
  };
}

async function issueCertificate(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'Enrollment not found');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, enrollment.organization_id);
  if (isTrainerOnly(requester)) {
    throw new ApiError(403, 'إصدار الشهادات متاح لمسؤول المؤسسة فقط.');
  }
  return issueCertificateCore(enrollmentId, requester.userId);
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
  mergeRequirementThreshold,
  updateProgram,
  createCohort,
  listCohorts,
  enrollUser,
  listEnrollments,
  importEnrollmentsPreview,
  importEnrollmentsCommit,
  createSession,
  updateSession,
  setAttendanceStatus,
  listCohortSessions,
  openAttendanceWindow,
  confirmAttendance,
  markAllPresent,
  createTask,
  listProgramTasks,
  submitTask,
  gradeTask,
  getTaskForRequester,
  getTaskInstructionFile,
  getMyTaskSubmission,
  resubmitTask,
  getTaskSubmissionFile,
  listTaskSubmissions,
  getTaskSubmission,
  requestTaskRevision,
  reopenTaskSubmission,
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
  computeAndPersistProgress,
  getEnrollmentProgress,
  approveCompletion,
  issueCertificate,
  issueCertificateCore,
  getEnrollmentCertificate,
  verifyCertificate,
  listStudentPrograms,
  getTraineeProgramDetail,
  listSessionAttendance,
  listProgramMaterials,
  createProgramMaterial,
  updateProgramMaterial,
  deleteProgramMaterial,
  listRecordedLectures,
  createRecordedLecture,
  updateRecordedLecture,
  publishRecordedLecture,
  deleteRecordedLecture,
  getMaterialPlaybackUrl,
  updateTask,
  listProgramTasksDetailed,
  publishProgram,
  getProgramEvaluation,
  getEnrollmentEvaluation,
  saveEvaluationDraft,
  submitEvaluation,
  reopenEvaluation,
  getProgramCompletionReadiness,
  finalizeTraining,
  reopenTraining,
  getIndividualReport,
  generateIndividualReport,
  getCourseReport,
  generateCourseReport,
};

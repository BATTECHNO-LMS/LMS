'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../shared/services/audit.service');
const {
  assertOrganizationAccess,
  isSystemWideAdmin,
} = require('../../utils/organizationScope');
const { hashPassword } = require('../../utils/password');
const { emitDomainEvent } = require('../notificationEngine');
const {
  listActiveTrainerAssignments,
  listTrainerAssignmentsForProgram,
  mergeAssignmentPermissionFlags,
  resolveAccessibleCohortIds,
  mapAssignment,
  findTrainerAssignmentForProgram,
  assertTrainerPermission,
  TRAINER_PERMISSION_KEYS,
} = require('./trainerScope');
const { resolveTrainerAssignmentPermissions } = require('./trainerPermissionPolicy');

function requireOrgAdmin(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function ensureTrainerRole(userId) {
  const role = await prisma.roles.findUnique({ where: { code: 'trainer' } });
  if (!role) throw new ApiError(500, 'Trainer role is not configured');
  const link = await prisma.user_roles.findFirst({
    where: { user_id: userId, role_id: role.id },
  });
  if (!link) {
    await prisma.user_roles.create({ data: { user_id: userId, role_id: role.id } });
  }
  return role;
}

async function upsertTrainerProfile(userId, profile = {}) {
  const data = {
    ...(profile.professional_bio !== undefined ? { professional_bio: profile.professional_bio } : {}),
    ...(profile.training_field !== undefined ? { training_field: profile.training_field } : {}),
    ...(profile.specialty !== undefined ? { specialty: profile.specialty } : {}),
    ...(profile.cv_url !== undefined ? { cv_url: profile.cv_url } : {}),
    ...(profile.avatar_url !== undefined ? { avatar_url: profile.avatar_url } : {}),
    updated_at: new Date(),
  };
  if (Object.keys(data).length <= 1) return null;
  return prisma.trainer_profiles.upsert({
    where: { user_id: userId },
    create: { user_id: userId, ...data },
    update: data,
  });
}

/**
 * Admin creates a trainer user (or reuses existing) and institution assignment.
 */
async function createTrainerUser(requester, organizationId, body) {
  requireOrgAdmin(requester, organizationId);
  const org = await prisma.organizations.findFirst({
    where: { id: organizationId, type: 'INSTITUTION', status: 'active' },
  });
  if (!org) throw new ApiError(404, 'Institution not found');

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!email || !fullName || !phone) {
    throw new ApiError(400, 'الاسم الكامل والبريد ورقم الهاتف مطلوبة.');
  }

  let user = await prisma.users.findUnique({ where: { email } });
  const now = new Date();
  if (!user) {
    const tempPassword = body.temporary_password || `Tr${Math.random().toString(36).slice(2, 10)}!`;
    const password_hash = await hashPassword(tempPassword);
    user = await prisma.users.create({
      data: {
        full_name: fullName,
        email,
        phone,
        password_hash,
        status: body.activate === false ? 'inactive' : 'active',
        email_verified_at: now,
        activated_at: body.activate === false ? null : now,
      },
    });
  } else {
    user = await prisma.users.update({
      where: { id: user.id },
      data: {
        full_name: fullName,
        phone,
        updated_at: now,
        ...(body.activate === true
          ? { status: 'active', activated_at: now, email_verified_at: user.email_verified_at || now }
          : {}),
      },
    });
  }

  await ensureTrainerRole(user.id);
  await upsertTrainerProfile(user.id, body.profile || {});

  const existingInst = await prisma.user_organization_assignments.findFirst({
    where: {
      user_id: user.id,
      is_active: true,
      organizations: { type: 'INSTITUTION' },
    },
  });
  if (existingInst && existingInst.organization_id !== organizationId) {
    throw new ApiError(409, 'المستخدم مرتبط بمؤسسة أخرى نشطة.');
  }

  await prisma.user_organization_assignments.updateMany({
    where: { user_id: user.id, organization_id: organizationId, is_active: true },
    data: { is_active: false, updated_at: now },
  });

  const orgAssignment = await prisma.user_organization_assignments.create({
    data: {
      user_id: user.id,
      organization_id: organizationId,
      role_code: 'trainer',
      branch_id: body.branch_id || null,
      assigned_by: requester.userId,
      is_active: true,
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'TRAINER_USER_CREATED',
    entityType: 'user',
    entityId: user.id,
    newValues: { email, role: 'trainer' },
  });

  await emitDomainEvent('TRAINER_ASSIGNED', {
    affectedUserId: user.id,
    organizationId,
    entityType: 'user',
    entityId: user.id,
    templateVars: {
      trainer_name: user.full_name,
      organization_name: org.name,
      action_url: '/institutions/login',
    },
  }).catch(() => null);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    organizationAssignmentId: orgAssignment.id,
    roleCode: 'trainer',
  };
}

async function assignTrainerToCourse(requester, organizationId, body) {
  requireOrgAdmin(requester, organizationId);

  const program = await prisma.training_programs.findFirst({
    where: {
      id: body.training_program_id,
      organization_id: organizationId,
      type: 'TRAINING_COURSE',
    },
  });
  if (!program) throw new ApiError(404, 'الدورة التدريبية غير موجودة لهذه المؤسسة.');

  let cohortId = body.training_cohort_id || null;
  if (cohortId) {
    const cohort = await prisma.training_cohorts.findFirst({
      where: { id: cohortId, program_id: program.id, organization_id: organizationId },
    });
    if (!cohort) throw new ApiError(400, 'الدفعة لا تنتمي إلى الدورة المحددة.');
  }

  await ensureTrainerRole(body.trainer_user_id);

  const orgAssign = await prisma.user_organization_assignments.findFirst({
    where: {
      user_id: body.trainer_user_id,
      organization_id: organizationId,
      is_active: true,
      role_code: 'trainer',
    },
  });
  if (!orgAssign && !isSystemWideAdmin(requester)) {
    throw new ApiError(400, 'يجب ربط المدرب بالمؤسسة بدور trainer أولًا.');
  }

  const existing = await prisma.training_trainer_assignments.findFirst({
    where: {
      trainer_user_id: body.trainer_user_id,
      training_program_id: program.id,
      training_cohort_id: cohortId,
      is_active: true,
      revoked_at: null,
    },
  });

  const permDefaults = resolveTrainerAssignmentPermissions(body);

  let row;
  if (existing) {
    row = await prisma.training_trainer_assignments.update({
      where: { id: existing.id },
      data: { ...permDefaults, updated_at: new Date() },
      include: {
        organizations: { select: { id: true, name: true, type: true } },
        training_programs: true,
        training_cohorts: true,
      },
    });
  } else {
    row = await prisma.training_trainer_assignments.create({
      data: {
        trainer_user_id: body.trainer_user_id,
        organization_id: organizationId,
        training_program_id: program.id,
        training_cohort_id: cohortId,
        assigned_by: requester.userId,
        ...permDefaults,
      },
      include: {
        organizations: { select: { id: true, name: true, type: true } },
        training_programs: true,
        training_cohorts: true,
      },
    });
  }

  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: existing ? 'TRAINER_ASSIGNMENT_UPDATED' : 'TRAINER_ASSIGNED',
    entityType: 'training_trainer_assignment',
    entityId: row.id,
    newValues: {
      trainerUserId: body.trainer_user_id,
      programId: program.id,
      cohortId,
    },
  });

  await emitDomainEvent('TRAINER_ASSIGNED', {
    affectedUserId: body.trainer_user_id,
    organizationId,
    entityType: 'training_program',
    entityId: program.id,
    templateVars: {
      course_title: program.title,
      action_url: `/trainer/courses/${program.id}`,
    },
  }).catch(() => null);

  return mapAssignment(row);
}

async function revokeTrainerAssignment(requester, organizationId, assignmentId) {
  requireOrgAdmin(requester, organizationId);
  const existing = await prisma.training_trainer_assignments.findFirst({
    where: { id: assignmentId, organization_id: organizationId },
  });
  if (!existing) throw new ApiError(404, 'التعيين غير موجود');
  const row = await prisma.training_trainer_assignments.update({
    where: { id: assignmentId },
    data: { is_active: false, revoked_at: new Date(), updated_at: new Date() },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'TRAINER_ASSIGNMENT_REVOKED',
    entityType: 'training_trainer_assignment',
    entityId: row.id,
  });
  return { id: row.id, revoked: true };
}

async function listTrainerCourses(requester) {
  if (!requester?.userId) throw new ApiError(401, 'Unauthorized');
  const assignments = await listActiveTrainerAssignments(requester.userId);
  const byProgram = new Map();
  for (const a of assignments) {
    const key = a.trainingProgramId;
    if (!byProgram.has(key)) {
      byProgram.set(key, {
        program: a.program,
        organization: a.organization,
        assignments: [],
        permissions: { ...a.permissions },
        isLeadTrainer: a.isLeadTrainer,
      });
    } else {
      const entry = byProgram.get(key);
      for (const [permKey, value] of Object.entries(a.permissions || {})) {
        if (value) entry.permissions[permKey] = true;
      }
      if (a.isLeadTrainer) entry.isLeadTrainer = true;
    }
    byProgram.get(key).assignments.push(a);
  }
  return [...byProgram.values()];
}

async function getTrainerCourse(requester, programId) {
  const rows = await listTrainerAssignmentsForProgram(requester.userId, programId);
  if (!rows.length && !requester.isGlobal) {
    throw new ApiError(403, 'لا تملك تعيينًا نشطًا لهذه الدورة التدريبية.');
  }

  const primaryRow = rows.find((r) => r.training_cohort_id == null) || rows[0] || null;
  const assignment = mapAssignment(primaryRow);
  const { permissions: mergedFlags, isLeadTrainer } = mergeAssignmentPermissionFlags(rows);
  const permissions = Object.fromEntries(
    TRAINER_PERMISSION_KEYS.map((k) => {
      const camel = {
        can_manage_sessions: 'canManageSessions',
        can_manage_attendance: 'canManageAttendance',
        can_manage_materials: 'canManageMaterials',
        can_manage_tasks: 'canManageTasks',
        can_grade_tasks: 'canGradeTasks',
        can_manage_assessments: 'canManageAssessments',
        can_grade_assessments: 'canGradeAssessments',
        can_view_trainees: 'canViewTrainees',
        can_view_progress: 'canViewProgress',
        can_view_reports: 'canViewReports',
        can_finalize_training: 'canFinalizeTraining',
        can_send_course_announcements: 'canSendCourseAnnouncements',
      }[k];
      return [camel, mergedFlags[k]];
    })
  );

  const accessibleCohortIds = resolveAccessibleCohortIds(rows);
  const cohortWhere = {
    program_id: programId,
    ...(accessibleCohortIds ? { id: { in: accessibleCohortIds } } : {}),
  };

  const cohorts = await prisma.training_cohorts.findMany({
    where: cohortWhere,
    orderBy: { start_date: 'asc' },
  });
  const cohortIds = cohorts.map((c) => c.id);

  const traineeCount = cohortIds.length
    ? await prisma.training_enrollments.count({
        where: {
          cohort_id: { in: cohortIds },
          status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED', 'REQUIREMENTS_COMPLETED'] },
        },
      })
    : 0;

  const now = new Date();
  const [sessions, tasks, assessments, enrollments, pendingSubmissions, unconfirmedAttendance] =
    await Promise.all([
      cohortIds.length
        ? prisma.training_sessions.findMany({
            where: { cohort_id: { in: cohortIds } },
            orderBy: { starts_at: 'asc' },
            take: 100,
            select: {
              id: true,
              title: true,
              starts_at: true,
              ends_at: true,
              session_type: true,
              status: true,
              cohort_id: true,
              meeting_url: true,
              location: true,
            },
          })
        : [],
      prisma.training_tasks.findMany({
        where: { program_id: programId },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          due_at: true,
          published_at: true,
          is_required: true,
          is_final_task: true,
          max_score: true,
          grading_mode: true,
        },
      }),
      prisma.training_assessments.findMany({
        where: { program_id: programId },
        select: {
          id: true,
          kind: true,
          title: true,
          is_published: true,
          opens_at: true,
          closes_at: true,
          pass_score: true,
          duration_minutes: true,
        },
      }),
      permissions.canViewTrainees && cohortIds.length
        ? prisma.training_enrollments.findMany({
            where: {
              cohort_id: { in: cohortIds },
              status: {
                in: ['APPROVED', 'ACTIVE', 'COMPLETED', 'REQUIREMENTS_COMPLETED', 'INVITED'],
              },
            },
            include: {
              training_progress: true,
              training_cohorts: { select: { id: true, name: true, branch_id: true } },
            },
            take: 200,
            orderBy: { created_at: 'desc' },
          })
        : Promise.resolve([]),
      cohortIds.length
        ? prisma.training_task_submissions.count({
            where: {
              status: { in: ['SUBMITTED', 'RESUBMITTED'] },
              training_tasks: { program_id: programId },
              training_enrollments: { cohort_id: { in: cohortIds } },
            },
          })
        : 0,
      cohortIds.length
        ? prisma.training_attendance_records.count({
            where: {
              confirmed_at: null,
              status: 'absent',
              training_sessions: { cohort_id: { in: cohortIds }, starts_at: { lt: now } },
            },
          })
        : 0,
    ]);

  const userIds = [...new Set((enrollments || []).map((e) => e.user_id))];
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const upcomingSession = sessions.find((s) => s.starts_at && new Date(s.starts_at) >= now) || null;
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length;

  const trainees = (enrollments || []).map((e) => {
    const user = userById.get(e.user_id);
    return {
      enrollmentId: e.id,
      userId: e.user_id,
      fullName: user?.full_name || '—',
      email: user?.email || null,
      status: e.status,
      cohortId: e.cohort_id,
      cohortName: e.training_cohorts?.name || null,
      branchId: e.training_cohorts?.branch_id || null,
      progress: e.training_progress
        ? {
            completionPct: Number(e.training_progress.completion_pct || 0),
            attendancePct: Number(e.training_progress.attendance_pct || 0),
            hoursCompleted: Number(e.training_progress.hours_completed || 0),
            hoursRequired: e.training_progress.hours_required,
            status: e.training_progress.status,
            atRisk: Number(e.training_progress.attendance_pct || 100) < 70,
          }
        : null,
    };
  });

  const atRiskTrainees = trainees.filter((t) => t.progress?.atRisk);

  const programRow = await prisma.training_programs.findUnique({
    where: { id: programId },
  });
  const programFull = programRow
    ? {
        id: programRow.id,
        title: programRow.title,
        status: programRow.status,
        type: programRow.type,
        organizationId: programRow.organization_id,
        code: programRow.code,
        description: programRow.description,
        objectives: programRow.objectives,
        outcomes: programRow.outcomes,
        field: programRow.field,
        level: programRow.level,
        language: programRow.language,
        deliveryMode: programRow.delivery_mode,
        startDate: programRow.start_date,
        endDate: programRow.end_date,
        requiredHours: programRow.required_hours,
        requiredAttendancePct: programRow.required_attendance_pct,
        maxParticipants: programRow.max_participants,
      }
    : assignment?.program || null;

  return {
    assignment,
    assignments: rows.map(mapAssignment),
    program: programFull,
    organization: assignment?.organization || null,
    permissions,
    isLeadTrainer,
    cohorts: cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      startDate: c.start_date,
      endDate: c.end_date,
    })),
    traineeCount,
    overview: {
      upcomingSession: upcomingSession
        ? {
            id: upcomingSession.id,
            title: upcomingSession.title,
            startsAt: upcomingSession.starts_at,
            cohortId: upcomingSession.cohort_id,
          }
        : null,
      completedSessions,
      totalSessions: sessions.length,
      pendingSubmissions,
      unconfirmedAttendance,
      atRiskCount: atRiskTrainees.length,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      sessionType: s.session_type,
      status: s.status,
      cohortId: s.cohort_id,
      meetingUrl: s.meeting_url,
      location: s.location,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      deadline: t.due_at,
      isPublished: Boolean(t.published_at),
      isRequired: t.is_required,
      isFinal: t.is_final_task,
      maxScore: t.max_score,
      gradingMode: t.grading_mode,
    })),
    assessments: assessments.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      isPublished: a.is_published,
      opensAt: a.opens_at,
      closesAt: a.closes_at,
      passScore: a.pass_score,
      durationMinutes: a.duration_minutes,
    })),
    trainees,
    progressRows: permissions.canViewProgress ? trainees : [],
    reportsSummary: permissions.canViewReports
      ? {
          traineeCount,
          totalSessions: sessions.length,
          completedSessions,
          pendingSubmissions,
          unconfirmedAttendance,
          atRiskCount: atRiskTrainees.length,
        }
      : null,
  };
}

async function getTrainerDashboard(requester) {
  const courses = await listTrainerCourses(requester);
  const assignments = await listActiveTrainerAssignments(requester.userId);
  const accessibleByProgram = new Map();
  for (const a of assignments) {
    const key = a.trainingProgramId;
    if (!accessibleByProgram.has(key)) accessibleByProgram.set(key, []);
    accessibleByProgram.get(key).push(a);
  }

  const cohortFilters = [];
  for (const [programId, list] of accessibleByProgram.entries()) {
    if (list.some((a) => !a.trainingCohortId)) {
      cohortFilters.push({ training_cohorts: { program_id: programId } });
    } else {
      const ids = list.map((a) => a.trainingCohortId).filter(Boolean);
      if (ids.length) cohortFilters.push({ cohort_id: { in: ids } });
    }
  }

  const now = new Date();
  const sessionWhere = cohortFilters.length ? { OR: cohortFilters, starts_at: { gte: now } } : null;

  const upcomingSessions = sessionWhere
    ? await prisma.training_sessions.findMany({
        where: sessionWhere,
        orderBy: { starts_at: 'asc' },
        take: 8,
        select: {
          id: true,
          title: true,
          starts_at: true,
          ends_at: true,
          cohort_id: true,
        },
      })
    : [];

  const programIds = [...accessibleByProgram.keys()];
  const allCohortIds = assignments.map((a) => a.trainingCohortId).filter(Boolean);
  const hasProgramLevel = assignments.some((a) => !a.trainingCohortId);

  const enrollmentScope = hasProgramLevel
    ? { training_cohorts: { program_id: { in: programIds } } }
    : allCohortIds.length
      ? { cohort_id: { in: allCohortIds } }
      : null;

  const [pendingSubmissions, unconfirmedAttendance, atRisk] = await Promise.all([
    programIds.length
      ? prisma.training_task_submissions.count({
          where: {
            status: { in: ['SUBMITTED', 'RESUBMITTED'] },
            training_tasks: { program_id: { in: programIds } },
            ...(enrollmentScope ? { training_enrollments: enrollmentScope } : {}),
          },
        })
      : 0,
    cohortFilters.length
      ? prisma.training_attendance_records.count({
          where: {
            confirmed_at: null,
            status: 'absent',
            training_sessions: {
              starts_at: { lt: now },
              OR: cohortFilters,
            },
          },
        })
      : 0,
    enrollmentScope
      ? prisma.training_progress.count({
          where: {
            attendance_pct: { lt: 70 },
            training_enrollments: enrollmentScope,
          },
        })
      : 0,
  ]);

  return {
    activeCourses: courses.length,
    assignedCohorts: assignments.length,
    upcomingSessions: upcomingSessions.length,
    pendingSubmissions,
    unconfirmedAttendance,
    traineesNeedingFollowUp: atRisk,
    courses,
    nextSessions: upcomingSessions,
  };
}

async function assertTrainerCanAccessProgram(requester, programId, permissionKey = null) {
  if (requester.isGlobal) return null;
  const rows = await listTrainerAssignmentsForProgram(requester.userId, programId);
  if (!rows.length) throw new ApiError(403, 'لا تملك تعيينًا نشطًا لهذه الدورة التدريبية.');
  if (permissionKey) {
    const { permissions } = mergeAssignmentPermissionFlags(rows);
    if (!permissions[permissionKey]) {
      throw new ApiError(403, 'لا تملك صلاحية تنفيذ هذا الإجراء على الدورة.');
    }
  }
  return mapAssignment(rows.find((r) => r.training_cohort_id == null) || rows[0]);
}

async function listOrganizationTrainerAssignments(requester, organizationId) {
  requireOrgAdmin(requester, organizationId);
  const rows = await prisma.training_trainer_assignments.findMany({
    where: { organization_id: organizationId },
    orderBy: { assigned_at: 'desc' },
    include: {
      organizations: { select: { id: true, name: true, type: true } },
      training_programs: { select: { id: true, title: true, status: true, type: true } },
      training_cohorts: { select: { id: true, name: true, status: true } },
    },
  });
  const trainerIds = [...new Set(rows.map((r) => r.trainer_user_id))];
  const users = trainerIds.length
    ? await prisma.users.findMany({
        where: { id: { in: trainerIds } },
        select: { id: true, full_name: true, email: true, phone: true, status: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...mapAssignment(r),
    trainer: byId.get(r.trainer_user_id) || null,
  }));
}

module.exports = {
  createTrainerUser,
  assignTrainerToCourse,
  revokeTrainerAssignment,
  listTrainerCourses,
  getTrainerCourse,
  getTrainerDashboard,
  assertTrainerCanAccessProgram,
  listOrganizationTrainerAssignments,
  ensureTrainerRole,
};

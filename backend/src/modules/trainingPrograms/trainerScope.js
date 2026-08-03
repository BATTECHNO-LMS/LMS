'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { normalizeRoleCodes } = require('../../utils/roleCanon');

const TRAINER_PERMISSION_KEYS = Object.freeze([
  'can_manage_sessions',
  'can_manage_attendance',
  'can_manage_materials',
  'can_manage_tasks',
  'can_grade_tasks',
  'can_manage_assessments',
  'can_grade_assessments',
  'can_view_trainees',
  'can_view_progress',
  'can_view_reports',
  'can_finalize_training',
  'can_send_course_announcements',
]);

function requesterHasTrainerRole(requester) {
  const roles = normalizeRoleCodes(requester?.roles || []);
  return roles.includes('trainer') || Boolean(requester?.isGlobal);
}

function mapAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    trainerUserId: row.trainer_user_id,
    organizationId: row.organization_id,
    trainingProgramId: row.training_program_id,
    trainingCohortId: row.training_cohort_id,
    isLeadTrainer: row.is_lead_trainer,
    permissions: {
      canManageSessions: row.can_manage_sessions,
      canManageAttendance: row.can_manage_attendance,
      canManageMaterials: row.can_manage_materials,
      canManageTasks: row.can_manage_tasks,
      canGradeTasks: row.can_grade_tasks,
      canManageAssessments: row.can_manage_assessments,
      canGradeAssessments: row.can_grade_assessments,
      canViewTrainees: row.can_view_trainees,
      canViewProgress: row.can_view_progress,
      canViewReports: row.can_view_reports,
      canFinalizeTraining: row.can_finalize_training,
      canSendCourseAnnouncements: row.can_send_course_announcements,
    },
    isActive: row.is_active,
    assignedAt: row.assigned_at,
    revokedAt: row.revoked_at,
    program: row.training_programs
      ? {
          id: row.training_programs.id,
          title: row.training_programs.title,
          status: row.training_programs.status,
          type: row.training_programs.type,
          organizationId: row.training_programs.organization_id,
          startDate: row.training_programs.start_date,
          endDate: row.training_programs.end_date,
          requiredHours: row.training_programs.required_hours,
          description: row.training_programs.description,
          objectives: row.training_programs.objectives,
          outcomes: row.training_programs.outcomes,
        }
      : null,
    cohort: row.training_cohorts
      ? {
          id: row.training_cohorts.id,
          name: row.training_cohorts.name,
          status: row.training_cohorts.status,
          startDate: row.training_cohorts.start_date,
          endDate: row.training_cohorts.end_date,
        }
      : null,
    organization: row.organizations
      ? { id: row.organizations.id, name: row.organizations.name, type: row.organizations.type }
      : null,
  };
}

async function listActiveTrainerAssignments(trainerUserId) {
  const rows = await prisma.training_trainer_assignments.findMany({
    where: {
      trainer_user_id: trainerUserId,
      is_active: true,
      revoked_at: null,
      organizations: { type: 'INSTITUTION', status: 'active' },
      training_programs: { type: 'TRAINING_COURSE' },
    },
    orderBy: { assigned_at: 'desc' },
    include: {
      organizations: { select: { id: true, name: true, type: true } },
      training_programs: true,
      training_cohorts: true,
    },
  });
  return rows.map(mapAssignment);
}

const assignmentInclude = Object.freeze({
  organizations: { select: { id: true, name: true, type: true } },
  training_programs: true,
  training_cohorts: true,
});

/**
 * All active assignments for a trainer on one program.
 */
async function listTrainerAssignmentsForProgram(trainerUserId, programId) {
  return prisma.training_trainer_assignments.findMany({
    where: {
      trainer_user_id: trainerUserId,
      training_program_id: programId,
      is_active: true,
      revoked_at: null,
      organizations: { type: 'INSTITUTION', status: 'active' },
      training_programs: { type: 'TRAINING_COURSE' },
    },
    include: assignmentInclude,
    orderBy: { assigned_at: 'desc' },
  });
}

/**
 * Merge permission flags with OR across multiple assignment rows (Prisma snake_case).
 */
function mergeAssignmentPermissionFlags(rows) {
  const merged = Object.fromEntries(TRAINER_PERMISSION_KEYS.map((k) => [k, false]));
  let isLead = false;
  for (const row of rows || []) {
    for (const key of TRAINER_PERMISSION_KEYS) {
      if (row[key]) merged[key] = true;
    }
    if (row.is_lead_trainer) isLead = true;
  }
  return { permissions: merged, isLeadTrainer: isLead };
}

/**
 * Resolve assignment covering a program (program-level or any cohort under it).
 * When multiple rows exist, prefers program-level, else cohort match, else first.
 */
async function findTrainerAssignmentForProgram(trainerUserId, programId, cohortId = null) {
  const rows = await listTrainerAssignmentsForProgram(trainerUserId, programId);
  if (!rows.length) return null;

  if (cohortId) {
    const cohortExact = rows.find((r) => r.training_cohort_id === cohortId);
    if (cohortExact) return cohortExact;
    const programLevel = rows.find((r) => r.training_cohort_id == null);
    return programLevel || null;
  }

  return rows.find((r) => r.training_cohort_id == null) || rows[0];
}

/**
 * Cohort IDs the trainer may access for a program.
 * null means program-level access (all cohorts).
 */
function resolveAccessibleCohortIds(assignmentRows) {
  const rows = assignmentRows || [];
  if (!rows.length) return [];
  if (rows.some((r) => r.training_cohort_id == null)) return null;
  return [...new Set(rows.map((r) => r.training_cohort_id).filter(Boolean))];
}

const PERMISSION_CAMEL = Object.freeze({
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
});

function assertTrainerPermission(assignment, permissionKey) {
  if (!assignment) {
    throw new ApiError(403, 'لا تملك تعيينًا نشطًا لهذه الدورة التدريبية.');
  }
  if (!TRAINER_PERMISSION_KEYS.includes(permissionKey)) {
    throw new ApiError(500, 'Invalid trainer permission key');
  }
  const camel = PERMISSION_CAMEL[permissionKey];
  const allowed = Boolean(
    assignment[permissionKey] || (camel && assignment.permissions && assignment.permissions[camel])
  );
  if (!allowed) {
    throw new ApiError(403, 'لا تملك صلاحية تنفيذ هذا الإجراء على الدورة.');
  }
}

/**
 * Express middleware factory: require trainer role + optional program permission.
 * Loads req.trainerAssignment when programId is present in params.
 */
function requireTrainer(options = {}) {
  const permissionKey = options.permission || null;
  return async function trainerAuthMiddleware(req, res, next) {
    try {
      const requester = req.user;
      if (!requester?.userId) {
        throw new ApiError(401, 'Unauthorized');
      }
      if (requester.isGlobal) {
        return next();
      }
      if (!requesterHasTrainerRole(requester)) {
        throw new ApiError(403, 'هذا المسار مخصص لدور المدرب في بوابة المؤسسات.');
      }
      if (requester.organizationType && requester.organizationType !== 'INSTITUTION') {
        throw new ApiError(403, 'يجب تفعيل جهة مؤسسية للدخول كمدرب.');
      }

      const programId = req.params.programId || req.params.trainingProgramId || null;
      const cohortId = req.params.cohortId || req.body?.training_cohort_id || null;

      if (programId) {
        const rows = await listTrainerAssignmentsForProgram(requester.userId, programId);
        let row = null;
        if (cohortId) {
          row =
            rows.find((r) => r.training_cohort_id === cohortId) ||
            rows.find((r) => r.training_cohort_id == null) ||
            null;
        } else {
          row = rows.find((r) => r.training_cohort_id == null) || rows[0] || null;
        }
        if (!row) {
          throw new ApiError(403, 'لا تملك تعيينًا نشطًا لهذه الدورة التدريبية.');
        }
        if (permissionKey) {
          if (cohortId) {
            assertTrainerPermission(row, permissionKey);
          } else {
            const { permissions } = mergeAssignmentPermissionFlags(rows);
            if (!permissions[permissionKey]) {
              throw new ApiError(403, 'لا تملك صلاحية تنفيذ هذا الإجراء على الدورة.');
            }
          }
        }
        const mapped = mapAssignment(row);
        if (!cohortId && rows.length > 1) {
          const { permissions, isLeadTrainer } = mergeAssignmentPermissionFlags(rows);
          mapped.permissions = Object.fromEntries(
            TRAINER_PERMISSION_KEYS.map((k) => [PERMISSION_CAMEL[k], permissions[k]])
          );
          mapped.isLeadTrainer = isLeadTrainer;
        }
        req.trainerAssignment = mapped;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  TRAINER_PERMISSION_KEYS,
  requesterHasTrainerRole,
  mapAssignment,
  listActiveTrainerAssignments,
  listTrainerAssignmentsForProgram,
  mergeAssignmentPermissionFlags,
  resolveAccessibleCohortIds,
  findTrainerAssignmentForProgram,
  assertTrainerPermission,
  requireTrainer,
};

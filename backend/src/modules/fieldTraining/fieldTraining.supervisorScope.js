'use strict';

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const reportAccess = require('./fieldTrainingReport.access');
const evalAccess = require('./fieldTrainingEvaluation.access');
const ftAccess = require('./fieldTraining.access');
const names = require('./fieldTraining.supervisorName');

const SUPERVISOR_FORBIDDEN_MSG = 'غير مصرح بالوصول إلى طلاب مشرف أكاديمي آخر';
const SUPERVISOR_FORBIDDEN_CODE = 'FIELD_TRAINING_SUPERVISOR_FORBIDDEN';

function isAcademicReviewerOnly(user) {
  return reportAccess.isReviewerOnly(user);
}

function shouldScopeToAssignedSupervisor(user) {
  if (!user) return false;
  if (ftAccess.isSystemWideAdmin(user)) return false;
  if (reportAccess.isUniversityAdmin(user)) return false;
  if (evalAccess.isInstructor(user) && !isAcademicReviewerOnly(user)) return false;
  return isAcademicReviewerOnly(user);
}

function applicationSupervisorWhere(user) {
  if (!shouldScopeToAssignedSupervisor(user) || !user?.userId) return {};
  return {
    field_training_academic_supervisor_assignments: {
      is: { supervisor_user_id: user.userId },
    },
  };
}

function evaluationSupervisorWhere(user) {
  if (!shouldScopeToAssignedSupervisor(user) || !user?.userId) return {};
  return {
    field_training_applications: {
      field_training_academic_supervisor_assignments: {
        is: { supervisor_user_id: user.userId },
      },
    },
  };
}

async function loadAssignedApplicationIds(user, { opportunityId, universityId } = {}) {
  if (!shouldScopeToAssignedSupervisor(user) || !user?.userId) return null;
  const where = { supervisor_user_id: user.userId };
  if (opportunityId) where.opportunity_id = opportunityId;
  if (universityId) where.university_id = universityId;
  const rows = await prisma.field_training_academic_supervisor_assignments.findMany({
    where,
    select: { application_id: true },
  });
  return new Set(rows.map((row) => row.application_id));
}

function filterRowsByAssignedApplications(user, rows, assignedIds, idKey = 'application_id') {
  if (!shouldScopeToAssignedSupervisor(user)) return rows || [];
  if (!assignedIds) return [];
  return (rows || []).filter((row) => assignedIds.has(row?.[idKey] || row?.applicationId || row?.id));
}

async function assertReviewerCanAccessApplication(user, application) {
  if (!shouldScopeToAssignedSupervisor(user)) return;
  if (!application?.id) {
    throw new ApiError(403, SUPERVISOR_FORBIDDEN_MSG, null, SUPERVISOR_FORBIDDEN_CODE);
  }
  const assignment = await prisma.field_training_academic_supervisor_assignments.findUnique({
    where: { application_id: application.id },
    select: { supervisor_user_id: true },
  });
  if (!assignment || String(assignment.supervisor_user_id) !== String(user.userId)) {
    throw new ApiError(403, SUPERVISOR_FORBIDDEN_MSG, null, SUPERVISOR_FORBIDDEN_CODE);
  }
}

async function loadAssignmentsByApplicationIds(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.field_training_academic_supervisor_assignments.findMany({
    where: { application_id: { in: ids } },
    select: {
      application_id: true,
      supervisor_user_id: true,
      academic_supervisor_name: true,
    },
  });
  const supervisorIds = [...new Set(rows.map((row) => row.supervisor_user_id).filter(Boolean))];
  const users = supervisorIds.length
    ? await prisma.users.findMany({
        where: { id: { in: supervisorIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((row) => [row.id, row]));
  return new Map(
    rows.map((row) => {
      const supervisor = userById.get(row.supervisor_user_id) || null;
      return [
        row.application_id,
        {
          supervisor_user_id: row.supervisor_user_id,
          supervisor_name:
            names.displaySupervisorName(row.academic_supervisor_name) || supervisor?.full_name || null,
          supervisor_email: supervisor?.email || null,
        },
      ];
    })
  );
}

function attachAssignment(row, assignment) {
  const textName = names.displaySupervisorName(
    row?.academic_supervisor_name || assignment?.supervisor_name
  );
  return {
    ...row,
    academic_supervisor_id: assignment?.supervisor_user_id || null,
    academic_supervisor_name: textName || null,
    academic_supervisor_email: assignment?.supervisor_email || null,
  };
}

module.exports = {
  SUPERVISOR_FORBIDDEN_MSG,
  SUPERVISOR_FORBIDDEN_CODE,
  isAcademicReviewerOnly,
  shouldScopeToAssignedSupervisor,
  applicationSupervisorWhere,
  evaluationSupervisorWhere,
  loadAssignedApplicationIds,
  filterRowsByAssignedApplications,
  assertReviewerCanAccessApplication,
  loadAssignmentsByApplicationIds,
  attachAssignment,
};

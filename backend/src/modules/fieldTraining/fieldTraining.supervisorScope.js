'use strict';

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const reportAccess = require('./fieldTrainingReport.access');
const names = require('./fieldTraining.supervisorName');

const SUPERVISOR_FORBIDDEN_MSG = 'غير مصرح بالوصول إلى طلاب مشرف أكاديمي آخر';
const SUPERVISOR_FORBIDDEN_CODE = 'FIELD_TRAINING_SUPERVISOR_FORBIDDEN';

function isAcademicReviewerOnly(user) {
  return reportAccess.isReviewerOnly(user);
}

function shouldScopeToAssignedSupervisor() {
  return false;
}

function applicationSupervisorWhere() {
  return {};
}

function evaluationSupervisorWhere() {
  return {};
}

async function loadAssignedApplicationIds() {
  return null;
}

function filterRowsByAssignedApplications(_user, rows) {
  return rows || [];
}

async function assertReviewerCanAccessApplication() {
  return;
}

async function loadAssignmentsByApplicationIds(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const apps = await prisma.field_training_applications.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      academic_supervisor_name: true,
      academic_supervisor_normalized: true,
      field_training_academic_supervisor_assignments: {
        select: {
          academic_supervisor_name: true,
          academic_supervisor_normalized: true,
          supervisor_user_id: true,
        },
      },
    },
  });
  return new Map(
    apps.map((app) => {
      const assignment = app.field_training_academic_supervisor_assignments;
      const display =
        names.displaySupervisorName(app.academic_supervisor_name) ||
        names.displaySupervisorName(assignment?.academic_supervisor_name);
      const key =
        app.academic_supervisor_normalized ||
        assignment?.academic_supervisor_normalized ||
        names.normalizeSupervisorKey(display);
      return [
        app.id,
        {
          supervisor_user_id: assignment?.supervisor_user_id || null,
          supervisor_name: display || null,
          supervisor_normalized: key || null,
          supervisor_email: null,
        },
      ];
    })
  );
}

function attachAssignment(row, assignment) {
  const name = assignment?.supervisor_name || row?.academic_supervisor_name || null;
  return {
    ...row,
    academic_supervisor_id: null,
    academic_supervisor_name: name,
    academic_supervisor_normalized: assignment?.supervisor_normalized || row?.academic_supervisor_normalized || names.normalizeSupervisorKey(name) || null,
    academic_supervisor_email: null,
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

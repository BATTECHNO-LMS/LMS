/**
 * Shared external-supervisor scope helpers (no circular service imports).
 * Missing assignment ⇒ NO ACCESS.
 */

const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const { normalizeRoleCodes } = require('../../utils/roleCanon');

function isExternalSupervisorRole(user) {
  const roles = normalizeRoleCodes(user?.roles || []);
  const codes = env.FIELD_TRAINING_EXTERNAL_SUPERVISOR_ROLE_CODES || ['external_supervisor'];
  return roles.some((r) => codes.includes(r));
}

async function listActiveAssignments(supervisorUserId) {
  return prisma.field_training_external_supervisor_assignments.findMany({
    where: { supervisor_user_id: supervisorUserId, is_active: true },
  });
}

async function assertAssignedToApplication(user, applicationId) {
  const assignments = await listActiveAssignments(user.userId);
  if (!assignments.length) {
    throw new ApiError(403, 'لا توجد صلاحيات مشرف جهة تدريب', null, 'EXTERNAL_SUPERVISOR_NO_SCOPE');
  }
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw new ApiError(404, 'Application not found');

  const ok = assignments.some((a) => {
    if (a.application_id && a.application_id === applicationId) return true;
    if (!a.application_id && a.opportunity_id === app.opportunity_id) return true;
    return false;
  });
  if (!ok) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى هذا الطالب', null, 'EXTERNAL_SUPERVISOR_FORBIDDEN');
  }
  return app;
}

async function tryAssertAssignedToApplication(user, applicationId) {
  try {
    return await assertAssignedToApplication(user, applicationId);
  } catch (e) {
    if (e instanceof ApiError && (e.statusCode === 403 || e.statusCode === 404)) return null;
    throw e;
  }
}

module.exports = {
  isExternalSupervisorRole,
  listActiveAssignments,
  assertAssignedToApplication,
  tryAssertAssignedToApplication,
};

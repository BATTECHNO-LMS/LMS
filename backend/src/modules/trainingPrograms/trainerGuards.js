'use strict';

const { isSystemWideAdmin } = require('../../utils/organizationScope');

/**
 * True when the requester is a trainer and not also an org/system admin.
 * Trainer-only callers must pass assignment checks; admins skip them.
 */
function isTrainerOnly(requester) {
  return (
    Boolean(requester?.roles?.includes('trainer')) &&
    !requester?.roles?.includes('admin') &&
    !isSystemWideAdmin(requester)
  );
}

/**
 * No-op for non-trainer-only callers. Trainers must be assigned to the program.
 * @param {object} requester
 * @param {string} programId
 * @param {string | null} [permissionKey]
 */
async function assertTrainerProgramAccess(requester, programId, permissionKey = null) {
  if (!isTrainerOnly(requester)) return null;
  const { assertTrainerCanAccessProgram } = require('./trainerAssignments.service');
  return assertTrainerCanAccessProgram(requester, programId, permissionKey);
}

module.exports = {
  isTrainerOnly,
  assertTrainerProgramAccess,
};

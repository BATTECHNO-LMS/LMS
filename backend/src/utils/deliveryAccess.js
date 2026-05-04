/**
 * Scope rules for cohorts / delivery modules (JWT `req.user`).
 * @param {{ roles?: string[], isGlobal?: boolean, universityId?: string | null, userId?: string }} requester
 */
function normalizeRoles(roles) {
  return (Array.isArray(roles) ? roles : []).map((r) => String(r).toLowerCase());
}

/**
 * Prisma `where` fragment for listing cohorts the requester may see.
 * @returns {object | null} null = no extra filter (global)
 */
function cohortListWhere(requester) {
  if (requester.isGlobal) return null;
  const roles = normalizeRoles(requester.roles);
  const uni = requester.universityId;
  const uniStaff = roles.some((r) =>
    ['program_admin', 'university_admin', 'academic_admin', 'qa_officer', 'university_reviewer'].includes(r)
  );
  if (uni && uniStaff) {
    return { university_id: uni };
  }
  if (roles.includes('instructor')) {
    return { instructor_id: requester.userId };
  }
  if (uni) {
    return { university_id: uni };
  }
  return { AND: [{ id: { in: [] } }] };
}

const { env } = require('../config/env');

/**
 * Cohort catalog browse (student): cohort open for self-service enrollment requests.
 * @param {{ status?: string }} cohort
 */
function canStudentBrowseCohort(cohort) {
  return cohort?.status === 'open_for_enrollment';
}

/**
 * Active program access for delivery content (sessions, assessments): enrolled or completed only.
 * @param {{ enrollment_status?: string }} enrollmentRow
 */
function studentHasActiveProgramEnrollment(enrollmentRow) {
  const s = enrollmentRow?.enrollment_status;
  return s === 'enrolled' || s === 'completed';
}

function isStudentRole(requester) {
  const roles = normalizeRoles(requester.roles);
  return roles.includes(String(env.STUDENT_ROLE_CODE || 'student').toLowerCase());
}

/**
 * @param {{ roles?: string[], isGlobal?: boolean, universityId?: string | null, userId?: string }} requester
 * @param {{ university_id: string, instructor_id: string | null }} cohort
 */
function canAccessCohort(requester, cohort) {
  if (!cohort) return false;
  if (requester.isGlobal) return true;
  const roles = normalizeRoles(requester.roles);
  const uni = requester.universityId;
  const uniStaff = roles.some((r) =>
    ['program_admin', 'university_admin', 'academic_admin', 'qa_officer', 'university_reviewer'].includes(r)
  );
  if (uni && uniStaff && cohort.university_id === uni) return true;
  if (roles.includes('instructor') && cohort.instructor_id === requester.userId) return true;
  return false;
}

/**
 * Prisma `where` fragment for `assessments` via nested `cohorts` (same rules as cohort list).
 * @returns {object}
 */
function assessmentCohortScopeWhere(requester) {
  const cw = cohortListWhere(requester);
  if (cw === null) return {};
  return { cohorts: cw };
}

module.exports = {
  normalizeRoles,
  cohortListWhere,
  canAccessCohort,
  assessmentCohortScopeWhere,
  canStudentBrowseCohort,
  studentHasActiveProgramEnrollment,
  isStudentRole,
};

/**
 * Application roles — aligned with RBAC.
 * program_admin is permanently deprecated (Phase 3): historical display only.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROGRAM_ADMIN: 'program_admin',
  UNIVERSITY_ADMIN: 'university_admin',
  ACADEMIC_ADMIN: 'academic_admin',
  QA_OFFICER: 'qa_officer',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
  UNIVERSITY_REVIEWER: 'university_reviewer',
};

/** Canonical codes that still exist historically but grant no runtime access. */
export const LEGACY_DEPRECATED_ROLE_CODES = [ROLES.PROGRAM_ADMIN];

/**
 * Roles offered in active user-management assignment UIs (create / change role).
 */
export const ASSIGNABLE_USER_ROLE_CODES = [
  ROLES.INSTRUCTOR,
  ROLES.STUDENT,
  ROLES.QA_OFFICER,
  ROLES.ACADEMIC_ADMIN,
];

/**
 * Active admin dashboard shell roles (excludes deprecated program_admin).
 */
export const ADMIN_ROLE_SET = [
  ROLES.SUPER_ADMIN,
  ROLES.UNIVERSITY_ADMIN,
  ROLES.ACADEMIC_ADMIN,
  ROLES.QA_OFFICER,
];

/** Roles that may appear in historical filters / labels (includes deprecated). */
export const HISTORICAL_DISPLAY_ROLE_CODES = [
  ...ADMIN_ROLE_SET,
  ROLES.PROGRAM_ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.STUDENT,
  ROLES.UNIVERSITY_REVIEWER,
];

export function isLegacyDeprecatedRole(role) {
  return LEGACY_DEPRECATED_ROLE_CODES.includes(role);
}

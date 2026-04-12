/**
 * Application roles — aligned with future RBAC.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROGRAM_ADMIN: 'program_admin',
  ACADEMIC_ADMIN: 'academic_admin',
  QA_OFFICER: 'qa_officer',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
  UNIVERSITY_REVIEWER: 'university_reviewer',
};

/** Roles that use the admin dashboard shell */
export const ADMIN_ROLE_SET = [
  ROLES.SUPER_ADMIN,
  ROLES.PROGRAM_ADMIN,
  ROLES.ACADEMIC_ADMIN,
  ROLES.QA_OFFICER,
];


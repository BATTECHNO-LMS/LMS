/**
 * Application roles — canonical model.
 * University: instructor, student
 * Institution: trainer, trainee
 * Shared: super_admin, admin, reviewer
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  TRAINER: 'trainer',
  TRAINEE: 'trainee',
  STUDENT: 'student',
  REVIEWER: 'reviewer',
};

/** @deprecated kept for migrate/alias only — not assignable or shown in UI */
export const LEGACY_ROLE_ALIASES = {
  program_admin: ROLES.ADMIN,
  university_admin: ROLES.ADMIN,
  academic_admin: ROLES.ADMIN,
  qa_officer: ROLES.ADMIN,
  university_reviewer: ROLES.REVIEWER,
  academic_reviewer: ROLES.REVIEWER,
};

export const CANONICAL_ROLE_CODES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.TRAINER,
  ROLES.TRAINEE,
  ROLES.STUDENT,
  ROLES.REVIEWER,
];

export const LEGACY_DEPRECATED_ROLE_CODES = Object.keys(LEGACY_ROLE_ALIASES);

/**
 * Roles offered in university user-management assignment UIs.
 */
export const ASSIGNABLE_USER_ROLE_CODES = [
  ROLES.STUDENT,
  ROLES.INSTRUCTOR,
  ROLES.ADMIN,
  ROLES.REVIEWER,
];

/** Institution admin assignable roles (no university instructor/student). */
export const INSTITUTION_ASSIGNABLE_ROLE_CODES = [
  ROLES.TRAINEE,
  ROLES.TRAINER,
  ROLES.ADMIN,
  ROLES.REVIEWER,
];

/** Roles that require primary_university_id on create/update. */
export const UNIVERSITY_REQUIRED_ROLE_CODES = [
  ROLES.STUDENT,
  ROLES.INSTRUCTOR,
  ROLES.ADMIN,
  ROLES.REVIEWER,
];

export const ADMIN_ROLE_SET = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export function canonicalizeRoleCode(role) {
  const code = String(role || '')
    .trim()
    .toLowerCase();
  if (!code) return '';
  return LEGACY_ROLE_ALIASES[code] || code;
}

export function normalizeRoleCodes(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const code = canonicalizeRoleCode(r);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function isLegacyDeprecatedRole(role) {
  return LEGACY_DEPRECATED_ROLE_CODES.includes(String(role || '').toLowerCase());
}

export function roleRequiresUniversity(role) {
  return UNIVERSITY_REQUIRED_ROLE_CODES.includes(canonicalizeRoleCode(role));
}

export function roleRequiresUniversitySpecialty(role) {
  return canonicalizeRoleCode(role) === ROLES.STUDENT;
}

'use strict';

/**
 * Canonical LMS roles (single source of truth for runtime AuthZ).
 * Legacy role codes are mapped here and remapped in DB by migrate-roles script.
 */

const CANONICAL_ROLE_CODES = Object.freeze([
  'super_admin',
  'admin',
  'instructor',
  'student',
  'academic_reviewer',
]);

const CANONICAL_ROLE_SET = new Set(CANONICAL_ROLE_CODES);

/** Legacy → canonical. Never maps anyone to super_admin. */
const LEGACY_ROLE_ALIASES = Object.freeze({
  program_admin: 'admin',
  university_admin: 'admin',
  academic_admin: 'admin',
  qa_officer: 'admin',
  university_reviewer: 'academic_reviewer',
});

/** Catalog rows retained for history / audits; not assignable. */
const LEGACY_CATALOG_ROLE_CODES = Object.freeze([
  'program_admin',
  'university_admin',
  'academic_admin',
  'qa_officer',
  'university_reviewer',
]);

const LEGACY_CATALOG_SET = new Set(LEGACY_CATALOG_ROLE_CODES);

const ROLE_META = Object.freeze({
  super_admin: {
    name: 'Super Admin',
    name_ar: 'سوبر أدمن',
    scope: 'global',
    assignable: false,
  },
  admin: {
    name: 'Admin',
    name_ar: 'أدمن',
    scope: 'university',
    assignable: true,
  },
  instructor: {
    name: 'Instructor',
    name_ar: 'مدرس',
    scope: 'university',
    assignable: true,
  },
  student: {
    name: 'Student',
    name_ar: 'طالب',
    scope: 'university',
    assignable: true,
  },
  academic_reviewer: {
    name: 'Academic Reviewer',
    name_ar: 'مراجع أكاديمي',
    scope: 'university',
    assignable: true,
  },
});

/**
 * @param {unknown} code
 * @returns {string}
 */
function canonicalizeRoleCode(code) {
  const raw = String(code || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (LEGACY_ROLE_ALIASES[raw]) return LEGACY_ROLE_ALIASES[raw];
  return raw;
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeRoleCodes(codes) {
  const list = Array.isArray(codes) ? codes : codes == null ? [] : [codes];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const code = canonicalizeRoleCode(item);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/**
 * @param {unknown} code
 */
function isCanonicalRoleCode(code) {
  return CANONICAL_ROLE_SET.has(canonicalizeRoleCode(code));
}

/**
 * @param {unknown} code
 */
function isLegacyCatalogRoleCode(code) {
  return LEGACY_CATALOG_SET.has(String(code || '').trim().toLowerCase());
}

/**
 * Roles offered in user create/edit (super_admin UI-gated separately).
 */
const ASSIGNABLE_ROLE_CODES = Object.freeze(
  CANONICAL_ROLE_CODES.filter((c) => c !== 'super_admin')
);

/**
 * Roles that typically require primary_university_id (unless actor isGlobal admin with null).
 */
const UNIVERSITY_SCOPED_ROLE_CODES = Object.freeze([
  'admin',
  'instructor',
  'student',
  'academic_reviewer',
]);

/**
 * Pick primary UI role from normalized codes.
 * @param {string[]} roles
 */
function pickPrimaryRoleCode(roles) {
  const normalized = normalizeRoleCodes(roles);
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('academic_reviewer')) return 'academic_reviewer';
  if (normalized.includes('instructor')) return 'instructor';
  if (normalized.includes('student')) return 'student';
  return normalized[0] || null;
}

/**
 * @param {Array<{ code: string }>} roleRecords
 */
function normalizeRoleRecords(roleRecords) {
  const byCanonical = new Map();
  for (const row of roleRecords || []) {
    const code = canonicalizeRoleCode(row.code);
    if (!code) continue;
    if (!byCanonical.has(code)) {
      byCanonical.set(code, { ...row, code });
    }
  }
  return [...byCanonical.values()];
}

module.exports = {
  CANONICAL_ROLE_CODES,
  CANONICAL_ROLE_SET,
  LEGACY_ROLE_ALIASES,
  LEGACY_CATALOG_ROLE_CODES,
  ROLE_META,
  ASSIGNABLE_ROLE_CODES,
  UNIVERSITY_SCOPED_ROLE_CODES,
  canonicalizeRoleCode,
  normalizeRoleCodes,
  isCanonicalRoleCode,
  isLegacyCatalogRoleCode,
  pickPrimaryRoleCode,
  normalizeRoleRecords,
};

/**
 * Dev/staging test accounts catalog — BATUNI University + role test users.
 * Protected from demo cleanup via test_accounts=true marker.
 *
 * Roles match the canonical five-role model (see roleCanon / baselineCatalog).
 */

const TEST_ACCOUNTS_MARKER = 'test_accounts=true';

const BATUNI_TEST_UNIVERSITY = {
  name: 'جامعة باتيوني',
  nameEn: 'BATUNI University',
  domain: 'batuni.edu',
  website: 'https://batuni.edu',
  city: 'Amman',
  country: 'Jordan',
  contact_email: 'admin@batuni.edu',
};

/** Dev/staging only — never document in production README. */
const TEST_PASSWORD = '12345678';

const TEST_ACCOUNT_USERS = [
  { email: 'superadmin@batuni.edu', full_name: 'BATUNI Super Admin', role: 'super_admin' },
  { email: 'admin@batuni.edu', full_name: 'BATUNI Admin', role: 'admin' },
  // Legacy email kept for local/staging habit; same canonical role as admin@.
  { email: 'university.admin@batuni.edu', full_name: 'BATUNI University Admin', role: 'admin' },
  { email: 'instructor@batuni.edu', full_name: 'BATUNI Instructor', role: 'instructor' },
  { email: 'student@batuni.edu', full_name: 'BATUNI Student', role: 'student', specialtyCode: 'CYB' },
  { email: 'reviewer@batuni.edu', full_name: 'BATUNI Academic Reviewer', role: 'academic_reviewer' },
];

function buildTestUniversityNotes({ nameEn, city, country, website }) {
  return `${TEST_ACCOUNTS_MARKER} | en: ${nameEn} | city: ${city} | country: ${country} | website: ${website}`;
}

function relationshipTypeForRole(roleCode) {
  if (roleCode === 'student') return 'student';
  if (roleCode === 'instructor') return 'instructor';
  if (roleCode === 'academic_reviewer') return 'reviewer';
  if (roleCode === 'admin') return 'admin';
  return 'staff';
}

module.exports = {
  TEST_ACCOUNTS_MARKER,
  BATUNI_TEST_UNIVERSITY,
  TEST_PASSWORD,
  TEST_ACCOUNT_USERS,
  buildTestUniversityNotes,
  relationshipTypeForRole,
};

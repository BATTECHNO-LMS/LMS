'use strict';

const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STUDENT_NUMBER_UNRESOLVED_CODE = 'STUDENT_NUMBER_UNRESOLVED';

function isUuidLike(value) {
  return UUID_RE.test(String(value || '').trim());
}

/**
 * Mutah-style university numbers are 6–12 digits (optional spaces/hyphens).
 * Rejects UUIDs, emails, and arbitrary text local-parts.
 */
function isValidStudentNumberFormat(value) {
  const text = String(value || '').trim();
  if (!text || isUuidLike(text)) return false;
  const digits = text.replace(/[\s-]/g, '');
  return /^\d{6,12}$/.test(digits);
}

function normalizeStudentNumber(value) {
  if (!isValidStudentNumberFormat(value)) return '';
  return String(value).trim().replace(/[\s-]/g, '');
}

function isVerifiedUniversityEmail(student = {}) {
  return Boolean(student.email_verified_at || student.emailVerifiedAt);
}

function extractValidNumberFromVerifiedEmail(student = {}) {
  if (!isVerifiedUniversityEmail(student)) return '';
  return normalizeStudentNumber(extractUniversityNumberFromEmail(student.email));
}

/**
 * Official university number:
 * 1. users.university_student_number when it is a valid student-number format
 * 2. local-part of the verified university email, only if that local-part is a valid number
 *
 * Never returns a UUID, database id, "NA", or a random value.
 */
function resolveOfficialUniversityNumber(student = {}) {
  const storedRaw =
    student.university_student_number ||
    student.universityStudentNumber ||
    student.studentNumber ||
    student.student_number ||
    '';
  const stored = normalizeStudentNumber(storedRaw);
  const studentId = String(student.id || student.userId || '').trim().toLowerCase();
  if (stored && stored.toLowerCase() !== studentId && !isUuidLike(stored)) {
    return { number: stored, source: 'profile', persist: false };
  }

  const fromEmail = extractValidNumberFromVerifiedEmail(student);
  if (fromEmail && fromEmail.toLowerCase() !== studentId) {
    return { number: fromEmail, source: 'email', persist: true };
  }

  return { number: '', source: 'missing', persist: false };
}

module.exports = {
  STUDENT_NUMBER_UNRESOLVED_CODE,
  isUuidLike,
  isValidStudentNumberFormat,
  normalizeStudentNumber,
  isVerifiedUniversityEmail,
  extractValidNumberFromVerifiedEmail,
  resolveOfficialUniversityNumber,
};

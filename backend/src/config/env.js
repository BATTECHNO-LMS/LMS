const path = require('path');

// Resolve backend/.env regardless of process cwd (e.g. monorepo root).
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
});

function parseRoleCodes(csv) {
  if (!csv || typeof csv !== 'string') return [];
  return [...new Set(csv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  API_VERSION: process.env.API_VERSION || 'v1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  /** DB `roles.code` for student registration (must exist in `roles` table). */
  STUDENT_ROLE_CODE: process.env.STUDENT_ROLE_CODE || 'student',
  /** Role code that grants global admin scope in JWT (`isGlobal`). */
  SUPER_ADMIN_ROLE_CODE: process.env.SUPER_ADMIN_ROLE_CODE || 'super_admin',
  /** Comma-separated `roles.code` values allowed to list/read users and universities. */
  ADMIN_READ_ROLE_CODES: parseRoleCodes(
    process.env.ADMIN_READ_ROLE_CODES || 'super_admin,program_admin,university_admin'
  ),
  /** Comma-separated `roles.code` values allowed to create/update users (extend via env). */
  USER_WRITE_ROLE_CODES: parseRoleCodes(process.env.USER_WRITE_ROLE_CODES || 'super_admin,program_admin'),
  /** Comma-separated `roles.code` values allowed to create/update universities. */
  UNIVERSITY_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.UNIVERSITY_WRITE_ROLE_CODES || 'super_admin,program_admin'
  ),
  /** Tracks, micro-credentials, nested learning-outcome lists (read). */
  CURRICULUM_READ_ROLE_CODES: parseRoleCodes(
    process.env.CURRICULUM_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer'
  ),
  /** Tracks, micro-credentials, learning outcomes (write). */
  CURRICULUM_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.CURRICULUM_WRITE_ROLE_CODES || 'super_admin,program_admin,academic_admin'
  ),
  /** Cohorts, enrollments, sessions, attendance (read). */
  DELIVERY_READ_ROLE_CODES: parseRoleCodes(
    process.env.DELIVERY_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor'
  ),
  /** Cohorts, enrollments, sessions, attendance (write). */
  DELIVERY_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.DELIVERY_WRITE_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,instructor'
  ),
  /** Assessments, rubrics, submissions list/read (includes students for enrolled cohorts). */
  ACADEMIC_READ_ROLE_CODES: parseRoleCodes(
    process.env.ACADEMIC_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor,student'
  ),
  /** Create/update assessments, rubrics, grade others, review submissions. */
  ACADEMIC_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.ACADEMIC_WRITE_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,instructor'
  ),
  /** Evidence list/read (staff + instructor). */
  EVIDENCE_READ_ROLE_CODES: parseRoleCodes(
    process.env.EVIDENCE_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor'
  ),
  /** Evidence create/update. */
  EVIDENCE_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.EVIDENCE_WRITE_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,instructor'
  ),
  /** QA reviews + corrective actions (no student). */
  QA_OVERSIGHT_ROLE_CODES: parseRoleCodes(
    process.env.QA_OVERSIGHT_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer'
  ),
  /** Risk + integrity cases (includes instructor). */
  RISK_INTEGRITY_ROLE_CODES: parseRoleCodes(
    process.env.RISK_INTEGRITY_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor'
  ),
  /** Recognition requests + documents (read). */
  RECOGNITION_READ_ROLE_CODES: parseRoleCodes(
    process.env.RECOGNITION_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,university_reviewer'
  ),
  /** Recognition requests create/update/status. */
  RECOGNITION_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.RECOGNITION_WRITE_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin'
  ),
  /** Issue certificates and change status (staff). */
  CERTIFICATE_WRITE_ROLE_CODES: parseRoleCodes(
    process.env.CERTIFICATE_WRITE_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin'
  ),
  /** List/view certificates (staff + student for self-scoped list). */
  CERTIFICATE_READ_ROLE_CODES: parseRoleCodes(
    process.env.CERTIFICATE_READ_ROLE_CODES ||
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor,student,university_reviewer'
  ),
  /** Audit log read (restricted). */
  AUDIT_LOG_READ_ROLE_CODES: parseRoleCodes(
    process.env.AUDIT_LOG_READ_ROLE_CODES || 'super_admin,program_admin,university_admin,academic_admin'
  ),
};

module.exports = { env };

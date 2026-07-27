const path = require('path');
const { filterDeprecatedFromRoleAllowlist } = require('../utils/runtimeRoles');

// Resolve backend/.env regardless of process cwd (e.g. monorepo root).
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
});

function parseRoleCodes(csv) {
  if (!csv || typeof csv !== 'string') return [];
  return [...new Set(csv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Parse env CSV (or defaults), then strip deprecated runtime roles such as program_admin.
 * Env can still list the deprecated code; it is ignored with a one-time safe warning.
 */
function parseRoleCodesWithFallback(envValue, defaultCsv, allowlistKey = 'ROLE_CODES') {
  const parsed = parseRoleCodes(typeof envValue === 'string' ? envValue : '');
  const source = parsed.length ? parsed : parseRoleCodes(defaultCsv);
  return filterDeprecatedFromRoleAllowlist(source, allowlistKey);
}

function parseCorsOrigins(csv) {
  if (!csv || typeof csv !== 'string') return [];
  return [...new Set(csv.split(',').map((s) => s.trim()).filter(Boolean))];
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  API_VERSION: process.env.API_VERSION || 'v1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  /** Minimum length for JWT_SECRET when NODE_ENV=production */
  JWT_SECRET_MIN_LENGTH: Number(process.env.JWT_SECRET_MIN_LENGTH) || 32,
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  /** Public API base (no trailing slash), e.g. https://api.example.com — used for absolute file URLs */
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  /** local | r2 | s3 — object storage backend */
  STORAGE_BACKEND: (process.env.STORAGE_BACKEND || 'local').trim().toLowerCase(),
  /** When STORAGE_BACKEND=s3, public bucket/CDN origin for keys */
  S3_PUBLIC_BASE_URL: (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  /** Cloudflare R2 (S3-compatible) */
  R2_ACCOUNT_ID: (process.env.R2_ACCOUNT_ID || '').trim(),
  R2_ACCESS_KEY_ID: (process.env.R2_ACCESS_KEY_ID || '').trim(),
  R2_SECRET_ACCESS_KEY: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  R2_BUCKET_NAME: (process.env.R2_BUCKET_NAME || 'lms-uploads').trim(),
  R2_ENDPOINT: (process.env.R2_ENDPOINT || '').trim(),
  R2_REGION: (process.env.R2_REGION || 'auto').trim(),
  /** Optional public CDN origin for public R2 objects */
  R2_PUBLIC_BASE_URL: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  /** Comma-separated browser origins allowed for CORS (required in production) */
  CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGINS || ''),
  /** YouTube Data API v3 key — enables fetching unlisted playlists (public RSS is not enough). */
  YOUTUBE_API_KEY: (process.env.YOUTUBE_API_KEY || '').trim(),
  /** Set true when behind a reverse proxy (for rate limiting / secure cookies) */
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  /** SPA dashboards issue many GETs; 300/15m is too low with attendance polling. */
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 1200,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 40,
  /** Soft cap for GET attendance-window/active (excluded from main apiLimiter). */
  ATTENDANCE_POLL_RATE_LIMIT_MAX: Number(process.env.ATTENDANCE_POLL_RATE_LIMIT_MAX) || 240,
  /** DB `roles.code` for student registration (must exist in `roles` table). */
  STUDENT_ROLE_CODE: process.env.STUDENT_ROLE_CODE || 'student',
  /** Role code that grants global admin scope in JWT (`isGlobal`). */
  SUPER_ADMIN_ROLE_CODE: process.env.SUPER_ADMIN_ROLE_CODE || 'super_admin',
  /** Comma-separated `roles.code` values allowed to list/read users and universities. */
  ADMIN_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.ADMIN_READ_ROLE_CODES,
    'super_admin,admin',
    'ADMIN_READ_ROLE_CODES'
  ),
  /** Comma-separated `roles.code` values allowed to create/update users (extend via env). */
  USER_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.USER_WRITE_ROLE_CODES,
    'super_admin',
    'USER_WRITE_ROLE_CODES'
  ),
  /** Roles allowed to activate pending self-registered students (`PATCH /users/:id/activate`). */
  USER_ACTIVATE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.USER_ACTIVATE_ROLE_CODES,
    'super_admin,admin',
    'USER_ACTIVATE_ROLE_CODES'
  ),
  /** Comma-separated `roles.code` values allowed to create/update universities. */
  UNIVERSITY_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.UNIVERSITY_WRITE_ROLE_CODES,
    'super_admin',
    'UNIVERSITY_WRITE_ROLE_CODES'
  ),
  /** Tracks, micro-credentials, nested learning-outcome lists (read). */
  CURRICULUM_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.CURRICULUM_READ_ROLE_CODES,
    'super_admin,admin,instructor',
    'CURRICULUM_READ_ROLE_CODES'
  ),
  /** Tracks, micro-credentials, learning outcomes (write). */
  CURRICULUM_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.CURRICULUM_WRITE_ROLE_CODES,
    'super_admin,admin',
    'CURRICULUM_WRITE_ROLE_CODES'
  ),
  /** Cohorts, enrollments, sessions, attendance (read). */
  DELIVERY_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.DELIVERY_READ_ROLE_CODES,
    'super_admin,admin,instructor',
    'DELIVERY_READ_ROLE_CODES'
  ),
  /** Cohorts, enrollments, sessions, attendance (write). */
  DELIVERY_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.DELIVERY_WRITE_ROLE_CODES,
    'super_admin,admin,instructor',
    'DELIVERY_WRITE_ROLE_CODES'
  ),
  /** Assessments, rubrics, submissions list/read (includes students for enrolled cohorts). */
  ACADEMIC_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.ACADEMIC_READ_ROLE_CODES,
    'super_admin,admin,instructor,student',
    'ACADEMIC_READ_ROLE_CODES'
  ),
  /** Create/update assessments, rubrics, grade others, review submissions. */
  ACADEMIC_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.ACADEMIC_WRITE_ROLE_CODES,
    'super_admin,admin,instructor',
    'ACADEMIC_WRITE_ROLE_CODES'
  ),
  /** Evidence list/read (staff + instructor + university reviewer portal). */
  EVIDENCE_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.EVIDENCE_READ_ROLE_CODES,
    'super_admin,admin,instructor,reviewer',
    'EVIDENCE_READ_ROLE_CODES'
  ),
  /** Evidence create/update. */
  EVIDENCE_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.EVIDENCE_WRITE_ROLE_CODES,
    'super_admin,admin,instructor',
    'EVIDENCE_WRITE_ROLE_CODES'
  ),
  /** QA reviews + corrective actions (no student). */
  QA_OVERSIGHT_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.QA_OVERSIGHT_ROLE_CODES,
    'super_admin,admin',
    'QA_OVERSIGHT_ROLE_CODES'
  ),
  /** Risk + integrity cases (includes instructor). */
  RISK_INTEGRITY_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.RISK_INTEGRITY_ROLE_CODES,
    'super_admin,admin,instructor',
    'RISK_INTEGRITY_ROLE_CODES'
  ),
  /** Recognition requests + documents (read). */
  RECOGNITION_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.RECOGNITION_READ_ROLE_CODES,
    'super_admin,admin,reviewer',
    'RECOGNITION_READ_ROLE_CODES'
  ),
  /** Recognition requests create/update/status. */
  RECOGNITION_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.RECOGNITION_WRITE_ROLE_CODES,
    'super_admin,admin',
    'RECOGNITION_WRITE_ROLE_CODES'
  ),
  /** Issue certificates and change status (staff). */
  CERTIFICATE_WRITE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.CERTIFICATE_WRITE_ROLE_CODES,
    'super_admin,admin',
    'CERTIFICATE_WRITE_ROLE_CODES'
  ),
  /** List/view certificates (staff + student for self-scoped list). */
  CERTIFICATE_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.CERTIFICATE_READ_ROLE_CODES,
    'super_admin,admin,instructor,student,reviewer',
    'CERTIFICATE_READ_ROLE_CODES'
  ),
  /** Audit log read (restricted). */
  AUDIT_LOG_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.AUDIT_LOG_READ_ROLE_CODES,
    'super_admin,admin',
    'AUDIT_LOG_READ_ROLE_CODES'
  ),
  /** Reports read/export access. */
  REPORT_READ_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.REPORT_READ_ROLE_CODES,
    'super_admin,admin,reviewer',
    'REPORT_READ_ROLE_CODES'
  ),
  /** Approve/reject student enrollment requests (pending → enrolled/rejected). */
  ENROLLMENT_DECISION_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.ENROLLMENT_DECISION_ROLE_CODES,
    'super_admin,admin',
    'ENROLLMENT_DECISION_ROLE_CODES'
  ),
  /**
   * Field training admin portal (`/admin/field-training/*`).
   * Instructors use `/instructor/field-training`; reviewers use `/academic/field-training`.
   */
  FIELD_TRAINING_ADMIN_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.FIELD_TRAINING_ADMIN_ROLE_CODES,
    'super_admin,admin',
    'FIELD_TRAINING_ADMIN_ROLE_CODES'
  ),
  /** Field training instructor portal (assigned opportunities only). */
  FIELD_TRAINING_INSTRUCTOR_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.FIELD_TRAINING_INSTRUCTOR_ROLE_CODES,
    'instructor',
    'FIELD_TRAINING_INSTRUCTOR_ROLE_CODES'
  ),
  /**
   * Staff roles for admin FT manage APIs (same portal as ADMIN; no instructor/reviewer).
   * Assigned-instructor checks live in fieldTraining.access / instructor routes.
   */
  FIELD_TRAINING_MANAGE_ROLE_CODES: parseRoleCodesWithFallback(
    process.env.FIELD_TRAINING_MANAGE_ROLE_CODES,
    'super_admin,admin',
    'FIELD_TRAINING_MANAGE_ROLE_CODES'
  ),
  /** AI provider (openai | gemini). Empty = disabled. */
  AI_PROVIDER: (process.env.AI_PROVIDER || '').trim().toLowerCase(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || '').trim(),
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  AI_MODEL: (process.env.AI_MODEL || '').trim(),
  AI_RATE_LIMIT_MAX: Number(process.env.AI_RATE_LIMIT_MAX) || 20,
  AI_RATE_LIMIT_WINDOW_MS: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  FILE_UPLOAD_RATE_LIMIT_MAX: Number(process.env.FILE_UPLOAD_RATE_LIMIT_MAX) || 30,
  FILE_UPLOAD_RATE_LIMIT_WINDOW_MS:
    Number(process.env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  FIELD_TRAINING_AI_RATE_LIMIT_MAX: Number(process.env.FIELD_TRAINING_AI_RATE_LIMIT_MAX) || 10,
  FIELD_TRAINING_AI_RATE_LIMIT_WINDOW_MS:
    Number(process.env.FIELD_TRAINING_AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  /** Resend API key for transactional email (set in .env only — never commit). */
  RESEND_API_KEY: (process.env.RESEND_API_KEY || '').trim(),
  RESEND_FROM_EMAIL: (process.env.RESEND_FROM_EMAIL || 'no-reply@lms.battechno.com').trim(),
  EMAIL_OTP_EXPIRY_MINUTES: Number(process.env.EMAIL_OTP_EXPIRY_MINUTES) || 10,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS: Number(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS) || 60,
  EMAIL_OTP_MAX_ATTEMPTS: Number(process.env.EMAIL_OTP_MAX_ATTEMPTS) || 5,
  PASSWORD_RESET_OTP_EXPIRY_MINUTES: Number(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES) || 10,
  PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS:
    Number(process.env.PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS) || 60,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS: Number(process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) || 5,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES:
    Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES) || 10,
};

module.exports = { env, parseRoleCodes, parseRoleCodesWithFallback };

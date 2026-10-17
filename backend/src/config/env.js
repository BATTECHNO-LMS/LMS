const path = require('path');
const { filterDeprecatedFromRoleAllowlist } = require('../utils/runtimeRoles');
const { resolveTrustProxyConfig, buildTrustProxyFn } = require('./trustProxy');

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

function parseBoundedInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

/**
 * Express `trust proxy` value: a hop-capped, subnet-restricted function (see config/trustProxy).
 * Never a blanket `true` (that would trust a client-forged X-Forwarded-For).
 */
function parseTrustProxySetting(raw, extra = {}) {
  return buildTrustProxyFn(resolveTrustProxyConfig({ ...extra, TRUST_PROXY: raw }));
}

function parseAuthContextCacheTtlMs(raw) {
  if (raw === '0' || raw === 0) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 15_000;
  return n;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  API_VERSION: process.env.API_VERSION || 'v1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  /** Prisma client pool size (long-running Node). Default beats num_cpus*2+1 in Docker. */
  PRISMA_CONNECTION_LIMIT: Number(process.env.PRISMA_CONNECTION_LIMIT) || 25,
  /** Seconds to wait for a free Prisma connection before P2024. */
  PRISMA_POOL_TIMEOUT: Number(process.env.PRISMA_POOL_TIMEOUT) || 20,
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  /** Optional `iss` / `aud` claims; when set, tokens without the matching claim are rejected. */
  JWT_ISSUER: String(process.env.JWT_ISSUER || '').trim(),
  JWT_AUDIENCE: String(process.env.JWT_AUDIENCE || '').trim(),
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
  /** YouTube Data API v3 key — backend-only; never expose to browsers or logs. */
  YOUTUBE_API_KEY: (process.env.YOUTUBE_API_KEY || '').trim(),
  /** Safety cap for Field Training playlist import. Exceeding this errors (no silent truncate). */
  YOUTUBE_PLAYLIST_MAX_ITEMS: (() => {
    const n = Number(process.env.YOUTUBE_PLAYLIST_MAX_ITEMS);
    if (!Number.isFinite(n) || n <= 0) return 400;
    return Math.min(Math.max(Math.floor(n), 50), 2000);
  })(),
  YOUTUBE_API_TIMEOUT_MS: Number(process.env.YOUTUBE_API_TIMEOUT_MS) || 15_000,
  /** Unique-watched % at which a recorded lecture is marked complete. Not a scoring rule. */
  RECORDED_LECTURE_COMPLETION_PERCENT: (() => {
    const n = Number(process.env.RECORDED_LECTURE_COMPLETION_PERCENT);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return 90;
    return n;
  })(),
  /** Set true when behind a reverse proxy (for rate limiting / secure cookies) */
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  /** Resolved trusted-proxy topology ({ subnets, hops }); see config/trustProxy. */
  TRUST_PROXY_CONFIG: resolveTrustProxyConfig(process.env),
  /** Resolved Express `trust proxy` function (see parseTrustProxySetting). */
  TRUST_PROXY_SETTING: buildTrustProxyFn(resolveTrustProxyConfig(process.env)),
  /**
   * Accept X-Request-Id from the immediate peer only when it is a trusted proxy AND this is
   * true (host nginx must overwrite the header with `$request_id`). Otherwise always generate.
   */
  TRUST_UPSTREAM_REQUEST_ID:
    process.env.TRUST_UPSTREAM_REQUEST_ID === 'true' || process.env.TRUST_UPSTREAM_REQUEST_ID === '1',
  /** Kill switch for the per-client general API limiter (default on). */
  API_RATE_LIMIT_ENABLED: !['false', '0'].includes(String(process.env.API_RATE_LIMIT_ENABLED || '').trim()),
  /** Server-side session idle timeout (minutes without real user activity). */
  AUTH_IDLE_TIMEOUT_MINUTES: parseBoundedInt(process.env.AUTH_IDLE_TIMEOUT_MINUTES, 30, 1, 24 * 60),
  /** Frontend shows the "session about to end" warning this many minutes before idle expiry. */
  AUTH_IDLE_WARNING_MINUTES: parseBoundedInt(process.env.AUTH_IDLE_WARNING_MINUTES, 5, 1, 60),
  /** Hard cap on a session's lifetime regardless of activity (hours). JWT exp matches it. */
  AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS: parseBoundedInt(
    process.env.AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS,
    12,
    1,
    24 * 30
  ),
  /** In-process session validation cache TTL (ms). Revocation in the same process is immediate. */
  AUTH_SESSION_CACHE_TTL_MS: parseBoundedInt(process.env.AUTH_SESSION_CACHE_TTL_MS, 10_000, 0, 60_000),
  /** Minimum seconds between `last_activity_at` writes for one session. */
  AUTH_SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS: parseBoundedInt(
    process.env.AUTH_SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS,
    30,
    0,
    300
  ),
  /** Minimum seconds between `last_seen_at` (presence) writes for one session. */
  AUTH_SESSION_PRESENCE_WRITE_THROTTLE_SECONDS: parseBoundedInt(
    process.env.AUTH_SESSION_PRESENCE_WRITE_THROTTLE_SECONDS,
    60,
    0,
    600
  ),
  /** Background sweep that closes idle/expired sessions (ms). 0 disables. */
  AUTH_SESSION_SWEEP_INTERVAL_MS: parseBoundedInt(
    process.env.AUTH_SESSION_SWEEP_INTERVAL_MS,
    5 * 60 * 1000,
    0,
    60 * 60 * 1000
  ),
  /** Multi-factor authentication (TOTP). Disabling it is a deliberate operator decision. */
  MFA_ENABLED: !['false', '0'].includes(String(process.env.MFA_ENABLED || '').trim().toLowerCase()),
  /** 32-byte key (base64 or 64 hex chars) for AES-256-GCM encryption of TOTP secrets. Never logged. */
  MFA_ENCRYPTION_KEY: String(process.env.MFA_ENCRYPTION_KEY || '').trim(),
  /** Roles (canonical codes) that must enroll in MFA before any session is issued. */
  MFA_REQUIRED_ROLE_CODES: parseRoleCodes(
    typeof process.env.MFA_REQUIRED_ROLE_CODES === 'string' && process.env.MFA_REQUIRED_ROLE_CODES.trim()
      ? process.env.MFA_REQUIRED_ROLE_CODES
      : 'super_admin,admin'
  ),
  /** Lifetime of the pre-session MFA challenge (password verified, MFA pending). */
  MFA_CHALLENGE_TTL_MINUTES: parseBoundedInt(process.env.MFA_CHALLENGE_TTL_MINUTES, 5, 1, 15),
  /** Wrong codes accepted per challenge before it is locked (password must be re-entered). */
  MFA_MAX_ATTEMPTS: parseBoundedInt(process.env.MFA_MAX_ATTEMPTS, 5, 1, 10),
  /** Consecutive wrong codes per user (across challenges / step-up) before a temporary cooldown. */
  MFA_USER_LOCK_THRESHOLD: parseBoundedInt(process.env.MFA_USER_LOCK_THRESHOLD, 10, 3, 50),
  /** First cooldown length; doubles for every further threshold reached (capped at 24h). */
  MFA_USER_LOCK_MINUTES: parseBoundedInt(process.env.MFA_USER_LOCK_MINUTES, 15, 1, 24 * 60),
  /** Sensitive operations require an MFA verification on the current session within this window. */
  MFA_STEP_UP_MAX_AGE_MINUTES: parseBoundedInt(process.env.MFA_STEP_UP_MAX_AGE_MINUTES, 10, 1, 60),
  /** One-time recovery codes generated per enrollment / regeneration. */
  MFA_RECOVERY_CODE_COUNT: parseBoundedInt(process.env.MFA_RECOVERY_CODE_COUNT, 10, 8, 12),
  /** Issuer shown in authenticator apps. */
  MFA_ISSUER: String(process.env.MFA_ISSUER || 'eprojecto').trim().slice(0, 40) || 'eprojecto',
  /** Dedupe window for navigation-opened audit events (same session + module + entity). */
  AUDIT_NAVIGATION_DEDUPE_MINUTES: parseBoundedInt(process.env.AUDIT_NAVIGATION_DEDUPE_MINUTES, 30, 1, 24 * 60),
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  /** SPA dashboards issue many GETs; 300/15m is too low with attendance polling. */
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 1200,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 40,
  /** OTP verify/resend + reset-password attempts per client IP + identifier per window. */
  OTP_RATE_LIMIT_MAX: Number(process.env.OTP_RATE_LIMIT_MAX) || 30,
  /** Failed logins per client IP + identifier before progressive cooldown starts. */
  LOGIN_FAILURE_FREE_ATTEMPTS: parseBoundedInt(process.env.LOGIN_FAILURE_FREE_ATTEMPTS, 5, 1, 50),
  /** First cooldown (seconds); doubles per further failure up to LOGIN_FAILURE_MAX_COOLDOWN_SECONDS. */
  LOGIN_FAILURE_BASE_COOLDOWN_SECONDS: parseBoundedInt(process.env.LOGIN_FAILURE_BASE_COOLDOWN_SECONDS, 30, 1, 3600),
  LOGIN_FAILURE_MAX_COOLDOWN_SECONDS: parseBoundedInt(process.env.LOGIN_FAILURE_MAX_COOLDOWN_SECONDS, 900, 1, 3600),
  /** Failed logins from one client IP across any identifiers before that IP is cooled down. */
  LOGIN_FAILURE_IP_FREE_ATTEMPTS: parseBoundedInt(process.env.LOGIN_FAILURE_IP_FREE_ATTEMPTS, 30, 5, 1000),
  /** Failures on one account (all IPs) that raise a brute-force alert (detection only, no lockout). */
  LOGIN_FAILURE_ACCOUNT_ALERT_THRESHOLD: parseBoundedInt(process.env.LOGIN_FAILURE_ACCOUNT_ALERT_THRESHOLD, 20, 5, 1000),
  /** Soft cap for GET attendance-window/active (excluded from main apiLimiter). */
  ATTENDANCE_POLL_RATE_LIMIT_MAX: Number(process.env.ATTENDANCE_POLL_RATE_LIMIT_MAX) || 240,
  /** Soft cap for recorded-lecture heartbeat + player-event (per user + lecture). */
  RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_MAX:
    Number(process.env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_MAX) || 90,
  RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_WINDOW_MS:
    Number(process.env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
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
  /** Log slow requests (>=400ms) without query strings or bodies. */
  PERF_LOGGING: process.env.PERF_LOGGING === 'true' || process.env.PERF_LOGGING === '1',
  /**
   * In-process auth-context cache TTL (ms). 0 disables.
   * Mutations invalidate immediately; this is the fallback stale window.
   */
  AUTH_CONTEXT_CACHE_TTL_MS: parseAuthContextCacheTtlMs(process.env.AUTH_CONTEXT_CACHE_TTL_MS),
  AUTH_CONTEXT_CACHE_MAX: Number(process.env.AUTH_CONTEXT_CACHE_MAX) || 2_000,
};

module.exports = { env, parseRoleCodes, parseRoleCodesWithFallback, parseTrustProxySetting };

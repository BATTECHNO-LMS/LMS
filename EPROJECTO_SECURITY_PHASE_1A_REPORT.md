# EPROJECTO SECURITY PHASE 1A — Client Identity, Rate Limiting, Request Correlation & Security Event Foundation

**Execution:** LOCAL ONLY · **Production accessed:** NO · **Deployed:** NO · **Git add/commit/push/tag/PR:** NOT RUN
**Base commit:** `b4a26a2` (main) · **Date:** 2026-10-15
**Suggested commit message (not executed):** `security: harden client identity rate limits and security events`

---

## 1. Executive summary

Phase 1A makes the API know *who* the client really is, rate-limit per real client instead of per proxy, give every request one correlatable id, and persist security events in a registry-driven, filterable form.

| Area | Before | After |
|---|---|---|
| Client IP | `trust proxy` = subnet list (`loopback,uniquelocal`) with no hop cap; a client inside a private range could prepend a spoofed address | Hop-capped trust function (prod: 2 hops inside loopback/private ranges); one canonical `getSecurityClientIp(req)`; all hand-parsed `X-Forwarded-For` fallbacks removed |
| Rate limiting | Global API limiter removed earlier (Docker gateway bucket collapse); module limiters keyed on raw `req.ip` | Per-user (verified JWT) or per-client-IP buckets, IPv6 /56 grouping, global limiter re-enabled with a kill switch; login: IP+identifier limiter plus progressive cooldown (no permanent lockout) |
| Request id | Client-supplied `X-Request-Id` accepted as-is | Server-generated UUID unless an upstream id comes from a trusted proxy *and* the deployment opts in; id in response header, access log, structured logs, audit rows, error responses |
| Security events | Mixed ad-hoc audit actions, no severity, no category | Registry-tagged `security_category` + `severity` columns; `AUTHORIZATION_DENIED`, `CROSS_SCOPE_ACCESS_DENIED`, `RATE_LIMIT_TRIGGERED`, `LOGIN_BRUTE_FORCE_SUSPECTED`, OTP events; dedupe; never-throw writes |
| Redaction | Access log printed full URL incl. `?access_token=<JWT>` | URL query secrets redacted in Morgan; structured logger redacts secret keys, JWTs, Bearer values; query-string JWT accepted only on `/uploads/*` and the command-center SSE stream |
| Logs page contract | No security filters | `security_only`, `security_category`, `severity`, `outcome=BLOCKED`, `ip_address`, `request_id` (last two super-admin only) |

Validation: 71 new backend security tests, full backend suite 1294/1295 executed tests passing (1 pre-existing unrelated failure), frontend 197/198 (1 pre-existing unrelated failure), local end-to-end smoke 35/35 against the throwaway `lms_test` database.

---

## 2. Scope and constraints honoured

- No SSH, no production Nginx/Docker/env changes, no production DB queries or migrations, no deploy.
- No `git add` / `commit` / `push` / `tag` / PR / merge; no work discarded or reset.
- No MFA. No session-management rewrite (existing sessions/idle-logout untouched apart from compatible event metadata).
- No changes to FT scoring, attendance, eligibility, completion, certificates, grading or organization permissions. Scope guards changed only in *how* they throw (same status, same message, an extra `securityEvent` tag on the error object).
- No passwords, password hashes, JWTs, OTP values, reset tokens or cookies are written to security events or logs (verified by tests and by grepping smoke logs).

---

## 3. Environment safety

- `backend/.env` points at production Neon. Every test/migration/smoke command in this phase was run with an explicit `DATABASE_URL=postgresql://lms_local:…@127.0.0.1:55432/<db>` (local PostgreSQL only).
- Unit tests stub `prisma.audit_logs.create/createMany` and tenant lookups through `tests/helpers/auditCapture.js`, so security-event tests never touch a database.
- The smoke script refuses to run unless `DATABASE_URL` host/port/db is exactly `127.0.0.1:55432/lms_test`.
- Migration `20261015120000_audit_logs_security_events` applied only to local `lms_local` and `lms_test`.

---

## 4. Proxy chain analysis (root cause)

Production request path:

```
Browser ──► host nginx (eprojecto.com, :443)
             proxy_pass http://127.0.0.1:8080; X-Forwarded-For = $proxy_add_x_forwarded_for  → "<client>"
        ──► frontend container nginx (:80, Docker bridge)
             proxy_pass http://backend:4000;   X-Forwarded-For = $proxy_add_x_forwarded_for → "<client>, <docker gateway>"
        ──► Express (socket peer = frontend container, 172.x)
```

As seen by Express: socket peer `172.18.0.x` (hop 1) → right-most XFF `172.18.0.1` gateway (hop 2) → `<client>` (hop 3).

- The historical `trust proxy = 1` stopped at hop 2, so `req.ip` was the Docker gateway for **every** user. Every IP-keyed limiter collapsed into one shared bucket, which is why the global limiter had been removed.
- `b4a26a2` switched to subnet trust (`loopback,uniquelocal`) which fixed the common case, but without a hop cap: a client whose own address is private (campus NAT, VPN, an internal host) is also "trusted", so its spoofed left-most XFF entry became `req.ip`.

---

## 5. Trust proxy implementation

`backend/src/config/trustProxy.js` (new) builds a function `trust(addr, index) = index < hops && inTrustedSubnet(addr)` using `proxy-addr` (the same compiler Express uses).

| `TRUST_PROXY` | Subnets | Hops | Use |
|---|---|---|---|
| unset / `false` / `0` | `loopback` | 1 | local dev (Vite proxy) |
| `true` / `1` | `loopback,uniquelocal` | 2 | production chain (docker-compose already sets `true`) |
| integer `N` | `loopback,uniquelocal` | N | explicit hop count |
| CSV | the listed subnets | 2 | explicit proxy ranges |

Overrides: `TRUST_PROXY_HOPS` (1..5, invalid value fails fast at boot), `TRUST_PROXY_SUBNETS`. Express never receives `trust proxy = true`.

Guarantee: spoofed values are always to the *left* of the entries our proxies append, and the walk stops after `hops` trusted entries, so neither a public nor a private-range client can choose its own `req.ip`.

---

## 6. Canonical client IP

`backend/src/shared/security/clientIdentity.js`:

- `getSecurityClientIp(req)` — normalised `req.ip` (strips `::ffff:`; validated by `net.isIP`; max 64 chars), falling back to the socket peer; never returns a malformed header value.
- `isFromTrustedProxy(req)` — whether the TCP peer is one of our proxies (used for upstream request-id acceptance).
- `clientIpRateLimitKey(req)` — `ipKeyGenerator(ip)` (IPv6 grouped per /56) or `ip:unknown`.

Raw `x-forwarded-for` parsing was removed from `accountDeletion.controller.js`, `popups.controller.js`, `fieldTraining.workflow.controller.js`, `studentFieldTraining.routes.js` and the login controller. A static test now fails if any file under `backend/src` reads `x-forwarded-for` / `x-real-ip` directly.

---

## 7. Rate limiter identity fix

`backend/src/middlewares/rateLimit.middleware.js` was rewritten around `createRateLimiter(opts)`:

- **Key strategies**
  - `userOrIpKey` → `user:<id>` when `req.user` is set or the Bearer JWT **verifies** (signature + expiry, no DB hit); otherwise `ip:<client ip / IPv6 /56>`. A forged token falls back to the IP bucket, so it cannot mint new buckets. Two signed-in users behind one NAT get separate buckets.
  - `credentialAttemptKey` → `<client ip>|<trimmed lower-case email>`. One client cannot hammer one account; one shared campus NAT cannot lock out every other student.
- **Block handler** returns the same JSON body as before (Arabic messages preserved) and records one `RATE_LIMIT_TRIGGERED` per bucket per window (dedupe key = limiter name + SHA-256 of the bucket key; the raw key is never stored).
- **Global API limiter re-enabled**: `apiLimiter` (`RATE_LIMIT_MAX`, default 1200 / 15 min per user-or-IP) + `attendancePollLimiter` mounted on `/api/v1` after the auth routers. Kill switch: `API_RATE_LIMIT_ENABLED=false`.
- **OTP limiter** (`OTP_RATE_LIMIT_MAX`, default 30 / window) on verify/resend email OTP, verify/resend password-reset OTP and reset-password.

---

## 8. Rate limiter inventory

| Limiter (`name`) | Routes | Key | Default limit / window |
|---|---|---|---|
| `api_general` | all `/api/v1/*` except `/api/v1/auth/*`, OPTIONS and attendance polls | user or IP | `RATE_LIMIT_MAX` 1200 / `RATE_LIMIT_WINDOW_MS` 15 min |
| `attendance_poll` | `GET …/student/field-training/attendance-window/active` | user or IP | max(`ATTENDANCE_POLL_RATE_LIMIT_MAX` 240, 60) / 15 min |
| `auth_credentials` | `POST /auth/login`, `POST /auth/forgot-password` | IP + identifier | `AUTH_RATE_LIMIT_MAX` 40 / 15 min |
| `login_failure_cooldown` (in-process guard) | `POST /auth/login` | IP + identifier; IP across identifiers | 5 free failures then 30 s × 2^n, cap 900 s; per IP after 30 failures |
| `otp_attempts` | verify/resend email OTP, verify/resend reset OTP, reset-password | IP + identifier | `OTP_RATE_LIMIT_MAX` 30 / 15 min |
| `ai_generate` | AI generation | user or IP | `AI_RATE_LIMIT_MAX` 20 / 15 min |
| `field_training_ai_self_eval` | FT AI self-evaluation | user or IP | `FIELD_TRAINING_AI_RATE_LIMIT_MAX` 10 / 15 min |
| `file_upload` | file uploads | user or IP | `FILE_UPLOAD_RATE_LIMIT_MAX` 30 / 15 min |
| `attendance_confirm` | FT attendance confirm | user or IP | 20 / 15 min |
| `recorded_lecture_heartbeat` | recorded lecture heartbeat | user or IP + lecture id | `RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_MAX` 90 / 60 s |
| `task_submission_upload` | training task submission upload | user or IP | 120 / 15 min |

**Not limited (documented risk):** `POST /auth/register`, `POST /auth/institutions/register`, `POST /auth/account-status`, `GET /auth/session|me`. `/auth/*` sits outside the global limiter by design (its own credential/OTP limiters), and registration was left alone because a lab of students registering together from one NAT must not be blocked. See §23.

---

## 9. Login brute-force protection

`backend/src/modules/auth/loginThrottle.js` + `loginThrottle.middleware.js`:

- **Client IP + identifier**: after `LOGIN_FAILURE_FREE_ATTEMPTS` (5) wrong passwords, the pair waits `LOGIN_FAILURE_BASE_COOLDOWN_SECONDS` (30) × 2^(n−5) seconds, capped at `LOGIN_FAILURE_MAX_COOLDOWN_SECONDS` (900). A correct password clears the pair.
- **Client IP across identifiers**: same curve after `LOGIN_FAILURE_IP_FREE_ATTEMPTS` (30) — credential stuffing from one client.
- **Identifier across all IPs**: detection only. `LOGIN_BRUTE_FORCE_SUSPECTED` (HIGH) once at `LOGIN_FAILURE_ACCOUNT_ALERT_THRESHOLD` (20) failures in the window, with the distinct-IP count. **Accounts are never locked**, so nobody can lock a student out by failing on purpose.
- During a cooldown the guard returns 429 `AUTH_RATE_LIMIT` with `Retry-After` **before** the password is checked; the response is identical for existing and unknown identifiers.
- Unknown email: a bcrypt comparison against a dummy hash equalises timing. Public error is identical (`INVALID_CREDENTIALS`); the internal reason is `ACCOUNT_NOT_FOUND_OR_INVALID` vs `INVALID_PASSWORD`.
- State is in-process (single API container). Window 15 min; maps capped at 50 000 entries.

---

## 10. Request id correlation

`backend/src/middlewares/requestId.middleware.js`:

- `req.id` = new `crypto.randomUUID()` by default. A client-sent `X-Request-Id` is ignored.
- An upstream id is accepted only if **all** hold: `TRUST_UPSTREAM_REQUEST_ID=true`, the TCP peer is a trusted proxy, and the value matches nginx `$request_id` (32 hex) or a UUID.
- The id is put on the `X-Request-Id` response header (CORS `exposedHeaders` updated), the AsyncLocalStorage request context (picked up by every audit row as `request_id` and by every structured log line as `requestId`), and the Morgan access log (`rid=`).
- Error responses keep the short support code (`requestId: "REQ-XXXXXXXXXXXX"`, derived from `req.id`); 5xx / unhandled error logs now carry both `requestId` (canonical) and `supportRequestId`, so a user-reported code maps to log lines and audit rows.

---

## 11. Logging

- **Morgan** (`requestLogger.middleware.js`): custom tokens `client-ip` (canonical IP), `safe-url` (redacted `originalUrl`), `request-id`, `user-id`.
  - Production: `:client-ip :method :safe-url :status :res[content-length] - :response-time ms rid=:request-id uid=:user-id`
  - Development: `:method :safe-url :status :response-time ms - :res[content-length] rid=:request-id`
- **Structured logger** (`utils/logger.js`): JSON in production with `requestId` from context; metadata passes through `sanitizeForLog`; message passes through `redactString` (now also in the development console branch).
- Security events with severity above INFO also emit a `SECURITY_EVENT` warn line (event code, category, severity, outcome, reason, route — no secrets).

---

## 12. Redaction and sensitive data

`backend/src/shared/security/redaction.js`:

- `redactUrl` — values of `access_token, token, id_token, refresh_token, reset_token, authorization, auth, password, new_password, otp, code, email, sid, signature, x-amz-signature, x-amz-credential, secret, api_key, apikey, key` → `[REDACTED]` (path and harmless params preserved).
- `sanitizeForLog` — deep copy, drops values whose key matches password/token/secret/authorization/cookie/otp/code_hash/api key/signature/credential, strips JWTs and Bearer values inside any string, bounds string length, key count, array length and depth. One-way fingerprints such as `identifierHash` are kept.
- `boundString` — bounds attacker-controlled scalars and strips control characters.
- Password-reset audit rows no longer store the normalised email in `new_values` (`identifierMasked` instead).

**Important limitation:** this redaction only covers what the Node process writes. **Host nginx and container nginx access logs still record the full request line**, including `?access_token=<JWT>` on `/uploads/*` and the SSE stream. That is fixed by removing URL tokens (Phase 1B, §13), not by Express.

---

## 13. JWT query-string consumers and Phase 1B plan

The backend now accepts `?access_token=` only on `GET` + these paths (`auth.middleware.js` `QUERY_TOKEN_PATHS`). Everywhere else it is ignored (verified by a test and by the smoke run: 401).

| Consumer | Why a URL token | Path |
|---|---|---|
| `withUploadAccessToken` → `TraineeCourseDetailPage.jsx`, `LessonTrainingWorkflow.jsx`, `CourseMaterialsManager.jsx`, `fieldTrainingDownload.js`, backend `training.service.js` URLs | browser opens / `<img>` / new-tab downloads cannot send headers | `/uploads/*` |
| Command-center live stream (`EventSource`) | `EventSource` cannot set headers | `/api/v1/analytics/command-center/live` |

**Phase 1B plan:**

1. Uploads: short-lived (≤ 60 s), single-purpose signed download URLs (`/files/download/<id>?sig=…&exp=…`, HMAC over file id + user id + expiry), or fetch-with-header + `Blob` URL for in-app viewers. Then remove `withUploadAccessToken`.
2. SSE: exchange the session for a one-time stream ticket (`POST /analytics/command-center/live-ticket` → opaque 30 s ticket), or use an HttpOnly same-site cookie.
3. Drop `access_token` from `QUERY_TOKEN_PATHS`; keep `redactUrl` as defence in depth.
4. Optionally add an nginx `map` that masks `access_token` in host access logs during the transition.

---

## 14. Security event registry

Security events are `audit_logs` rows whose action is registered in `shared/audit/auditActions.js` with `security: [category, severity]`.

- Categories: `AUTHENTICATION`, `AUTHORIZATION`, `RATE_LIMIT`, `SESSION`, `ACCOUNT_SECURITY`, `SYSTEM_SECURITY` (Arabic and English labels in the catalog).
- Outcomes: `SUCCESS`, `FAILED`, `DENIED`, `BLOCKED` (new, "محظور مؤقتًا").
- Severities: `INFO`, `WARNING`, `HIGH`, `CRITICAL`.
- `audit.service.resolveSecurityFields` fills `security_category` and `severity` **from the registry only**; a caller may pass a severity, but only a valid enum value is accepted. Unregistered event types are rejected and logged (`SECURITY_EVENT_NOT_REGISTERED`).
- `shared/security/securityEvents.js` → `recordSecurityEvent()` is the single entry point for middleware/guards: registry check, dedupe, sanitised + bounded metadata (`reason`, `method`, route pattern with ids masked, caller metadata; max 20 keys, 200-char strings), canonical IP, request id from context.
- The catalog API now returns `security_categories`, `severities` and `security_category` per action.

---

## 15. Security events implemented

| Event | Category / severity | Outcome | Trigger |
|---|---|---|---|
| `USER_LOGIN_SUCCESS` | AUTHENTICATION / INFO | SUCCESS | login |
| `USER_LOGIN_FAILED` (the "LOGIN_FAILED" event) | AUTHENTICATION / INFO | FAILED | wrong password (`INVALID_PASSWORD`) or unknown identifier (`ACCOUNT_NOT_FOUND_OR_INVALID`) |
| `LOGIN_ACCOUNT_DENIED` | AUTHENTICATION / WARNING | DENIED | correct password but unverified / pending / rejected / suspended / inactive |
| `LOGIN_BRUTE_FORCE_SUSPECTED` | AUTHENTICATION / HIGH | FAILED | ≥ 20 failures on one identifier across IPs |
| `AUTHORIZATION_DENIED` | AUTHORIZATION / WARNING | DENIED | role / portal / permission / reviewer-read-only middleware; access-control 403 codes from services |
| `CROSS_SCOPE_ACCESS_DENIED` | AUTHORIZATION / HIGH | DENIED | valid user reaching another university / organization / user (scope guards tagged via `crossScopeForbidden`) |
| `RATE_LIMIT_TRIGGERED` | RATE_LIMIT / WARNING | BLOCKED | any limiter block, incl. the login cooldown |
| `OTP_FAILED` | ACCOUNT_SECURITY / INFO | FAILED | wrong email-verification / reset OTP |
| `OTP_LOCKED_TEMPORARILY` | ACCOUNT_SECURITY / WARNING | BLOCKED | the attempt that exhausts an OTP |
| `OTP_RATE_LIMITED` | RATE_LIMIT / WARNING | BLOCKED | attempt against an exhausted OTP |
| `TOKEN_INVALID` | AUTHENTICATION / WARNING | DENIED | forged / malformed JWT (deduped per IP + user + reason) |
| `TOKEN_EXPIRED` | SESSION / INFO | DENIED | expired JWT (deduped) |
| Existing session / password-reset / role / status / permission-change actions | tagged with categories | unchanged | unchanged |

`PERMISSION_DENIED` is kept as `legacy: true` so historical rows still render; new denials use `AUTHORIZATION_DENIED`.

---

## 16. Denial ownership and noise control

- **One event per request.** Route-level middleware (`authorizeRoles`, `requireOrganizationType`, `requirePermission`, `enforceReviewerReadOnly`) records the denial; the error middleware records only 403s thrown by services; `req.securityDenialRecorded` stops a second record.
- **Business 403s are not security events.** `classifyForbiddenError` maps only an allowlist of access-control codes (`FORBIDDEN`, `ROLE_NOT_ALLOWED`, `PORTAL_MISMATCH`, `REVIEWER_*`, `REPORT_READ_ONLY`, `FIELD_TRAINING_FORBIDDEN`, `FILE_FORBIDDEN`, `TRAINER_*`, `SUPPORT_STUDENT_ONLY`) plus cross-scope tags/codes. Codes like `TASK_LOCKED` produce nothing.
- **Anonymous requests** produce no authorization events (they are 401s, covered by token events).
- **Dedupe:** denials 5 min per user + method + route pattern + reason; token failures per IP + user + reason; rate-limit events once per bucket per window; OTP lock / rate-limit once per OTP. In-memory, capped at 10 000 keys.
- **Metadata:** the actor's own university/organization is recorded; the *target* id from the URL is not echoed (route pattern only).

---

## 17. Failure policy

- `recordSecurityEvent` and `recordAudit` never throw (one retry, then `AUDIT_WRITE_FAILED_SECURITY_EVENT` error log without secrets).
- Rejected login: the rejection is logged best-effort and the **original error is rethrown**; a logging failure can never turn a failure into a success (tested with a failing DB stub).
- Limiter / cooldown / authorization blocks are decided before logging, and the 429 / 403 is sent even if the event write fails (tested).
- Successful login proceeds if its audit write fails (an error log is emitted), which preserves availability.

---

## 18. Logs page backend contract

`GET /api/v1/audit-logs` new query parameters (validated by zod in `auditLogs.validation.js`):

| Param | Validation | Who may use |
|---|---|---|
| `security_only=true` | `'true'/'false'` | any reader (within own scope) |
| `security_category` | enum of the 6 categories | any reader |
| `severity` | enum of the 4 severities | any reader |
| `outcome=BLOCKED` | enum incl. `BLOCKED` | any reader |
| `action_type`, `user_id` / `involving_user_id`, `from` / `to` | existing | any reader |
| `ip_address` | `net.isIP`, ≤ 64 | **super admin only** (else 403 `AUDIT_FILTER_GLOBAL_ONLY`) |
| `request_id` | `[A-Za-z0-9._:-]`, ≤ 128 | **super admin only** |

RBAC (unchanged model, re-verified):

- **Super admin** (`isGlobal` explicitly true) sees everything, including IP, user agent, request id and session id in details.
- **Scoped admin**: the tenant restriction is always the first `AND` clause; a `university_id` filter cannot widen scope; technical metadata and filters are hidden.
- **Students, instructors, unscoped admins**: no access (403 at route level; the service would still return deny-all).

Category and severity filters also match legacy rows (null columns) through the registry action lists. List rows carry `security_category`, `severity` and their Arabic/English labels. Frontend `auditPresentation.js` maps the new filters (`securityCategory`, `severity`, `securityOnly`, `ipAddress`, `requestId`), adds the `BLOCKED` outcome badge and a `severityVariant` helper. No UI redesign was done.

---

## 19. Database migration and indexes

`backend/prisma/migrations/20261015120000_audit_logs_security_events/migration.sql` — additive, nullable, no backfill, no locks beyond index builds:

```sql
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "security_category" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "severity" VARCHAR(16);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_security_created" ON "audit_logs"("security_category", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_ip_created" ON "audit_logs"("ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_request_id" ON "audit_logs"("request_id");
```

`schema.prisma` updated; `prisma validate` + `prisma generate` OK; applied to local `lms_local` and `lms_test`. The baseline-manifest test list includes the new migration. Rollback, if ever needed: drop the three indexes and two columns. Old code ignores the columns, so rolling back the app alone is also safe.

On a large production table, `CREATE INDEX` (non-concurrent) briefly blocks writes to `audit_logs`. At current volume this is seconds; if the table has grown large, create the indexes `CONCURRENTLY` manually before running `migrate deploy`.

---

## 20. Retention policy (proposal only — nothing purged)

| Data | Proposed retention | Notes |
|---|---|---|
| Security events HIGH / CRITICAL | 24 months | incident investigation, compliance |
| Security events WARNING (denials, rate limits, OTP locks) | 12 months | |
| Security events INFO (login success/failure, token expiry) | 6 months | high volume |
| Business audit rows (grades, attendance, certificates…) | per academic record policy (≥ 5 years) | **not** covered by security purge |
| IP address / user agent on security rows | null out after 6 months (pseudonymise) | keep the event, drop personal network data |
| nginx / container access logs | 30 days rotation | contain URLs (see §12) |
| Application JSON logs | 30–90 days | |

Implementation later: a scheduled job deleting `WHERE security_category IS NOT NULL AND severity = … AND created_at < now() - interval …` in batches, behind an explicit env flag, with a dry-run count first. Not implemented in this phase.

---

## 21. Tests

New backend test files (registered in `npm run test:unit`):

| File | Tests | Covers |
|---|---|---|
| `security.clientIdentity.unit.test.js` | 20 | config parsing, hop cap, prod chain IPv4 (203.0.113.10, 198.51.100.22), IPv6 (2001:db8::1), spoofed XFF (1.2.3.4), private-range spoof, direct public peer, missing header, malformed values, IPv6 /56 keys, real Express integration, static guard against hand-parsed XFF |
| `auth.extractBearerToken.unit.test.js` (updated) | 6 | query token only on `/uploads/*` + SSE, ignored on other GET paths and non-GET, lookalike paths |
| `security.rateLimit.unit.test.js` | 9 | A/B separate buckets, spoof evasion, forged JWT fallback, NAT users separate, IP+identifier keys, one event per bucket/window, request-id + IP on event, no email/password in event, 429 when the DB write fails |
| `security.loginEvents.unit.test.js` | 13 | wrong password, unknown email (identical public error), suspended / pending / rejected / unverified → `LOGIN_ACCOUNT_DENIED`, suspended + wrong password reveals nothing, logging failure keeps rejection, cooldown curve + cap + expiry, success reset, brute-force alert once (HIGH), HTTP 429 + `Retry-After` + one BLOCKED event, other client unaffected |
| `security.authorizationEvents.unit.test.js` | 14 | cross-university 403 → exactly one `CROSS_SCOPE_ACCESS_DENIED` (HIGH, IP, request id, route pattern, no target id), list filter variant, dedupe, role denial owned by middleware (no duplicate), business 403 / anonymous / super admin → no events, classifier, OTP events, registry completeness, migration additive-only, audit filter validation and RBAC |
| `security.requestIdAndRedaction.unit.test.js` | 9 | generated id, client id ignored, upstream acceptance rules, access log + audit row + error log correlation, support code, URL redaction in Morgan, `redactUrl`, `sanitizeForLog`, logger never prints fake secrets |

Updated existing tests: `authSession.middleware.unit.test.js` (trust setting is now a function, never `true`), `baselineManifest.test.js` (new migration listed), frontend `auditPresentation.unit.test.js` (security filters, BLOCKED / severity variants).

Results (local, `DATABASE_URL` = local PostgreSQL):

- Backend `npm run test:unit`: **1298 tests, 1294 pass, 1 fail, 3 skipped/todo.** The failure, `fieldTraining.completionLetters.supervisorExcel.unit.test.js:430` (Arabic PDF text extraction), was already failing before this phase and is unrelated.
- Frontend `npm run test:unit`: **198 tests, 197 pass, 1 fail.** The failure, `fieldTrainingEvaluation.ui.test.js:133`, was already failing before this phase and is unrelated.
- All fake secrets in tests are clearly synthetic (`Fake#Password-For-Test-1`, a JWT-shaped string with a fake signature).

---

## 22. Local smoke (lms_test, `TRUST_PROXY=true`, production-shaped XFF chain)

Script: `%TEMP%\eprojecto-localpg\smoke-security-1a.js` (outside the repo; refuses any DB other than local `lms_test`). **35/35 PASS:**

- Login success: `X-Request-Id` is a server UUID (client-chosen value ignored); `USER_LOGIN_SUCCESS` row has client IP 203.0.113.10, matching `request_id`, `AUTHENTICATION/INFO`.
- Spoofed `6.6.6.6, 203.0.113.11, <gateway>` → 203.0.113.11 recorded.
- Wrong password and unknown email → identical 401; rows with `INVALID_PASSWORD` / `ACCOUNT_NOT_FOUND_OR_INVALID`.
- Suspended account (temporarily suspended seed reviewer, restored afterwards) → 403 + `LOGIN_ACCOUNT_DENIED`.
- Student protected request 200; student → activity log 403 + exactly one `AUTHORIZATION_DENIED`.
- University admin → `GET /users?university_id=<other university>` twice → 403 twice, exactly one `CROSS_SCOPE_ACCESS_DENIED` (HIGH) with the request id and IP.
- Forged Bearer → 401 + `TOKEN_INVALID`; `?access_token=<valid JWT>` on `/users` → 401 (ignored).
- Seven failed logins → 429 + `Retry-After`; the same identifier from another client → 401 (no lockout); one `RATE_LIMIT_TRIGGERED` (BLOCKED).
- API burst (65 > limit 60) → 429; neighbouring client unaffected; spoofed XFF still 429; one `RATE_LIMIT_TRIGGERED` `api_general`.
- Super admin: `security_only`, `request_id`, `ip_address + severity`, `security_category=RATE_LIMIT&outcome=BLOCKED` filters all work; scoped admin `ip_address` filter → 403 `AUDIT_FILTER_GLOBAL_ONLY`; normal admin list 200.
- No token or test password in any audit row; captured logs contain no JWT, no `Bearer ey…`, no `password=`, no `otp=`, no test password; the access log shows `access_token=[REDACTED]` and `rid=<uuid>` on every line, including the cross-scope request.

Events written during the run: `USER_LOGIN_SUCCESS 3, AUTH_SESSION_CREATED 3, USER_LOGIN_FAILED 8, LOGIN_ACCOUNT_DENIED 1, AUTHORIZATION_DENIED 1, CROSS_SCOPE_ACCESS_DENIED 1, TOKEN_INVALID 1, RATE_LIMIT_TRIGGERED 2`.

---

## 23. Production deployment requirements, remaining risks and next phase

### Deployment requirements (for a later, explicitly approved deploy — NOT executed)

1. **Migration:** `npx prisma migrate deploy` applies `20261015120000_audit_logs_security_events` (additive; see the index note in §19). Take a Neon branch / backup first.
2. **Env:** keep `TRUST_PROXY=true` (now = 2 hops in private ranges). Leave `TRUST_UPSTREAM_REQUEST_ID` unset until step 3 is live. Optional: `API_RATE_LIMIT_ENABLED` (default on), `RATE_LIMIT_MAX`, `OTP_RATE_LIMIT_MAX`, `LOGIN_FAILURE_*`.
3. **Host nginx** (repo copy `deploy/nginx-eprojecto.com.conf` updated, live file untouched): `proxy_set_header X-Request-Id $request_id;` in every proxied location (this **overwrites** any client value), and optionally add `$request_id` to the host `log_format`. Container `frontend/nginx.conf` passes it through (repo updated; takes effect on the next frontend image build). Then set `TRUST_UPSTREAM_REQUEST_ID=true` so nginx and app logs share one id.
4. **Verify after deploy:** a login row shows the real public IP (not `172.x`); `X-Request-Id` on responses; a 429 from one IP does not affect another; `docker logs` access lines show `rid=` and `[REDACTED]`.
5. **Rollback:** previous image / tag; the migration can stay (old code ignores the columns). Kill switch for the global limiter: `API_RATE_LIMIT_ENABLED=false`.

### Remaining risks

- **nginx still logs full URLs**, including `?access_token=<JWT>` on `/uploads/*` and the SSE stream (Phase 1B removes URL tokens).
- Registration, institution registration and `account-status` have no rate limiter; `account-status` may allow account-state probing.
- Login throttle, dedupe and limiter state are **in-process memory**: they reset on restart and would not be shared across multiple API replicas (a Redis store would be needed before scaling out).
- Scoped admins do not see denials *targeting* their university by other tenants (events carry the actor's tenant only). This is intentional for now; super admins see everything.
- A `TRUST_PROXY_HOPS` value that does not match the real chain (e.g., if a CDN is added in front) would make `req.ip` a proxy address. Revisit the trust setting whenever the network path changes.
- Re-enabling the global limiter is a behaviour change: heavy SPA dashboards are covered by per-user buckets (1200 / 15 min), but monitor `RATE_LIMIT_TRIGGERED api_general` after deploy.

### Recommended next phase

**EPROJECTO SECURITY PHASE 1B — SERVER-SIDE SESSIONS + 30-MINUTE IDLE LOGOUT**, together with removing JWTs from URLs (signed download URLs, SSE tickets), a registration / account-status limiter, and a shared (Redis) limiter store if the API is ever scaled beyond one container.

---

## Appendix — files changed (uncommitted)

**New:** `backend/src/config/trustProxy.js`, `backend/src/shared/security/{clientIdentity,redaction,securityEvents}.js`, `backend/src/modules/auth/{loginThrottle,loginThrottle.middleware,otpSecurityEvents}.js`, `backend/prisma/migrations/20261015120000_audit_logs_security_events/migration.sql`, `backend/tests/security.{clientIdentity,rateLimit,loginEvents,authorizationEvents,requestIdAndRedaction}.unit.test.js`, this report.

**Modified (backend):** `app.js`, `config/env.js`, `middlewares/{auth,authorization,error,permission,rateLimit,requestId,requestLogger}.middleware.js`, `utils/{apiError,logger,organizationScope,universityScope}.js`, `shared/audit/{auditActions,studentActivityTimeline.service}.js`, `shared/services/audit.service.js`, `modules/auth/{auth.controller,auth.routes,auth.service,authSecurityEvents,emailVerification.service,passwordReset.service}.js`, `modules/audit-logs/auditLogs.{service,validation}.js`, `modules/users/users.service.js`, `modules/fieldTraining/{fieldTraining.access,fieldTraining.aiRateLimit.middleware,fieldTraining.attendanceRateLimit.middleware,fieldTraining.recordedLectures.heartbeatRateLimit.middleware,fieldTraining.workflow.controller,studentFieldTraining.routes}.js`, `modules/{ai/ai.rateLimit.middleware,files/files.rateLimit.middleware,popups/popups.controller,accountDeletion/accountDeletion.controller,trainingPrograms/trainingPrograms.routes}.js`, `prisma/schema.prisma`, `package.json` (test list), tests `auth.extractBearerToken`, `authSession.middleware`, `baselineManifest`.

**Modified (frontend / deploy):** `frontend/src/features/auditLogs/auditPresentation.js`, `frontend/tests/auditPresentation.unit.test.js`, `frontend/nginx.conf`, `deploy/nginx-eprojecto.com.conf` (repo copies only).

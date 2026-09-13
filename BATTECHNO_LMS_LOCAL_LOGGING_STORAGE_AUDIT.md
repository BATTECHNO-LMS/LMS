# BATTECHNO LMS — Local Logging and Audit Storage Audit

```text
AUDIT MODE: LOCAL ONLY

Production server accessed: NO
Production database accessed: NO
Production website accessed: NO
SSH used: NO
Production changes: NONE
```

**Repository:** local working tree at `D:\LMS`  
**Audit date:** 2026-09-12  
**Code modified:** NO  
**Git:** no add / commit / push  

This report is based only on local repository inspection (Prisma schema, backend/frontend/mobile source, Docker/Nginx files in the repo, and a local `docker` CLI availability check). Live Docker inspect was not possible because the Docker CLI is not installed in this environment.

---

## Executive summary

BATTECHNO LMS does **not** persist application stdout/stderr logs to files. Runtime logs go to **console** (JSON in production, pretty-printed in development). HTTP access logs use **Morgan** to stdout. Persistent operational evidence lives almost entirely in **PostgreSQL**, led by `audit_logs`, plus notifications, OTPs, report snapshots, Field Training evaluation/letter history, and help-search logs.

There is **no session table**, **no refresh-token store**, **no Recorded Lecture heartbeat table**, and **no configured log retention/TTL** for audit or notification tables.

Highest practical storage risk is **unbounded `audit_logs`** (every successful login + many report reads/exports). Highest security logging risk is **JWT query-string tokens appearing in Morgan access logs** on GET file/upload URLs.

---

## 1. Scope and method

Inspected:

- Backend (`backend/src`, `backend/prisma/schema.prisma`, Dockerfiles, scripts)
- Frontend (`frontend/src`, `frontend/nginx.conf`)
- Mobile (`mobile/battechno_lms_app`)
- Root `docker-compose.yml`
- Repo Nginx configs (`frontend/nginx.conf`, `deploy/nginx-lms.battechno.com.conf`)
- Package dependencies for logging libraries

Not inspected (by instruction):

- Production host `187.55.228.232`
- Production site `https://lms.battechno.com`
- Production credentials / production database
- Remote SSH / remote Docker

Search included filenames and actual usage of: `log`, `logger`, `audit`, `activity`, `event`, `history`, `requestId`, `console.*`, `morgan`, `pino`, `winston`, `sentry`, `telemetry`, `session`, `login`, `ipAddress`, `userAgent`, `heartbeat`, `watchSession`, `createdBy`, `metadata`, and related wrappers (`recordAudit`, `auditRecorder`, `emitDomainEvent`, `dispatchAppEvent`).

---

## 2. Logging libraries

| Name | Location | Purpose | Log levels | Output destination | Persistence |
| ---- | -------- | ------- | ---------- | ------------------ | ----------- |
| Custom `log()` | `backend/src/utils/logger.js` | Structured application logger | `info`, `warn`, `error` | stdout / stderr via `console.*` | **OUTPUT ONLY** |
| Morgan | `backend/src/middlewares/requestLogger.middleware.js` (`morgan` in `backend/package.json`) | HTTP access log | N/A (access line) | stdout | **OUTPUT ONLY** |
| `console.log` / `console.warn` / `console.error` / `console.info` | `backend/src/server.js`, `db.js` path via Prisma, various modules | Startup, shutdown, unhandled errors, optional perf SQL | implicit | stdout / stderr | **OUTPUT ONLY** |
| Prisma client `log` | `backend/src/config/db.js` | Engine errors/warnings; optional query events | `error` always; `warn` in development; `query` when `PERF_LOGGING` | stdout and in-memory ALS | **OUTPUT ONLY** |
| React `console.error` | `frontend/src/components/ErrorBoundary.jsx`, `SuperAdminAnalyticsPage.jsx` | UI error handling | error | browser console | **OUTPUT ONLY** |
| Flutter `debugPrint` + Dio `LogInterceptor` | `mobile/.../api_client.dart` | Dev HTTP debug | debug | device/debug console | **OUTPUT ONLY** (debug builds) |
| Pino | not used | — | — | — | — |
| Winston | not used | — | — | — | — |
| Sentry / Datadog / New Relic / OpenTelemetry SDK | not used in first-party code (`@opentelemetry/api` is a **transitive** lockfile package only) | — | — | — | **No first-party integration** |
| Prisma `$use` middleware | none | — | — | — | — |

The custom logger explicitly states that audit writes stay in `audit.service` / DB, not in the logger.

---

## 3. Architecture map (actual findings)

```text
Browser
  ├─ console.error (ErrorBoundary, analytics page catch)
  ├─ localStorage (auth token/user, locale, tenant scope)
  └─ sessionStorage (password-reset token, last portal, popup/announcement viewed, attendance notified)

Frontend SPA
  └─ no telemetry SDK; requestId only on failed API error objects

Mobile app
  └─ Dio LogInterceptor in debug/dev only (request body printed)

Backend (Express)
  ├─ requestIdMiddleware  → header X-Request-Id (request lifecycle only)
  ├─ Morgan access logger → stdout (skips /health and /health/ready)
  ├─ perfTiming middleware → stdout when PERF_LOGGING=true
  ├─ custom logger        → stdout/stderr
  ├─ errorMiddleware      → logger.error for 5xx / unhandled
  ├─ recordAudit / audit.service → PostgreSQL audit_logs
  ├─ emitDomainEvent      → notifications (+ optional email delivery rows)
  └─ dispatchAppEvent     → selected audit_logs + notifications

PostgreSQL
  ├─ audit_logs
  ├─ notifications + notification_deliveries
  ├─ email_verification_otps / password_reset_otps
  ├─ help_search_logs / help_article_views
  ├─ Field Training applications, attendance, attempts, letters, evaluations
  ├─ training_materials (Recorded Lectures as rows, not watch events)
  ├─ training_* reports / finalization_events
  └─ files registry (soft-delete)

Docker (compose file only; CLI not available locally)
  └─ container stdout/stderr → Docker json-file default (no max-size in compose)

Repo Nginx configs
  └─ no access_log / error_log / log_format directives
     (host/container Nginx defaults would apply if those files are used)
```

---

## 4. Application logger (custom)

**File:** `backend/src/utils/logger.js`

**What is logged:** `{ ts, level, service: 'battechno-lms-api', message, ...meta }`

**Levels:** `info` | `warn` | `error`

**Destination:**

- Production: one JSON line per event (`console.error` / `console.warn` / `console.log`)
- Non-production: human-readable line plus meta object

**Persistence:** **OUTPUT ONLY**. Not written to a file by application code.

**Callers found:**

| Caller | Typical content |
| ------ | ---------------- |
| `error.middleware.js` | 5xx / unhandled error message, `requestId`, `code`, `name`, `prismaCode`; stack **only when not production** |
| `email.service.js` | masked recipient (`ab***@domain`), Resend error **message** (not API key) |
| `notificationDispatcher.service.js` | unknown event, recipient/rule failures, emit failures (truncated error text) |
| `fieldTraining.completionLetter.service.js` | `PDF_RENDER_FAILED`, `OUTPUT_WRITE_FAILED`, `TEMPLATE_RENDER_FAILED` + `applicationId` |
| `fieldTraining.completionLetter.template.js` | `MISSING_FONT`, `LOGO_NOT_FOUND`, `STAMP_NOT_FOUND` |
| `fieldTraining.policy.service.js` | `field_training.policy.resolved` info |

---

## 5. Backend application logs by concern

| Concern | What is logged? | Where emitted? | Where stored? | Persistent? |
| ------- | --------------- | -------------- | ------------- | ----------- |
| Startup | `Connected to the database.`, `BATTECHNO-LMS API listening on port …`, config/JWT/R2/AI warnings | `server.js` console | nowhere | OUTPUT ONLY |
| Shutdown | `{signal} received; closing HTTP server and database pool.` | `server.js` console | nowhere | OUTPUT ONLY |
| Requests | Morgan line: IP, method, URL (incl. query), status, length, time, `x-request-id` in production; `dev` format locally | Morgan stdout | nowhere | OUTPUT ONLY |
| Responses | Status + content-length in Morgan; bodies **not** logged by Morgan | stdout | nowhere | OUTPUT ONLY |
| Errors (5xx / unhandled) | message, requestId, name, prismaCode; stack off in production | custom logger | nowhere | OUTPUT ONLY |
| Warnings | missing fonts/logo, email skipped, notification failures, missing `audit_logs` table | custom logger / console.warn | nowhere | OUTPUT ONLY |
| Database errors | Prisma `error` (and `warn` in development) to stdout; mapped P2002/P2025 in error middleware | Prisma + error middleware | nowhere | OUTPUT ONLY |
| Auth failures | **Not written to logger or audit_logs.** Client gets 401/403 JSON. | HTTP response only | `users.last_login_at` only on success | Failed: NO |
| Authorization failures | Auth/permission middleware returns 401/403 JSON; **no logger/audit write** | HTTP response | nowhere | NO |
| API / validation errors | 4xx `ApiError` is **not** logged (only 5xx) | JSON body | nowhere | NO |
| External API failures | Resend error message (masked `to`); YouTube failures throw `ApiError` **without** logging URL/key | logger / HTTP | `notification_deliveries.failure_*` for email channel | Partial (email deliveries only) |
| Background tasks | Notification `processDueJobs` is **on-demand via API**, not an in-process cron. Job rows in `notification_scheduled_jobs`. Completion-letter bulk jobs in `field_training_completion_letter_jobs`. | logger on emit failure; DB job rows | PostgreSQL | Job rows YES |
| Report generation | `report.read` / `report.export` audit rows; FT reports same; official training reports stored as snapshot rows | audit_logs + report tables | PostgreSQL | YES |
| File operations | **No audit_logs.** Metadata in `files`. Unauthorized access is 403 only. | HTTP | `files` row | Metadata YES; access log NO |

Unhandled process events (`unhandledRejection`, `uncaughtException`, HTTP `server.on('error')`) dump the **full Error object** to stderr.

---

## 6. STDOUT / STDERR vs persisted logs

### OUTPUT ONLY

- Custom `log()`
- Morgan access lines
- `server.js` lifecycle and crash dumps
- Prisma engine `error`/`warn`
- `PERF_LOGGING` `[perf]` / `[perf:query]` lines
- Frontend `console.error`
- Mobile `debugPrint` (debug)

If the process is run in a terminal: local terminal only.  
If the process is run in Docker: captured by the container logging driver (see §33).  
**Application code does not write these to a log file.**

### PERSISTED LOG

- PostgreSQL tables listed in §8 / §42
- Soft-deleted `files.deleted_at`
- QA artifacts under `qa-artifacts/` (manual test dumps, not runtime)

---

## 7. Log files

**No application-configured rotating log files** (`error.log`, `combined.log`, `access.log`, `logs/`) were found in application or Docker/Nginx repo config.

| Path | Creator | Content | Rotation | Retention | Max size |
| ---- | ------- | ------- | -------- | --------- | -------- |
| *(none in app code)* | — | — | — | — | — |
| `*.log` gitignored | local tools / OS | unknown if created outside app | unknown | unknown | unknown |
| `qa-artifacts/field-training/logs/*.json` | QA scripts | probe/smoke JSON | none | none | unbounded in repo if committed |
| Docker json-file (if compose used) | Docker daemon | container stdout/stderr | **not set in compose** | daemon default | **not set in compose** |
| Nginx default files (if image/host defaults apply) | Nginx | access/error | distro default | distro default | not configured in repo |

Repo Nginx files **do not** set `access_log`, `error_log`, or `log_format`.

---

## 8. Database-persisted logs / history

Prisma models that genuinely behave as logs, events, tracking, or historical evidence:

### Dedicated audit / event / tracking

| Model | Type |
| ----- | ---- |
| `audit_logs` | Append-only application audit trail |
| `help_search_logs` | Help search query log |
| `help_article_views` | Help article view events |
| `notification_deliveries` | Channel send attempts / provider ids / failures |
| `notification_scheduled_jobs` | Scheduled notification jobs |
| `notification_digests` | Aggregated notification batches |
| `notifications` | In-app notification history |
| `field_training_supervisor_import_audit` | Per-row supervisor import audit |
| `field_training_supervisor_import_batches` | Import batch + `preview_json` |
| `field_training_completion_letter_jobs` | Bulk letter job status/progress/errors |
| `training_finalization_events` | Training close/reopen event |
| `kpi_snapshots` | Computed KPI time series |
| `kpi_alerts` | KPI alert records |
| `email_verification_otps` | OTP security records (hashed codes) |
| `password_reset_otps` | Reset OTP / hashed reset token records |
| `account_deletion_requests` | Deletion lifecycle |
| `integrity_cases` | Academic integrity cases |
| `risk_cases` | Risk cases |
| `qa_reviews` / `corrective_actions` | QA review history |
| `field_training_attendance_window_attempts` | Electronic attendance attempt counts |
| `announcement_user_states` / `managed_popup_user_states` | Seen/ack tracking |
| `mobile_push_registrations` | Device tokens + last seen + last delivery error |
| `help_article_versions` | Content version history |
| `micro_credential_versions` | Curriculum version history |

### Business rows that also serve as historical evidence

`users.last_login_at`, `field_training_applications` (status/hours/eligibility timestamps), `field_training_attendance` (IP/device), `field_training_assessment_attempts`, `training_assessment_attempts`, `submissions`, `grades`, `certificates`, `training_certificates`, `field_training_completion_letters`, `field_training_final_evaluations` (versioned, `is_current`), `training_official_reports` / `training_individual_reports` / `training_course_reports`, `files` (soft delete), `course_lesson_progress`, `course_lesson_student_workflow`, `training_progress`, `user_onboarding_progress`, `support_tickets`, `recognition_requests` / `recognition_documents`.

**Not classified as logs:** ordinary catalogs (roles, permissions, universities, opportunities, materials themselves).

**No models exist for:** HTTP request archive, failed logins, JWT sessions, refresh tokens, watch heartbeats, watch segments, watch sessions.

---

## 9. Audit trail architecture

| Piece | Location |
| ----- | -------- |
| Prisma model | `audit_logs` |
| Writer | `backend/src/shared/services/audit.service.js` → `recordAudit()` |
| Thin wrapper | `backend/src/utils/auditRecorder.js` (same writer) |
| Readers | `backend/src/modules/audit-logs/*`, dashboard, analytics Excel, Field Training activity/cohort reports |
| UI | `/admin/audit-logs` |
| Middleware that writes audits | **None.** Controllers/services call `recordAudit` explicitly. |
| Public POST | **None.** Schema comment: append-only via internal helpers. |

If the table is missing (`P2021`), writes are skipped with `console.warn` and the original operation continues.

### Known `action_type` values (implementation names only)

**Auth / account**

- `USER_REGISTERED`
- `INSTITUTION_USER_REGISTERED`
- `USER_LOGIN_SUCCESS`
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_OTP_VERIFIED`
- `PASSWORD_RESET_COMPLETED`
- `USER_CREATED`
- `USER_UPDATED`
- `USER_STATUS_CHANGED`
- `USER_PASSWORD_RESET`
- `USER_ACTIVATED`
- `USER_EMAIL_VERIFIED`
- `BULK_EMAIL_VERIFIED`
- `USERS_EXCEL_EXPORTED`
- `EMAIL_VERIFIED_ADMIN`
- `ACCOUNT_ACTIVATE`
- `ACCOUNT_REJECT`
- `ACCOUNT_DISABLE`
- `ACCOUNT_DELETION_REQUESTED`
- `ACCOUNT_DELETION_CANCELLED`
- `ACCOUNT_DELETION_PROCESSING`
- `ACCOUNT_DELETION_REJECTED`
- `ACCOUNT_DELETION_COMPLETED`

**Organizations / reviewers / trainers**

- `ORGANIZATION_CREATED`
- `ORGANIZATION_UPDATED`
- `ORG_BRANCH_CREATED`
- `ORG_BRANCH_UPDATED`
- `ORG_DEPARTMENT_CREATED`
- `ORG_ASSIGNMENT_CREATED`
- `REVIEWER_UNIVERSITY_ASSIGNED`
- `REVIEWER_UNIVERSITY_UNASSIGNED`
- `TRAINER_USER_CREATED`
- `TRAINER_ASSIGNED`
- `TRAINER_ASSIGNMENT_UPDATED`
- `TRAINER_ASSIGNMENT_REVOKED`

**LMS courses / micro-credential enrollments**

- `COURSE_CREATED`
- `COURSE_UPDATED`
- `COURSE_PUBLISHED`
- `COURSE_ARCHIVED`
- `enrollment_requested`
- `enrollment_approved`
- `enrollment_rejected`

**Institutional training**

- `TRAINING_PROGRAM_CREATED`
- `TRAINING_PROGRAM_PUBLISHED`
- `TRAINING_SESSION_UPDATED`
- `TRAINING_ATTENDANCE_SET`
- `TRAINING_MARK_ALL_PRESENT`
- `TASK_CREATED`
- `TASK_UPDATED`
- `MATERIAL_CREATED`
- `MATERIAL_UPDATED`
- `MATERIAL_FILE_REPLACED`
- `RECORDED_LECTURE_CREATED`
- `RECORDED_LECTURE_UPDATED`
- `RECORDED_LECTURE_FILE_REPLACED`
- `RECORDED_LECTURE_PUBLISHED`
- `RECORDED_LECTURE_UNPUBLISHED`
- `TRAINING_FINALIZED`
- `TRAINING_REOPENED`
- `FINAL_EVALUATION_REOPENED`

**Field Training**

- `FIELD_TRAINING_OPPORTUNITY_CREATED`
- `FIELD_TRAINING_OPPORTUNITY_UPDATED`
- `FIELD_TRAINING_OPPORTUNITY_PUBLISHED`
- `FIELD_TRAINING_OPPORTUNITY_ARCHIVED`
- `FIELD_TRAINING_APPLICATION_APPROVED`
- `FIELD_TRAINING_APPLICATION_REJECTED`
- `FIELD_TRAINING_STARTED`
- `FIELD_TRAINING_SUBMISSION_REVIEWED`
- `FIELD_TRAINING_ASSESSMENT_PUBLISHED`
- `FIELD_TRAINING_ASSESSMENT_UPDATED`
- `FIELD_TRAINING_PARTICIPANT_EXPELLED`
- `FIELD_TRAINING_EXPULSION_REQUESTED`
- `field_training.hours.update`
- `FIELD_TRAINING_ELIGIBILITY_RECALCULATED`
- `FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1`
- `FIELD_TRAINING_ATTENDANCE_WINDOW_OPENED`
- `FIELD_TRAINING_ATTENDANCE_WINDOW_CLOSED`
- `FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM`
- `FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE`
- `FIELD_TRAINING_ATTENDANCE_MARK_ALL_PRESENT`
- `FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT`
- `FIELD_TRAINING_COMPLETION_LETTER_ISSUED`
- `FIELD_TRAINING_COMPLETION_LETTER_REGENERATED`
- `FIELD_TRAINING_COMPLETION_LETTER_REVOKED`
- `FIELD_TRAINING_SUPERVISOR_ASSIGNMENTS_IMPORTED`
- `FIELD_TRAINING_TAFILA_APPROVED_RECONCILIATION`
- `FIELD_TRAINING_TASK_SUBMISSIONS_BULK_GRADED`
- `FT_EXCEL_EVALUATION_EXPORTED`
- `FT_EVAL_TEMPLATE_UPLOADED`
- `FT_EVAL_TEMPLATE_REPLACED`
- `FT_EVAL_TEMPLATE_DEFAULT_CHANGED`
- `FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED`
- `FT_EVAL_POLICY_CHANGED`
- `FT_EVAL_MANUAL_RATING_SAVED`
- `FT_EVAL_BULK_ELIGIBLE_RATING_SAVED`
- `FT_EVAL_BULK_ELIGIBLE_RATING_APPLIED`
- `FT_EVAL_REPORT_GENERATED`
- `FT_EVAL_REPORT_REGENERATED`
- `FT_EVAL_BULK_ZIP_DOWNLOADED`
- `FT_EVAL_SUPERVISOR_ZIP_DOWNLOADED`
- `FT_EVAL_ALL_SUPERVISOR_ZIP_DOWNLOADED`
- `FT_EVAL_ACADEMIC_SUPERVISOR_SYNC`

**Reports / certificates / integrity**

- `report.read`
- `report.export`
- `certificate.issue`
- `certificate.status`
- `recognition_request.status`
- `integrity_case.reported`

**CMS / notifications / popups**

- `HELP_CATEGORY_CREATED` / `HELP_CATEGORY_UPDATED` / `HELP_CATEGORY_ARCHIVED`
- `HELP_ARTICLE_CREATED` / `HELP_ARTICLE_UPDATED` / `HELP_ARTICLE_PUBLISHED` / `HELP_ARTICLE_UNPUBLISHED` / `HELP_ARTICLE_ARCHIVED` / `HELP_ARTICLE_VERSION_RESTORED` / `HELP_ARTICLES_REORDERED`
- `USER_GUIDE_CREATED` / `USER_GUIDE_UPDATED` / `USER_GUIDE_PUBLISHED` / `USER_GUIDE_ARCHIVED`
- `popup_created` / `popup_updated` / `popup_published` / `popup_paused` / `popup_archived`
- `announcement.create` / `announcement.publish` / `announcement.pause` / `announcement.archive` / `announcement.duplicate`
- `NOTIFICATION_RULE_CREATED` / `NOTIFICATION_RULE_UPDATED` / `NOTIFICATION_RULE_${status}`
- `NOTIFICATION_TEMPLATE_CREATED`
- `NOTIFICATION_DELIVERY_RETRY`
- `NOTIFICATION_MANUAL_SEND`

**Seed/script actions also written to the same table**

- `training_assessment.publish`
- `training_evaluation_template.seed`
- Various one-off `OPERATION_ID` script constants (same pattern as the 140-hours backfill)

---

## 10. Typical audit record content

Schema columns (`audit_logs`):

| Field | Stored? |
| ----- | ------- |
| actor user | **YES** — `user_id` (nullable) |
| actor role | **NO column.** Sometimes inside `new_values.role` (Field Training evaluation helper) |
| organization | **YES** — `organization_id` (nullable; many university flows omit it) |
| university | **YES** — `university_id` (nullable) |
| target entity | **YES** — `entity_type` |
| target ID | **YES** — `entity_id` (nullable UUID) |
| action | **YES** — `action_type` |
| before value | **YES** — `old_values` JSON (optional) |
| after value | **YES** — `new_values` JSON (optional) |
| metadata | **Partial** — only whatever callers put in `old_values`/`new_values` |
| IP address | **YES if caller passes it** — `ip_address`. Many service calls omit it. Login **does** pass `req.ip` / `x-forwarded-for`. |
| user agent | **NO** |
| request ID | **NO** |
| timestamp | **YES** — `created_at` |

Example of a successful login row (fields, not values):

- `action_type`: `USER_LOGIN_SUCCESS`
- `entity_type`: `user`
- `entity_id`: user UUID
- `new_values`: `{ source: 'password_login', portalType }`
- `ip_address`: from the login controller

`USER_UPDATED` stores name/email/phone/status/university/specialty in `old_values`; role changes appear as `new_values.role_codes`. Password hashes are **not** copied into that snapshot. `USER_PASSWORD_RESET` stores only `{ resetBy }` (no password).

---

## 11. Audit coverage gaps (code-based)

Important actions **not** written to `audit_logs` (or equivalent dedicated audit table):

| Gap | Evidence |
| --- | -------- |
| Failed login | `auth.service.js` `login()` throws 401; no `recordAudit` |
| Logout | Client-only; `logout()` returns a message, no DB write |
| Token refresh / revoke | No refresh-token architecture |
| Account lock / suspicious login | No lockout or geo/IP anomaly feature |
| File upload / confirm / signed GET / delete | `files.service.js` has no `recordAudit` |
| Unauthorized file attempt | 403 only |
| Field Training PRE/POST **submit** | Attempt row persisted; **no** `recordAudit` on `submitAssessment` |
| Late/closed attempt rejection | Throws `ASSESSMENT_CLOSED`; not stored as an event |
| Institutional PRE/POST submit | `trainingAssessment.service.js` has **no** `recordAudit` |
| Grade create/update (micro-credential `grades` module) | no `recordAudit` |
| Completion letter **download** (single or issued ZIP) | Issue/revoke audited; download path is not |
| Certificate **download** / verify-by-code | Issue/status audited; download/verify not |
| Recorded lecture **playback** / signed URL creation | Playback URL helper has no audit |
| Recorded lecture delete uses `RECORDED_LECTURE_UPDATED` with `{ deleted: true }` rather than a delete action | `courseContent.service.js` |
| YouTube playlist preview/import | Preview has no audit; course lesson create is not lecture-audit |
| 4xx authorization denials | Not logged |
| Role change as a first-class event | Only `USER_UPDATED` + `role_codes` |
| Eligibility override as its own action | Recalc is audited (`FIELD_TRAINING_ELIGIBILITY_RECALCULATED`); silent column edits would not be unless they go through that path |
| Assessment **start** (FT) | Attempt `created_at` is start; no audit event |

Covered (not gaps): role-ish updates via `USER_UPDATED`; certificate issue/status; completion letter issue/regenerate/revoke; evaluation generate + bulk ZIP download; many admin FT attendance/hours/expel/publish actions.

---

## 12. Authentication logging

| Event | Database | Logger only | Neither |
| ----- | -------- | ----------- | ------- |
| Successful login | **YES** `audit_logs` `USER_LOGIN_SUCCESS` + `users.last_login_at` | no extra logger line | |
| Failed login (bad email/password) | NO | NO | **YES** |
| Email not verified / inactive / rejected / suspended | NO | NO | **YES** (HTTP 403) |
| Logout | NO | NO | **YES** |
| Token refresh | N/A | N/A | no refresh tokens |
| Password change (self reset complete) | **YES** `PASSWORD_RESET_COMPLETED` | NO | |
| Admin password reset | **YES** `USER_PASSWORD_RESET` | NO | |
| Reset request | **YES** `PASSWORD_RESET_REQUESTED` + OTP row | email skip/fail on logger | |
| Reset OTP verified | **YES** `PASSWORD_RESET_OTP_VERIFIED` | NO | |
| Session create/revoke | NO session store | NO | JWT issued in memory |
| Account lock | N/A | N/A | not implemented |
| Suspicious login | N/A | N/A | not implemented |
| IP | login audit `ip_address` | Morgan `:remote-addr` on every request | |
| User agent | NO in audit | Morgan `dev` format locally may include it; production format **does not** | |
| Device | NO for auth | | |
| Timestamp | `audit_logs.created_at`, `users.last_login_at` | logger `ts` | |

OTP tables store **hashes**, attempt counts, expiry, `used_at` — security records, not a login history.

---

## 13. Session / JWT architecture

**No auth session table.** Prisma `sessions` is a **cohort lecture/session** model, not a login session.

| Item | Finding |
| ---- | ------- |
| Table/model | **None** for JWT/session |
| Session ID | **None** |
| Refresh token metadata | **None** |
| Expiry | JWT `expiresIn` from `JWT_EXPIRES_IN` (default `'7d'`) inside the token |
| Revoked state | **None.** Logout is client token discard |
| IP / device / last activity on session | **None** |
| Last activity | `users.last_login_at` only |

Token payload (claims only, not values): `userId`, `roles`, `universityId`, `isGlobal`, `portalType`. Auth middleware **does not trust token roles**; it reloads authorization from the database.

Frontend persists the JWT in `localStorage` key `battechno_lms_auth_token` (via `storageKeys.authToken`).

---

## 14. Request logging

**Every HTTP request except `/health` and `/health/ready` is logged by Morgan** when `NODE_ENV !== 'test'`.

Production format:

```text
:remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]
```

| Field | Logged? |
| ----- | ------- |
| method | YES |
| URL/path | YES (`:url` includes **query string**) |
| status | YES |
| response time | YES |
| request ID | YES (`x-request-id` request header token; middleware also sets response `X-Request-Id`) |
| user ID | **NO** |
| organization | **NO** |
| IP | YES (`:remote-addr`; `trust proxy` is `1`) |
| user agent | production format: **NO**; `dev` format: YES |
| body | **NO** |
| query values | **YES** as part of `:url` |

### Sensitive request logging risk

Auth middleware accepts Bearer tokens from query `access_token` or `token` on **GET** (for `/uploads` in a new tab). Morgan will log that full URL. Classification: **SECRET** if a JWT appears in access logs.

---

## 15. Request IDs

| Topic | Implementation |
| ----- | -------------- |
| Generation | Incoming `x-request-id` (trimmed, max 128) **or** `crypto.randomUUID()` |
| Response header | `X-Request-Id` |
| Logger | Morgan production format includes `:req[x-request-id]`; error middleware logs `requestId` |
| Error JSON | `requestId` field. Error middleware **reformats** to `REQ-` + 12 hex chars from `req.id` |
| Database | **Not stored** |
| Lifecycle | Request-scoped only |

Clients can supply `x-request-id`; it is trusted up to 128 characters (log injection / correlation spoofing is possible, not a secret leak).

---

## 16. Error logging

Global handler: `backend/src/middlewares/error.middleware.js`.

| Item | 5xx ApiError | Unhandled |
| ---- | ------------ | --------- |
| message | YES (internal log); user gets sanitized Arabic/catalog message | YES internally; generic user message |
| stack | non-production only | non-production only |
| error code | `apiErr.code` | `SERVER_ERROR` to client; `prismaCode` in log if present |
| request information | `requestId` only | `requestId` only |
| authenticated user | **NO** | **NO** |
| Prisma | mapped P2002/P2025/other `P*` to ApiError; other Prisma codes → 500 | `prismaCode` logged |
| External provider | only if thrown as Error/ApiError | message string |

Client 4xx (validation, 401, 403) is **not** logged.

### Accidental secret inclusion

| Source | Risk |
| ------ | ---- |
| Error middleware log object | Does **not** dump `req.body`, headers, cookies, or env. Relatively **SAFE** |
| `server.js` `console.error(..., err)` / unhandledRejection | Full Error objects; Prisma sometimes embeds connection info → **CRITICAL_SECRET** possible |
| Morgan `:url` | JWT query param → **SECRET** |
| Email logger | OTP **not** logged; `to` masked → **PII** (partial email) |
| Notification logger | truncated `error` strings; userId UUID → low |

Passwords in `req.body` are not logged by error middleware. Login 401 never hits the 5xx logger.

---

## 17. Frontend logging

Meaningful `console.*` in `frontend/src`:

| Location | Classification |
| -------- | -------------- |
| `components/ErrorBoundary.jsx` `console.error('ErrorBoundary caught:', error, info)` | **error handling**, **production-visible** in browser console |
| `pages/admin/SuperAdminAnalyticsPage.jsx` three `console.error(e)` in catch | **error handling**, **production-visible** |

No frontend logger wrapper, no Sentry, no analytics SDK (`gtag` / Mixpanel / PostHog absent). Internal “analytics” pages are **LMS business reports**, not product telemetry.

Frontend logs are **not persisted** by the application.

---

## 18. Browser storage (auth / tracking related)

`frontend/src/utils/storage.js`:

| Key | Store | Content class |
| --- | ----- | ------------- |
| `battechno_lms_auth_token` | localStorage | **SECRET** (JWT) |
| `battechno_lms_auth_user` | localStorage | **PII** (cached user profile) |
| `battechno_lms_pending_verification_email` | localStorage | **PII** |
| `battechno_lms_pending_password_reset_email` | localStorage | **PII** |
| `battechno_lms_password_reset_token` | **sessionStorage** | **SECRET** (reset token JSON) |
| `battechno_lms_locale` | localStorage | not sensitive |
| `battechno_lms_tenant_scope` | localStorage | org scope simulation |
| `battechno_lms_last_portal` | sessionStorage | portal type |
| popup/announcement viewed sets | sessionStorage | UX tracking, not audit |
| attendance window notified set | sessionStorage | UX tracking |

No IndexedDB usage found for logging. No JS cookie library usage found for auth (token is localStorage, not a cookie).

---

## 19. Field Training logging vs business history

| Topic | Business/authoritative data | Audit / extra history |
| ----- | --------------------------- | --------------------- |
| Applications | `field_training_applications` status, notes, reviewer, timestamps | `FIELD_TRAINING_APPLICATION_APPROVED` / `REJECTED` |
| Training start | `training_started_at`, `training_status` | `FIELD_TRAINING_STARTED` |
| Owner/admin decisions | application columns + eligibility JSON | hours update, eligibility recalc, expel/request expel |
| Assessments | `field_training_assessments` + `closes_at`; attempts with `answers` / `score` | publish/update audited; **submit not audited** |
| Task submissions | `field_training_task_submissions` + files | `FIELD_TRAINING_SUBMISSION_REVIEWED` (and bulk grade script) |
| Attendance | `field_training_attendance` including `ip_address`, `device_info`, method | window open/close, electronic confirm, manual, mark-all, finalize absent |
| Behavior evaluation | `field_training_supervisor_ratings` | `FT_EVAL_MANUAL_RATING_SAVED` / bulk variants |
| Eligibility | application `completion_eligibility_status` + `eligibility_reason` | `FIELD_TRAINING_ELIGIBILITY_RECALCULATED` |
| Reports | `field_training_final_evaluations` versioned snapshots + files | generate/regenerate + ZIP download actions; `report.read`/`report.export` on dashboards |
| Completion letters | `field_training_completion_letters` + `field_training_completion_letter_jobs` | issued / regenerated / revoked; **download not audited** |
| Supervisor Excel import | batches + `field_training_supervisor_import_audit` | plus `FIELD_TRAINING_SUPERVISOR_ASSIGNMENTS_IMPORTED` |

Student-facing activity feed is a **read model over `audit_logs`**, not a separate table (`fieldTraining.activityTranslate.js`).

---

## 20. Recorded Lectures logging

Institutional Recorded Lectures are **`training_materials` rows** with `material_type = 'RECORDED_LECTURE'`.

| Action | Stored how |
| ------ | ---------- |
| Create | material row + `RECORDED_LECTURE_CREATED` |
| Update | material row + `RECORDED_LECTURE_UPDATED` or `RECORDED_LECTURE_FILE_REPLACED` |
| Publish / hide | `is_published` + `RECORDED_LECTURE_PUBLISHED` / `UNPUBLISHED` |
| Reorder | `sort_order` on update (`RECORDED_LECTURE_UPDATED` if that path is used) |
| Delete | row deleted + audit `RECORDED_LECTURE_UPDATED` with `{ deleted: true }` |
| Playlist import (YouTube) | **LMS courses** (`course_lessons` + YouTube preview API), **not** the institutional recorded-lecture table. Preview is **not** audited. |
| Playlist sync | **No sync job** found; preview is on-demand fetch |
| Student watch progress / sessions / heartbeats / segments / completion / last position | **No tables, no API, no player heartbeat** |

Player (`RecordedLecturePlayerPage.jsx`) loads a signed/local URL and plays media. No progress callbacks.

**Every heartbeat is NOT stored.** There are no heartbeat records.

YouTube LMS course lessons use `course_lesson_progress` (`is_completed` boolean only) — still not heartbeat storage.

---

## 21. Watch tracking storage

The fields below **do not exist** in Prisma or services:

| Field | Table/model | Persistence | Update frequency | Retention |
| ----- | ----------- | ----------- | ---------------- | --------- |
| uniqueWatchedSeconds | **NONE** | — | — | — |
| totalPlaybackSeconds | **NONE** | — | — | — |
| lastPositionSeconds | **NONE** | — | — | — |
| progressPercentage | **NONE** (course lessons only have `is_completed`) | — | — | — |
| startedAt | **NONE** for lectures | — | — | — |
| lastWatchedAt | **NONE** | — | — | — |
| completedAt | `course_lesson_progress.completed_at` **only** for LMS course lessons, not institutional recorded lectures | row update | on complete | no TTL |
| watch segments | **NONE** | — | — | — |
| watch session IDs | **NONE** | — | — | — |
| heartbeat sequence/idempotency | **NONE** | — | — | — |

---

## 22. Heartbeat volume

**Architecture does not store one row per heartbeat.** Heartbeats are not implemented.

`ESTIMATE` below is **what would happen if a future 10-second heartbeat wrote a row**, not current behavior:

Example (not real traffic): 150 students × 10 lectures × 60 minutes × 6 heartbeats/minute = **540,000 rows per full watch-through**.

**Current behavior:** playback does not persist watch events. Volume from recorded lectures is **LOW** (material metadata + occasional audit rows).

---

## 23. Notifications

`notifications` stores: title, body, type, action URL/label, recipient `user_id`, `event_type`, category, priority, `entity_type`/`entity_id`, rule/template/actor ids, read/ack/archive/click timestamps, `deduplication_key`, `is_critical`, `requires_acknowledgement`.

`notification_deliveries` stores channel, status, attempt_count, `provider_message_id`, sent/delivered/failed timestamps, `failure_code`, `failure_message_safe`.

**Retention/deletion:** archive is a user/API `archived_at` flag. **No scheduled purge of old notifications.**  
`NO RETENTION POLICY FOUND`

---

## 24. Email / message logs

| Channel | Persistence of send result |
| ------- | -------------------------- |
| Email (Resend) | OTP send: logger only (masked `to`). Notification-engine EMAIL channel: `notification_deliveries` row + `provider_message_id` | 
| SMS | **Not implemented** |
| WhatsApp | **Not implemented** |
| In-app | `notifications` rows |
| Mobile push | `mobile_push_registrations.last_delivery_error` (+ FCM token) |

OTP **content is not** written to logger. Email HTML/text is sent to Resend; not stored in DB except insofar as in-app notification body is stored for IN_APP.

---

## 25. File operations

| Operation | Persisted | Logged / audited |
| --------- | --------- | ---------------- |
| Upload (presign + confirm) | `files` row | NO audit |
| Local multer / `storePrivateBuffer` | `files` row | NO audit (unless a parent flow audits, e.g. eval template upload) |
| Download / signed GET | **No access table** | NO |
| Delete | `files.deleted_at` soft delete | NO audit |
| Signed URL creation | ephemeral | NO |
| Unauthorized attempt | NO | HTTP 403 only |

`files` is an authoritative registry (name, storage_key, mime, size, related entity), not an access log.

---

## 26. Report generation logging

| Kind | Request/job row | Status | Output | Requester | Timestamp | Errors | Student content in logs |
| ---- | --------------- | ------ | ------ | --------- | --------- | ------ | ----------------------- |
| Generic `/reports` | `audit_logs` `report.read` / `report.export` | n/a | returned in HTTP | `user_id` | `created_at` | via error middleware | `new_values.summary` may include aggregates, not full student dumps |
| Field Training dashboards/exports | same `report.*` on `entity_type=field_training_report` | n/a | HTTP file | yes | yes | logger on PDF failures | export files contain student data **in the file**, not in audit JSON by design of controllers reviewed |
| FT official evaluation | `field_training_final_evaluations` + `FT_EVAL_REPORT_*` | versioned | `pdf_file_id` / docx | `generated_by_id` | `generated_at` | job/error fields on letter jobs; eval generate throws | snapshot JSON on evaluation row **does** hold scores/comments (**PII**) |
| Institutional training reports | `training_official_reports`, `training_individual_reports`, `training_course_reports` | `status` | pdf/excel paths | `generated_by` | `generated_at` | status string | `snapshot_json` **contains report content (PII)** |
| Completion letter bulk | `field_training_completion_letter_jobs.payload/progress/error_message` | queued/running/completed/failed | letters table | `created_by_id` | timestamps | `error_message` | payload may reference application ids |

No generic report queue table for all PDF/Excel types. Many reports are synchronous HTTP.

---

## 27. Certificates and completion letters

### Micro-credential `certificates`

- Issuance record: **YES** (`certificates` + `certificate.issue` audit)
- Status changes: **YES** (`certificate.status`)
- `createdBy`: **not a column**; actor is audit `user_id`
- Download history: **NO**
- Timestamp: `issued_at`

### Institutional `training_certificates`

- Issuance/status columns exist (`issued_at`, `revoked_at`, `issued_by`)
- Not wired through the micro-credential `dispatchAppEvent` helper (separate model)

### Field Training completion letters

- Issuance record: **YES** (`field_training_completion_letters`)
- Audit: `FIELD_TRAINING_COMPLETION_LETTER_ISSUED` / `REGENERATED` / `REVOKED`
- `issued_by_id`, `issued_at`, `status`, `pdf_url`, `verification_code`, `metadata`
- Download history: **NO** dedicated table or audit action
- Bulk jobs: `field_training_completion_letter_jobs`

---

## 28. Assessment logging (PRE/POST)

### Field Training (`field_training_assessment_attempts`)

| Item | Stored? |
| ---- | ------- |
| Attempt start | `created_at` (upsert); no separate start event |
| Answers | `answers` JSON |
| Submission | `submitted_at` |
| Score / max / level | YES |
| Passing | derived vs `passing_score`; copied onto application pre/post score |
| Closing deadline | `field_training_assessments.closes_at` |
| Late rejection | HTTP `ASSESSMENT_CLOSED`; **not logged** |

Treat answers as **persisted assessment history (PII / SENSITIVE)**, not operational logs.

Admin publish/update of the assessment **is** audited.

### Institutional training (`training_assessment_attempts`)

`started_at`, `submitted_at`, `answers_json`, `score`, `status`, `attempt_no`. Notifications may fire (`PRE_TEST_SUBMITTED` etc.). **No `recordAudit`.**

### Micro-credential `assessments` / `submissions` / `grades`

Authoritative academic records. `dispatchAppEvent` used for overdue/ungraded **notifications**, not a full attempt audit log.

---

## 29. Admin actions — actual coverage

| Operation | Audited? |
| --------- | -------- |
| Changing roles | Partial (`USER_UPDATED` + `role_codes`) |
| Organization assignments | `ORG_ASSIGNMENT_CREATED` (create path) |
| Creating FT opportunities | YES |
| Publishing content (courses, FT, training programs, lectures, assessments) | YES on those paths |
| Modifying student results (FT task review, Tafila reconcile, hours) | YES on those service paths |
| Overriding eligibility | YES if via `recalculateEligibility` / backfill operation |
| Issuing documents (certificates, letters, eval reports) | YES for issue/generate; **not** for every download |
| Creating opportunities | YES |
| File delete | NO |
| Gradebook `grades` module | NO |

---

## 30. Prisma query logging

`backend/src/config/db.js`:

- Default production: `log: ['error']` (stdout)
- Development: `['error', 'warn']`
- When `PERF_LOGGING=true|1`: query **events** (`emit: 'event'`) plus stdout `error`

`prisma.$on('query')` records `durationMs`, `target`, and SQL **truncated to 180 chars**. Bind parameters (`e.params`) are **not** copied into that summary.

`perfTiming.middleware.js` prints slow requests and the slowest queries to stdout when enabled. It states it does not log query strings, headers, cookies, bodies, or SQL parameters (path is stripped of `?`).

**Full SQL with parameters is not enabled in default production.** Enabling `PERF_LOGGING` in production would raise **performance** cost and leak **SQL shape** (usually placeholders, still sensitive table/column names). Classification if misused: **PII** possible, **SENSITIVE** schema disclosure, not typically password values.

---

## 31. Database connection logging

| Signal | Behavior |
| ------ | -------- |
| Startup connect fail | `console.error('Failed to connect to the database.', err)` then process exit |
| `/health/ready` disconnect | HTTP 503 JSON; **no logger** |
| Transient P1017 / connection reset | `withDbRetry` retries silently; no per-retry log |
| Pool timeout P2024 | surfaced as Prisma error → 500 logger if unhandled |
| P1001 | not specially handled; would appear as connect/query failure |

Destination: stdout/stderr. Persistence: **OUTPUT ONLY**.

---

## 32. External provider logging

| Provider | Request log | Failure | Secrets |
| -------- | ----------- | ------- | ------- |
| Resend | no request dump | logger error + masked `to`; notification delivery failure fields | `RESEND_API_KEY` not logged |
| YouTube RSS / Data API / oEmbed | **no logger** | HTTP `ApiError`; quota → 503 message | URL is built with `key=apiKey`. **Not logged today.** If a future logger prints the fetch URL, that is **CRITICAL_SECRET** (`YOUTUBE_API_KEY`) |
| R2 / local storage | errors become ApiError 503 | not detailed | R2 env names not printed in success path |
| Gemini / OpenAI | `console.error` unsupported Gemini model name; startup warns if key missing (name only) | | keys not printed |
| Firebase push | last error string on registration row | | token is **SECRET** in DB |

---

## 33. Docker local logging

`docker-compose.yml` defines `backend` and `frontend` only. **No `logging:` block**, no `max-size`, no `max-file`.

Dockerfiles: backend `CMD npm start`; frontend Nginx `daemon off`. No log file paths.

**Local Docker CLI:** not installed in this environment (`docker` is not a recognized command). Live `docker inspect` of logging driver was **not** performed.

From compose file alone:

- Driver: **not explicitly configured** (Docker default is typically `json-file`)
- Rotation: **not configured in repo**
- If defaults apply with no daemon `log-opts`, container logs can grow until disk pressure

---

## 34. Nginx configuration in repository

Files:

- `frontend/nginx.conf` (SPA + `/api` proxy to `backend:4000`)
- `deploy/nginx-lms.battechno.com.conf` (TLS vhost proxy to `127.0.0.1:8080`)

**Neither file sets `access_log`, `error_log`, or `log_format`.**

What would be logged is therefore **whatever the host or `nginx:1.27-alpine` image default is** (commonly access log + error log, often stdout in official images). This audit cannot assert production host Nginx logging without accessing the server (forbidden).

No request body logging is configured in repo files.

---

## 35. Log rotation

| Mechanism | Found? |
| --------- | ------ |
| Docker `max-size` / `max-file` | **NO** in compose |
| `logrotate` config in repo | **NO** |
| Application file rotate | **NO** |
| DB TTL / archive job | **NO** |
| `deleteMany` on audit/notifications by age | **NO** (only demo cleanup scripts / entity-scoped deletes) |

In-memory TTLs exist for **auth context cache** and **role permission cache** — not log retention.

---

## 36. Database retention

For audit/event/history tables:

**NO RETENTION POLICY FOUND**

Demo/seed scripts can `deleteMany` audit rows for demo universities; that is tooling, not production retention.

OTP rows expire functionally (`expires_at`) but are **not auto-deleted**.

---

## 37. PII and sensitive data in logs

| Data | Where | Class |
| ---- | ----- | ----- |
| Full names | `audit_logs` old/new JSON; notifications; report snapshots | **PII** |
| University numbers | evaluation snapshots / applications, not typically Morgan | **PII** |
| Emails | `USER_UPDATED` snapshots; notifications `templateVars.email`; logger masked email | **PII** |
| Phone | `USER_UPDATED` old_values | **PII** |
| IP | `audit_logs.ip_address`; Morgan; FT attendance `ip_address` | **PII** |
| User agent | FT attendance `device_info`; support tickets `browser_info`/`device_info`; Morgan `dev` | **PII** |
| JWT | localStorage; possible Morgan query string | **SECRET** |
| Cookies | not used for auth; not logged | SAFE (absent) |
| Authorization header | not in Morgan tokens | SAFE unless custom middleware added |
| Passwords | not in audit snapshots; not in logger | SAFE in current logger paths |
| Password hashes | `users.password_hash` DB only, not audit JSON | **SENSITIVE** in DB (expected) |
| Assessment answers | attempt JSON columns | **SENSITIVE** + **PII** |
| Report snapshot_json | training/FT evaluation tables | **PII** / **SENSITIVE** |
| File paths / storage_key | `files` table | **SENSITIVE** |
| API keys | not printed by reviewed loggers | SAFE unless YouTube URL logged |
| DATABASE_URL | possible in Prisma Error dumps on crash | **CRITICAL_SECRET** if dumped |

---

## 38. Secret leak search (variable names only)

Reviewed insertions of `process.env` / secrets into logs:

| Name | Logged? |
| ---- | ------- |
| `DATABASE_URL` | not explicitly; Prisma errors on connect **may** include it |
| `YOUTUBE_API_KEY` | used as query `key=` in fetch URL; **URL not logged** in current code |
| `JWT_SECRET` | used to sign/verify; not logged. Dev fallback string exists in `jwt.js` if unset (non-production) |
| `RESEND_API_KEY` | not logged; absence is logged as a warning |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | missing-key **names** in startup warnings, not values |
| `Authorization` / `Cookie` | not in Morgan format |
| `password` / `refreshToken` | no refresh token; passwords not logged by middleware |
| Login body | not logged server-side; **mobile debug LogInterceptor logs requestBody** (could include password in debug) |

---

## 39. Logging volume risks

| Source | Volume | Why |
| ------ | ------ | --- |
| Morgan every HTTP request | **HIGH** | All API + static `/uploads` except health |
| `USER_LOGIN_SUCCESS` audit | **MEDIUM** | One row per successful login, never purged |
| `report.read` audit | **HIGH** | Dashboard/report page loads write DB rows |
| Notifications + deliveries | **HIGH** | Domain events fan out to many users |
| `help_search_logs` / `help_article_views` | **MEDIUM** | One row per search/view |
| Prisma query logging | **VERY_HIGH** if `PERF_LOGGING` on | Every query event |
| Recorded lecture heartbeats | **N/A** | not stored |
| Polling `/me` etc. | **HIGH** in Morgan only | no DB write |

---

## 40. Duplicated logging

Examples of the same user action producing multiple records:

1. Successful login → Morgan line **+** `audit_logs` **+** `users.last_login_at`
2. Certificate issued → `certificates` row **+** `certificate.issue` audit **+** in-app notification
3. FT evaluation generate → versioned `field_training_final_evaluations` **+** `FT_EVAL_REPORT_GENERATED`
4. Notification emit → `notifications` **+** `notification_deliveries` **+** logger on failure **+** sometimes `recordAudit` (manual send / rule changes)
5. Report page → Morgan **+** `report.read` audit
6. 5xx → Morgan error status **+** custom logger error

Not all duplication is wasteful (audit vs access log vs business row serve different purposes), but `report.read` on every GET is a high-churn duplicate of Morgan.

---

## 41. Missing retention — can stores grow forever?

| Store | Grow indefinitely? | Concern |
| ----- | ------------------ | ------- |
| `audit_logs` | **YES** | **HIGH** (logins + report.read) |
| `notifications` + deliveries | **YES** | **HIGH** |
| `help_search_logs` / `help_article_views` | **YES** | **MEDIUM** |
| `field_training_final_evaluations` (versions kept) | **YES** | **MEDIUM** |
| `training_*_reports` snapshots | **YES** | **MEDIUM** |
| `kpi_snapshots` | **YES** if jobs write often | **MEDIUM** (writer frequency unknown; no cron in `server.js`) |
| OTP tables | **YES** (expired rows remain) | **LOW** |
| `files` including soft-deleted | **YES** | **MEDIUM** |
| stdout Docker json-file | **YES** if compose used without log-opts | **HIGH** at HTTP volume |
| Heartbeat table | N/A | — |

---

## 42. Database table summary (logging / history)

| Model/Table | Purpose | Log/History Type | Persistent | Expected Volume | Retention |
| ----------- | ------- | ---------------- | ---------- | --------------- | --------- |
| `audit_logs` | Append-only action trail | E audit | YES | HIGH | NO RETENTION POLICY FOUND |
| `notifications` | In-app messages | E history | YES | HIGH | NO RETENTION POLICY FOUND |
| `notification_deliveries` | Channel attempts | E delivery log | YES | HIGH | NO RETENTION POLICY FOUND |
| `notification_scheduled_jobs` | Future/due jobs | E job log | YES | LOW–MED | NO RETENTION POLICY FOUND |
| `notification_digests` | Digest batches | E | YES | LOW–MED | NO RETENTION POLICY FOUND |
| `help_search_logs` | Search queries | E | YES | MEDIUM | NO RETENTION POLICY FOUND |
| `help_article_views` | Article views | E | YES | MEDIUM | NO RETENTION POLICY FOUND |
| `help_article_versions` | CMS versions | F/E | YES | LOW | none |
| `email_verification_otps` | OTP security | E security | YES | LOW | expiry, no delete |
| `password_reset_otps` | Reset security | E security | YES | LOW | expiry, no delete |
| `account_deletion_requests` | Deletion workflow | E | YES | LOW | none |
| `integrity_cases` | Integrity | E/F | YES | LOW | none |
| `risk_cases` | Risk | E/F | YES | LOW | none |
| `qa_reviews` / `corrective_actions` | QA | F | YES | LOW | none |
| `field_training_supervisor_import_audit` | Import audit | E | YES | LOW–MED | none |
| `field_training_supervisor_import_batches` | Import batches | E | YES | LOW | none |
| `field_training_completion_letter_jobs` | Bulk jobs | E job | YES | LOW | none |
| `field_training_completion_letters` | Letter issuance | F | YES | MEDIUM | none |
| `field_training_final_evaluations` | Official eval snapshots | F history | YES | MEDIUM | none (versions kept) |
| `field_training_assessment_attempts` | PRE/POST answers | F | YES | MEDIUM | none |
| `field_training_attendance` | Attendance + IP/device | F | YES | MEDIUM | none |
| `field_training_attendance_window_attempts` | Code-guess tracking | E | YES | LOW | none |
| `field_training_applications` | Enrollment lifecycle | F | YES | MEDIUM | none |
| `training_finalization_events` | Close/reopen events | E | YES | LOW | none |
| `training_official_reports` | Versioned reports | F/E | YES | MEDIUM | none |
| `training_individual_reports` | Per-enrollee snapshots | F | YES | MEDIUM | none |
| `training_course_reports` | Course snapshots | F | YES | LOW–MED | none |
| `training_assessment_attempts` | Course tests | F | YES | MEDIUM | none |
| `training_certificates` / `certificates` | Issuance | F | YES | LOW–MED | none |
| `kpi_snapshots` / `kpi_alerts` | KPI history | E | YES | UNKNOWN | none |
| `files` | File registry + soft delete | F | YES | MEDIUM | none |
| `mobile_push_registrations` | Devices + delivery errors | E/F | YES | LOW | none |
| `users` (`last_login_at`) | Last success login | F | YES | 1/user | n/a |
| `course_lesson_progress` | Lesson complete flags | F | YES | MEDIUM | none |
| `support_tickets` | Tickets + device info | F | YES | LOW | none |
| HTTP requests | — | A/C only | NO | HIGH | n/a |
| Watch heartbeats | — | none | NO | — | — |

Classification letters: A terminal, C Docker, E DB audit/history, F business-as-history.

---

## 43. Application logger summary

| Logger | Code Location | What It Logs | Destination | Persistent | Rotation |
| ------ | ------------- | ------------ | ----------- | ---------- | -------- |
| Custom `log()` | `backend/src/utils/logger.js` | app events/errors | stdout/stderr | NO | n/a |
| Morgan | `requestLogger.middleware.js` | HTTP access | stdout | NO | n/a |
| Prisma log | `config/db.js` | engine error/warn; optional queries | stdout / ALS | NO | n/a |
| Perf timing | `perfTiming.middleware.js` | slow req + SQL snippet | stdout | NO | n/a |
| `console.*` server | `server.js` | lifecycle, crashes | stdout/stderr | NO | n/a |
| Browser console | ErrorBoundary, analytics page | UI errors | browser | NO | n/a |
| Dio LogInterceptor | mobile `api_client.dart` | HTTP debug incl. request body | debug console | NO | n/a |
| `recordAudit` | `audit.service.js` | domain actions | PostgreSQL | YES | none |
| Nginx (repo) | no directives | defaults only if deployed | unknown locally | unknown | unknown |

---

## 44. Module logging summary

| Module | What Is Stored | Storage | Risk |
| ------ | -------------- | ------- | ---- |
| Auth | success login audit + `last_login_at`; OTP hashes; no fail log | DB + stdout | Failed-login gap; JWT in query logs |
| Users | create/update/status/roles/password-reset/export audits | `audit_logs` | PII in JSON |
| Organizations | org/branch/dept/assignment/account activate-reject-disable | `audit_logs` | LOW–MED |
| Field Training | rich business history + many audits; attempts/answers; letters; eval versions | many tables + `audit_logs` | HIGH data volume of student PII; audit gaps on submit/download |
| Courses | course CRUD audit; lesson progress booleans; YouTube preview not audited | `audit_logs` + progress | LOW |
| Micro-Credentials | versions, enrollments, submissions, grades, certificates | F tables; limited audits | grade changes not audited |
| Assessments | FT + training + MC attempts | attempt tables | answers retained forever |
| Attendance | FT records with IP/device; training attendance; MC `attendance_records` | F | IP PII |
| Tasks | submissions + review audits | F + audit | MEDIUM |
| Notifications | in-app + deliveries + jobs | E | HIGH unbounded |
| Files | registry + soft delete; no access audit | `files` | orphaned objects; no access trail |
| Reports | audit on read/export; snapshot tables for official/training/FT eval | E+F | HIGH audit chatter; snapshot PII |
| Certificates | issuance + status audit | F+E | download not tracked |
| Recorded Lectures | material rows + CRUD/publish audits; no watch tracking | `training_materials` + audit | LOW volume; coverage gap on watch |

---

## 45. Storage classification of mechanisms

| Mechanism | Class |
| --------- | ----- |
| Custom logger / console / Morgan / Prisma stdout / perf | **A. Terminal only** (and **C** if Docker captures stdout) |
| Frontend `console.error` | **B. Browser console only** |
| Mobile `debugPrint` | **B** (device debug) |
| Docker json-file (compose default) | **C. Docker/local container log** |
| Application `*.log` files | **D — not implemented** |
| `audit_logs`, help logs, deliveries, jobs, import audit, KPI snapshots | **E. Database persistent audit/history** |
| Applications, attempts, letters, evaluations, certificates, files, attendance | **F. Business data that also acts as historical evidence** |
| Sentry/OTel/Datadog | **G — not present** as first-party |

---

## 46. Current logging architecture map

See §3.

---

## 47. Explicit answers

1. **Are application logs saved permanently?**  
   Application stdout/stderr: **no**. PostgreSQL audit/history: **yes**, without TTL.

2. **Are backend console/logger outputs saved to files?**  
   **No** in application code. Docker/Nginx defaults might capture them if those runtimes are used.

3. **Are logs stored in PostgreSQL?**  
   **Yes** — especially `audit_logs`, notifications, OTPs, help logs, jobs, and many history tables.

4. **Which PostgreSQL tables are logging/history tables?**  
   See §42. Primary: `audit_logs`.

5. **Are HTTP requests stored?**  
   **No** in the database. They are printed by Morgan (OUTPUT ONLY).

6. **Are user logins stored?**  
   **Successful** logins: yes (`USER_LOGIN_SUCCESS` + `last_login_at`).

7. **Are failed logins stored?**  
   **No.**

8. **Are admin actions stored?**  
   **Many are**, via `audit_logs`, but not all (files, grades module, downloads, FT assessment submit).

9. **Are report downloads stored?**  
   **View/export** of several report endpoints write `report.read` / `report.export`. FT evaluation **ZIP** downloads are audited. Not every PDF byte stream has a dedicated download history table.

10. **Are file downloads stored?**  
    **No** access history. `files` stores the object, not the download.

11. **Are every Recorded Lecture heartbeats stored?**  
    **No. Heartbeats are not implemented.**

12. **How much Recorded Lecture tracking data can accumulate?**  
    **Current: negligible** (one material row + rare audits). No watch telemetry.

13. **Are Prisma SQL queries logged?**  
    **Errors always.** Queries **only if `PERF_LOGGING` is enabled**. Default production: **no query log**.

14. **Are Docker logs rotated locally?**  
    **Not in compose.** Live driver unknown (Docker CLI missing). Default json-file often has **no size cap** unless the daemon sets one.

15. **Is there any log retention policy?**  
    **NO RETENTION POLICY FOUND** for DB history or app logs.

16. **Can any logging table grow forever?**  
    **YES** — `audit_logs`, notifications, help logs, versioned reports, etc.

17. **Are secrets or sensitive data being logged?**  
    **Risk yes:** JWT in GET query via Morgan; crash dumps of Prisma errors; PII in `audit_logs` JSON and report snapshots; mobile debug request bodies. Passwords/API keys are **not** intentionally logged.

18. **Which logging mechanisms create the highest storage risk?**  
    **`audit_logs` (especially `report.read` + logins)**, **notifications**, and **unrotated Docker/stdout access logs**.

---

## 48. Changes in this phase

None. Inspection and this report file only.

Suggested commit message (not executed):

```text
docs: audit local logging and persistent activity storage
```

---

## 49. Recommendations (do not implement in this phase)

### P0 — Security / secret exposure

**P0-1 JWT in access logs**  
- **Problem:** GET `/uploads` (and similar) may put JWT in `?access_token=` / `?token=`; Morgan logs `:url`.  
- **Current behavior:** query string is part of the access line.  
- **Risk:** long-lived JWT in stdout / Docker logs / future log shippers.  
- **Suggested future fix:** strip query from access logs; prefer short-lived cookie or header-only tokens; redact `access_token`/`token` if query must stay.

**P0-2 Prisma/Error object dumps on crash**  
- **Problem:** `console.error('Failed to connect…', err)` and unhandledRejection print full errors.  
- **Current behavior:** unstructured Error dump.  
- **Risk:** `DATABASE_URL` or internals in stderr.  
- **Suggested future fix:** log `err.code` + safe message only; never serialize full Prisma errors in production.

**P0-3 Mobile debug request bodies**  
- **Problem:** Dio `LogInterceptor(requestBody: true)` in debug/dev.  
- **Risk:** passwords on login in device logs.  
- **Suggested future fix:** redact `password`, `otp`, `resetToken`, `Authorization`.

### P1 — Unbounded storage / major volume

**P1-1 No retention on `audit_logs`**  
- **Problem:** append-only, including every login and many report reads.  
- **Risk:** table/index growth, slower admin audit UI.  
- **Suggested future fix:** retain N days; archive; stop auditing pure `report.read` or sample it.

**P1-2 Notifications never purged**  
- **Problem:** every domain event can insert notification + delivery rows.  
- **Risk:** HIGH growth.  
- **Suggested future fix:** TTL for non-critical read notifications; keep critical/ack separately.

**P1-3 Docker/Nginx logs unrotated in repo**  
- **Problem:** compose has no logging opts; Nginx repo configs omit log settings.  
- **Risk:** disk fill if used.  
- **Suggested future fix:** `json-file` `max-size`/`max-file`; explicit Nginx log_format without tokens.

### P2 — Excessive / duplicate logging

**P2-1 `report.read` + Morgan**  
- Duplicate evidence of the same GET. Prefer audit on export/mutating report jobs only.

**P2-2 Inconsistent `action_type` naming**  
- Mix of `USER_LOGIN_SUCCESS`, `report.read`, `popup_created`, `enrollment_requested`. Harder to query. Normalize later without losing history.

### P3 — Missing useful audit coverage

**P3-1 Failed logins / lockouts**  
- Store hashed identifier, IP, timestamp, reason code — not passwords.

**P3-2 File access and deletion**  
- Audit upload confirm, delete, and (sampled) signed URL issuance.

**P3-3 Assessment submit / closed rejection**  
- `FIELD_TRAINING_ASSESSMENT_SUBMITTED` and `ASSESSMENT_CLOSED_REJECTED` without storing full answers in audit JSON (answers already in attempt table).

**P3-4 Document downloads**  
- Completion letter and certificate download events.

**P3-5 Logout / session revocation**  
- Only meaningful if you add a token denylist or session table.

### P4 — Cleanup / observability

**P4-1 Request ID in audit rows** for support correlation.  
**P4-2 Structured logger everywhere** instead of mixed `console.*`.  
**P4-3 First-party error monitoring** (Sentry or equivalent) if operators need retention of app logs.  
**P4-4 Do not add per-heartbeat watch rows**; if watch tracking is required, upsert one progress row per student×lecture.

---

## 50. Local limitations

- Docker CLI was **not available**; container logging driver could not be inspected live.
- Production Nginx defaults on the host are **unknown** (repo files only).
- No production data volumes were counted; volume ratings are architectural, not measured row counts.
- `qa-artifacts/` JSON files are manual QA outputs, not the live logging pipeline.

---

*End of local audit.*

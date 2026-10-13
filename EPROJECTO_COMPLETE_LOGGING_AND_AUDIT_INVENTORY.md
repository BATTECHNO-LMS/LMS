# EPROJECTO — Complete Logging, Audit Trail & Observability Inventory

| | |
|---|---|
| Audit mode | **READ ONLY** (search / inspect / map / classify / report) |
| Audit date | 2026-10-12 / 2026-10-13 (UTC) |
| Code baseline | `main` @ `29f275f` (working tree clean except untracked `frontend/dist`) |
| Production evidence | Production VPS (host nginx, Docker engine, `battechno-lms-backend`, `battechno-lms-frontend`), Neon PostgreSQL via `SELECT`-only queries executed inside the backend container. Temporary scripts were removed after execution. |
| Production changes | **NONE** — no code, config, log, retention, database, Nginx, Docker or deployment change was made. |
| Secrets | No secret value, password, token, cookie, OTP or confidential log line is reproduced in this document. Counts and key names only. |

Category vocabulary used throughout (kept deliberately separate):

| Category | Meaning in this report |
|---|---|
| **LOGS** | Text streams for operators: morgan access log, JSON `logger.js` lines, `console.*`, Nginx access/error, Docker json-file, journald. |
| **AUDIT EVENTS** | Rows in `audit_logs` written through `recordAudit` / `recordAuditMany`. |
| **METRICS** | Aggregates: `kpi_snapshots`, `kpi_alerts`, perf timing (disabled). |
| **BUSINESS DATA** | Domain rows that happen to carry who/when (attendance, attempts, letters, files, progress, OTP rows, notifications). |
| **SESSIONS** | Authentication sessions. *None exist server-side* (stateless JWT). `sessions` table = training sessions, not auth. |
| **ANALYTICS** | Behavioural tracking (`help_search_logs`, `help_article_views`, popup/announcement user states, recorded-lecture watch progress, command-center live feed). |

Finding classifications: `GOOD` · `MISSING_LOG` · `EXCESSIVE_LOG` · `PRIVACY_RISK` · `SECURITY_RISK` · `RETENTION_GAP` · `PERFORMANCE_RISK` · `OBSERVABILITY_GAP`.
Flags: `MISSING_SECURITY_EVENT` · `PRIVACY_REVIEW_REQUIRED` · `AUDIT_GRANULARITY_REVIEW` · `NO_RETENTION_POLICY_FOUND`.

---

## 1. Executive Summary

**Overall status: PARTIAL.** EPROJECTO has a real, centrally designed audit trail (`audit_logs`) that covers the business-critical Field Training lifecycle well (attendance, evaluation, eligibility, completion letters, report exports) and records successful logins and the full password-reset flow. Operational logging is minimal but clean: structured JSON errors without stack traces in production, morgan access lines, no request bodies, no passwords/JWTs/cookies found in any inspected log or audit row.

The material weaknesses are:

1. **Every IP address the backend sees is the Docker bridge gateway (`172.19.x.x`)**. `app.set('trust proxy', 1)` trusts one hop, but production has two (host nginx → container nginx → Express). Consequently `audit_logs.ip_address`, `field_training_attendance.ip_address`, morgan `:remote-addr` and **all per-IP rate limiters** (including the 60-per-15-min auth limiter) operate on one shared address. `SECURITY_RISK` + `OBSERVABILITY_GAP` (P0).
2. **Security events are largely missing**: failed logins, account-gate denials, logout, 401/403 permission denials, cross-organization denials and token expiry are not persisted anywhere with an actor identity. Only the anonymous access log shows status codes. `MISSING_SECURITY_EVENT` (P0/P1).
3. **No retention policy for any database log-like table** (`audit_logs`, `notifications`, OTP tables, analytics tables). `NO_RETENTION_POLICY_FOUND`. Conversely, **container logs are short-lived** (10 MB × 3 per container, destroyed on every redeploy) and **no external log sink or error monitor** exists. `RETENTION_GAP` + `OBSERVABILITY_GAP`.
4. **No correlation ID across layers**: the backend generates `X-Request-Id`, but morgan logs `-` for 100 % of lines (6,311/6,311 sampled) because the header is read from the *request*, which nginx never sets.
5. **Audit coverage is uneven outside Field Training**: course-task grading, revisions, file uploads/deletes, most downloads, training certificate issuance, universities, settings, and the legacy micro-credential/assessment/grade/attendance modules write no audit events.
6. **JWT accepted in query string** (`?access_token=` / `?token=` on GET) for protected uploads and the analytics SSE stream; such URLs are written verbatim to three access logs. Zero occurrences in retained logs today — latent `SECURITY_RISK` (P1).
7. **PII inside audit payloads** (email 1,067 rows, full name 594, university student number 551) survives account-deletion anonymization. `PRIVACY_RISK` / `PRIVACY_REVIEW_REQUIRED`.

Headline numbers (production, 2026-10-13):

| Metric | Value |
|---|---|
| `audit_logs` rows / size / oldest | 10,068 / 5.6 MB / 2026-05-19 |
| Audit rows last 30 days | 1,286 (~43/day) |
| Distinct action types in DB | 97 |
| Runtime action types in code (`backend/src`) | **152** (+ ~20 script-only / historical) |
| Audit rows with actor = NULL | 1,341 (13 %) |
| Audit rows with no university/org scope | 4,961 (49 %) — visible to super admins only |
| Audit rows with IP | 2,666 (26 %); all post-cutover IPs = Docker gateway |
| Sensitive-pattern hits in audit JSON | 369 — **all false positives** (`source: "password_login"`) |
| Host nginx access log | ~7.7 MB/day, daily rotation × 14, shared by 5 vhosts |
| Backend container log | ~1.7 MB/day (99 % morgan lines), cap 30 MB, lost on redeploy |

---

## 2. Logging Architecture

```
Browser ──► Host nginx 1.24 (eprojecto.com vhost, TLS)            [LOG: /var/log/nginx/access.log combined, error.log]
              │  proxy_pass 127.0.0.1:8080
              ▼
           Frontend container nginx (SPA + reverse proxy)          [LOG: stdout "main" format incl. $http_x_forwarded_for → Docker json-file]
              │  /api/, /uploads/ → backend:4000  (X-Forwarded-For = $proxy_add_x_forwarded_for)
              ▼
           Express API (battechno-lms-backend)
              ├─ requestIdMiddleware → req.id + X-Request-Id response header
              ├─ helmet, CORS, express.json (2 MB)
              ├─ requestLogger (morgan, stdout)                    [LOG]
              ├─ perfTiming (only if PERF_LOGGING set — unset)     [METRICS, disabled]
              ├─ rate limiters (express-rate-limit, in-memory, per req.ip)
              ├─ business services ── recordAudit()/recordAuditMany() ──► audit_logs   [AUDIT EVENTS]
              │                     └─ domain writes (attendance, attempts, letters…)  [BUSINESS DATA]
              │                     └─ emitDomainEvent() → notification rules only      [not persisted as events]
              ├─ logger.js JSON lines (warn/error/info)            [LOG]
              └─ error.middleware: log('error') for 5xx, REQ-id to client
           Neon PostgreSQL (managed; server-side Postgres logs not accessible from app)
           Cloudflare R2 (STORAGE_BACKEND=r2; bucket access logging not configured in repo)
```

| Component | File / location | Notes |
|---|---|---|
| Request ID | `backend/src/middlewares/requestId.middleware.js` (wired in `app.js`) | Generates ID per request; exposed as `X-Request-Id` response header and in error JSON. |
| Access log | `backend/src/middlewares/requestLogger.middleware.js` | Production format `:remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]`; skips `/health`, `/health/ready`. |
| App logger | `backend/src/utils/logger.js` | Production: one JSON line `{ts, level, service:'battechno-lms-api', message, ...meta}`; dev: pretty. No log-level filter (`LOG_LEVEL` unused/unset). |
| Error logger | `backend/src/middlewares/error.middleware.js` | 5xx → `log('error', …, {requestId, code, prismaCode, name})`; stack only when `NODE_ENV !== 'production'`. 4xx not logged. |
| Perf timing | `backend/src/middlewares/perfTiming.middleware.js` | `PERF_LOGGING` unset in prod → disabled. When enabled logs slow SQL **text** (`[perf:query]`). |
| Audit writer | `backend/src/shared/services/audit.service.js`, wrapper `backend/src/utils/auditRecorder.js` | Only writer of `audit_logs` in runtime code. |
| Audit reader | `backend/src/modules/audit-logs/*` | `GET /api/v1/audit-logs`, `GET /api/v1/audit-logs/:id`. |
| Process logs | `backend/src/server.js` | `console.*` for startup, shutdown, unhandled rejection, uncaught exception. |
| Monitoring SDK | — | None (no Sentry/Datadog/OpenTelemetry in backend or frontend `package.json`; `SENTRY_DSN` unset). |

Classification: `OBSERVABILITY_GAP` (no correlation, no external sink, no alerting), `GOOD` (structured JSON, sanitized errors).

---

## 3. Database Audit Tables

### 3.1 Central audit table — `audit_logs` (`backend/prisma/schema.prisma` ~L347)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `user_id` | uuid? | Actor. **No FK** to `users`. |
| `university_id` | uuid? | Scope for university admins. |
| `organization_id` | uuid? | Scope column; not used by the read API for org-level users. |
| `action_type` | varchar(120) | Free-text action name (no enum). |
| `entity_type` | varchar(120) | Free-text. |
| `entity_id` | uuid? | |
| `old_values` / `new_values` | jsonb? | Caller-defined payload. |
| `ip_address` | varchar(64)? | Caller passes `req.ip` (= Docker gateway in prod). |
| `created_at` | timestamptz | `now()` |

Indexes: `user_id`, `university_id`, `organization_id`, `action_type`, `entity_type`, `created_at`.
**Not present**: `user_agent`, `request_id`, `severity`/`outcome`, `actor_role`, hash chain, FK constraints.

Schema comment: *"Append-only audit trail (writes via internal helpers, not public POST)."* Verified: no `audit_logs.update*`/`delete*` call in `backend/src`; no public write route. No DB trigger/rule/REVOKE protecting the table in migrations.

### 3.2 Other tables with audit-like or log-like semantics

| Table | Category | Rows (prod) | Size | What it records | Retention |
|---|---|---|---|---|---|
| `field_training_supervisor_import_audit` | AUDIT EVENTS (domain-specific) | 490 | 368 kB | Per-row outcome of supervisor Excel imports | `NO_RETENTION_POLICY_FOUND` |
| `field_training_supervisor_import_batches` | BUSINESS DATA | 9 | 368 kB | Import batch header | none |
| `training_finalization_events` | AUDIT-like BUSINESS DATA | 3 | 48 kB | Course finalization events | none |
| `field_training_completion_letter_jobs` | BUSINESS DATA | 7 | 440 kB | Bulk letter job progress | none |
| `field_training_attendance` | BUSINESS DATA | — | — | Status, method, `confirmed_at`, `manual_reason`, **`ip_address`**, **`device_info` (≤500 chars)**, `recorded_by_id` | none |
| `field_training_attendance_window_attempts` | BUSINESS DATA / security counter | 656 | 296 kB | Attendance-code attempts | none |
| `field_training_recorded_lecture_progress` | ANALYTICS / BUSINESS DATA | 132 | 176 kB | Watch progress per lecture/application | none |
| `field_training_recorded_lecture_watch_segments` | ANALYTICS / BUSINESS DATA | 12,935 | **16 MB** | Merged watched intervals (rewritten every heartbeat) | none |
| `notifications` | BUSINESS DATA | 14,607 | 10 MB | In-app notifications | `NO_RETENTION_POLICY_FOUND` |
| `notification_deliveries` | LOG-like BUSINESS DATA | 857 | 536 kB | Channel delivery attempts | none |
| `notification_scheduled_jobs`, `notification_digests` | BUSINESS DATA | 0 / 0 | — | | none |
| `mobile_push_registrations` | BUSINESS DATA | 0 | — | Push tokens (unused, push disabled) | none |
| `email_verification_otps` | BUSINESS DATA (security) | 735 | 392 kB | email, **`code_hash`**, attempts, expiry | Deleted only on account deletion |
| `password_reset_otps` | BUSINESS DATA (security) | 186 | 200 kB | email, `code_hash`, `reset_token_hash`, attempts | Deleted only on account deletion |
| `help_search_logs` | ANALYTICS | 22 | 80 kB | `user_id`, **free-text `query`**, results_count | none |
| `help_article_views` | ANALYTICS | 23 | 72 kB | article, user | none |
| `managed_popup_user_states` / `announcement_user_states` | ANALYTICS | 257 / 0 | — | view/dismiss/ack/click | none |
| `user_onboarding_progress` | BUSINESS DATA | 300 | 256 kB | Guided tour progress | none |
| `course_lesson_progress` | BUSINESS DATA | 11 | 416 kB | | none |
| `kpi_snapshots` / `kpi_alerts` | METRICS | 18 / 0 | — | KPI aggregates | none |
| `files` | BUSINESS DATA | 4,388 | 3.7 MB | uploader, `original_name`, storage key, mime, size, soft-delete | soft delete only |
| `users.last_login_at` | BUSINESS DATA | 625 users | — | Last successful login timestamp only | overwritten |
| `account_deletion_requests` | BUSINESS DATA | 0 | — | | — |
| `support_tickets` | BUSINESS DATA | 1 | — | | — |

**There is no authentication session table.** `sessions` (schema ~L487) are training sessions.

---

## 4. Complete Audit Action Inventory

### 4.1 Method

* Static extraction of every `recordAudit`/`recordAuditMany` call and every module wrapper (`announcements.audit`, recorded-lectures `audit` + `AUDIT` constants, `fieldTrainingEvaluation.audit`/`auditAction` option, `fieldTrainingReport.auditReport`, `reports.auditReportRead`, `hoursEligibilityBackfill.writeAudits`, `eventDispatcher`), plus template literals and ternaries resolved by hand.
* Cross-checked against `SELECT action_type, entity_type, count(*) … GROUP BY` and the distinct JSON keys per action in production (values never read).
* **Runtime action types in `backend/src`: 152.** Script-only (`backend/scripts`) and historical (DB-only) names are listed separately in §4.4.

Actor legend: **SA** super_admin · **AD** admin (university/org) · **IN** instructor / field supervisor / trainer · **AC** academic supervisor · **ST** student · **SELF** acting user on own account · **SYS** system/no actor (NULL `user_id`).
Metadata column = top-level JSON keys observed in production (`old → new`) or, if no production rows yet, the payload described in source.

### 4.2 Audit Event table (runtime, `backend/src`)

#### Authentication & accounts

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `USER_LOGIN_SUCCESS` | Successful password login | SELF | user | `source`, `portalType` + IP | `modules/auth/auth.service.js:616` |
| `USER_REGISTERED` | Student self-registration | SYS (actor NULL) | user | `email`, `full_name`, `status` | `modules/auth/auth.service.js:463` |
| `INSTITUTION_USER_REGISTERED` | Institution self-registration | SYS | user | `email`, `organizationId` | `modules/auth/auth.service.js:346` |
| `PASSWORD_RESET_REQUESTED` | Forgot-password request | SYS/SELF | user | `email` | `modules/auth/passwordReset.service.js:79` |
| `PASSWORD_RESET_OTP_VERIFIED` | OTP verified | SELF | user | `email` | `modules/auth/passwordReset.service.js:160` |
| `PASSWORD_RESET_COMPLETED` | New password set via reset token | SELF | user | `email` | `modules/auth/passwordReset.service.js:205` |
| `ACCOUNT_DELETION_REQUESTED` | User requests deletion | SELF | account_deletion_request | request payload | `modules/accountDeletion/accountDeletion.service.js:125` |
| `ACCOUNT_DELETION_CANCELLED` | User cancels | SELF | account_deletion_request | — | `…accountDeletion.service.js:169` |
| `ACCOUNT_DELETION_PROCESSING` | Admin starts processing | SA/AD | account_deletion_request | — | `…accountDeletion.service.js:238` |
| `ACCOUNT_DELETION_REJECTED` | Admin rejects | SA/AD | account_deletion_request | reason | `…accountDeletion.service.js:257` |
| `ACCOUNT_DELETION_COMPLETED` | Anonymization done | SA/AD | account_deletion_request | — | `…accountDeletion.service.js:290` |

#### Users, roles, reviewers

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `USER_CREATED` | Admin creates user | SA/AD | user | `createdBy`, `email`, `full_name`, `phone`, `role_codes`, `status`, university/specialty ids | `modules/users/users.service.js:444` |
| `USER_UPDATED` | Admin edits user (incl. roles) | SA/AD | user | old: profile + status (**no roles**) → new: changed fields + `role_codes`, `updatedBy` | `modules/users/users.service.js:654` |
| `USER_STATUS_CHANGED` | Admin changes status | SA/AD | user | `status` → `status`, `updatedBy` | `modules/users/users.service.js:692` |
| `USER_PASSWORD_RESET` | Admin resets a user's password | SA/AD | user | `resetBy` | `modules/users/users.service.js:722` |
| `USER_ACTIVATED` | Activate user (single or per-row in "activate all pending") | SA/AD | user | `status` → `status`, `activated_at` | `modules/users/users.service.js:784` |
| `USER_EMAIL_VERIFIED` | Admin verifies email | SA/AD | user | `email_verified_at`, `verified_manually` | `modules/users/users.service.js:916` |
| `BULK_EMAIL_VERIFIED` | Bulk / all-unverified email verification | SA/AD | user | `filters`, `performedBy`, `updatedCount`, `skippedCount`, `unauthorizedCount` | `modules/users/users.service.js:998, 1047` |
| `USERS_EXCEL_EXPORTED` | Users Excel export | SA/AD | user | `filters`, `scope`, `exportedCount`, `filename`, `performedBy` | `modules/users/users.service.js:1180` |
| `ROLE_PERMISSIONS_UPDATED` | Role permission matrix saved | SA | role | `code`, `permission_codes` (old & new) | `modules/roles/roles.service.js:144` |
| `REVIEWER_UNIVERSITY_ASSIGNED` | Reviewer ↔ university link | SA/AD | reviewer_university_assignments | assignment ids | `modules/users/reviewerAssignment.service.js:181` |
| `REVIEWER_UNIVERSITY_UNASSIGNED` | Reviewer link deactivated | SA/AD | reviewer_university_assignments | assignment ids | `modules/users/reviewerAssignment.service.js:210` |
| `TRAINER_USER_CREATED` | Trainer account created | SA/AD | user | trainer fields | `modules/trainingPrograms/trainerAssignments.service.js:145` |

#### Organizations

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `ORGANIZATION_CREATED` | Create institution | SA | organization | `name`, `type` | `modules/organizations/organizations.service.js:202` |
| `ORGANIZATION_UPDATED` | Update institution | SA/AD | organization | `name`, `status` (old & new) | `…organizations.service.js:251` |
| `ORG_BRANCH_CREATED` | Create branch | SA/AD | organization_branch | `name` | `…organizations.service.js:299` |
| `ORG_BRANCH_UPDATED` | Update branch | SA/AD | organization_branch | branch fields | `…organizations.service.js:341` |
| `ORG_DEPARTMENT_CREATED` | Create department | SA/AD | organization_department | dept fields | `…organizations.service.js:397` |
| `ORG_ASSIGNMENT_CREATED` | Assign user to org | SA/AD | user_organization_assignment | assignment | `…organizations.service.js:499` |
| `EMAIL_VERIFIED_ADMIN` | Org admin verifies member email | AD | user | — | `…organizations.service.js:610` |
| `ACCOUNT_ACTIVATE` / `ACCOUNT_REJECT` / `ACCOUNT_DISABLE` | Member activation decision (`ACCOUNT_${action}`) | AD | user | `status` → `status`, `reason` | `…organizations.service.js:684` |

#### Courses / training programs / course content

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `COURSE_CREATED` | Admin creates course | SA/AD | course | `status`, `title` | `modules/courses/courses.service.js:153` |
| `COURSE_UPDATED` | Admin updates course / program | SA/AD | course, training_program | full old/new course fields | `courses.service.js:188`, `trainingPrograms.service.js:577` |
| `COURSE_PUBLISHED` | Publish | SA/AD | course | `status` | `courses.service.js:214` |
| `COURSE_ARCHIVED` | Archive | SA/AD | course | `status` | `courses.service.js:228` |
| `TRAINING_PROGRAM_CREATED` | Create program | SA/AD | training_program | `code`, `status`, `title` | `trainingPrograms.service.js:374` |
| `TRAINING_PROGRAM_PUBLISHED` | Publish program | SA/AD | training_program | `status` | `trainingPrograms.service.js:2025` |
| `TRAINING_SESSION_UPDATED` | Update session | SA/AD/IN | training_session | session fields | `trainingPrograms.service.js:941` |
| `TRAINING_ATTENDANCE_SET` | Set one attendance status | IN/AD | training_attendance_record | status | `trainingPrograms.service.js:1014` |
| `TRAINING_MARK_ALL_PRESENT` | Mark all present | IN/AD | training_session | `mode`, `updated` (count only) | `trainingPrograms.service.js:1217` |
| `TASK_CREATED` | Create course task | SA/AD/IN | training_task | `programId`, `published`, `title` | `trainingPrograms.service.js:1260` |
| `TASK_UPDATED` | Update course task | SA/AD/IN | training_task | `dueAt`, `publishedAt`, `title`, `submissionCount`, `role` | `courseContent.service.js:766` |
| `TRAINING_TASK_SUBMITTED` | Student submits course task | ST | training_task_submission | `attemptNo`, `fileCount`, `taskId`, `totalBytes` | `trainingTaskWorkflow.service.js:220` |
| `MATERIAL_CREATED` / `MATERIAL_UPDATED` / `MATERIAL_FILE_REPLACED` | Course material CRUD | SA/AD/IN | training_material | material fields | `courseContent.service.js:245, 337, 367` |
| `RECORDED_LECTURE_CREATED` / `_UPDATED` / `_FILE_REPLACED` / `_PUBLISHED` / `_UNPUBLISHED` | Course recorded lecture CRUD | SA/AD/IN | training_recorded_lecture | lecture fields | `courseContent.service.js:443, 556, 593, 621` |
| `TRAINER_ASSIGNED` / `TRAINER_ASSIGNMENT_UPDATED` | Trainer ↔ course | SA/AD | training_trainer_assignment | `cohortId`, `programId`, `trainerUserId` | `trainerAssignments.service.js:251` |
| `TRAINER_ASSIGNMENT_REVOKED` | Revoke trainer | SA/AD | training_trainer_assignment | ids | `trainerAssignments.service.js:288` |
| `TRAINING_FINALIZED` | Finalize course results | SA/AD | training_program | `completedCount`, `exceptionalCount`, `mode` | `trainingCompletion.service.js:471` |
| `TRAINING_REOPENED` | Reopen enrollment completion | SA/AD | training_enrollment | — | `trainingCompletion.service.js:716` |
| `FINAL_EVALUATION_REOPENED` | Reopen trainer evaluation | SA/AD | training_evaluation_assignment | — | `trainingEvaluation.service.js:593` |
| `enrollment_requested` | Student requests cohort enrollment | ST | enrollment | — | `modules/enrollments/enrollments.service.js:230, 257` |
| `enrollment_approved` / `enrollment_rejected` | Reviewer decision | AD/Reviewer | enrollment | decision | `enrollments.service.js:318, 348` |

#### Field Training — opportunities, applications, participants

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `FIELD_TRAINING_OPPORTUNITY_CREATED` | Create opportunity | SA/AD | field_training_opportunity | `status`, `title` | `fieldTraining.service.js:467` |
| `FIELD_TRAINING_OPPORTUNITY_UPDATED` | Update opportunity | SA/AD | field_training_opportunity | `title` → ~20 config fields | `fieldTraining.service.js:520` |
| `FIELD_TRAINING_OPPORTUNITY_PUBLISHED` | Publish | SA/AD | field_training_opportunity | `status` | `fieldTraining.service.js:559` |
| `FIELD_TRAINING_OPPORTUNITY_ARCHIVED` | Archive | SA/AD | field_training_opportunity | `status` | `fieldTraining.service.js:582` |
| `FIELD_TRAINING_APPLICATION_APPROVED` / `_REJECTED` | Review application (ternary) | SA/AD | field_training_application | `status`, `training_status`, `note` | `fieldTraining.service.js:770–777` |
| `FIELD_TRAINING_STARTED` | Start training | SA/AD/IN | field_training_opportunity | — | `fieldTraining.workflowService.js:84` |
| `FIELD_TRAINING_EXPULSION_REQUESTED` | Request expulsion | IN | field_training_application | reason | `fieldTraining.workflowService.js:807` |
| `FIELD_TRAINING_PARTICIPANT_EXPELLED` | Expel participant | SA/AD | field_training_application | `reason` | `fieldTraining.workflowService.js:761` |
| `FIELD_TRAINING_ASSESSMENT_PUBLISHED` | Publish pre/post assessment | SA/AD/IN | field_training_assessment | — | `fieldTraining.workflowService.js:429, 1775` |
| `FIELD_TRAINING_ASSESSMENT_UPDATED` | Update assessment (close date) | SA/AD/IN | field_training_assessment | `closes_at`, `type` | `fieldTraining.workflowService.js:1716` |
| `field_training.hours.update` | Manual hours adjustment | SA/AD | field_training_application | `completed_training_hours`, `difference`, `note`, `required_training_hours` | `fieldTraining.workflowService.js:1346` |
| `FIELD_TRAINING_ELIGIBILITY_RECALCULATED` | Recalculate eligibility | SA/AD/SYS | field_training_opportunity | `finalEligible`, `finalNotEligible`, `persisted`, `source`, `taskEvaluationsCorrected` | `fieldTraining.workflowService.js:1422` |
| `FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1` | Hours/eligibility backfill (operator-invoked module) | SA/SYS | field_training_application | previous/new hours + eligibility, attendance numerator/denominator, operation id | `fieldTraining.hoursEligibilityBackfill.js:660` |
| `FIELD_TRAINING_SUBMISSION_REVIEWED` | Review / score task submission | IN/AD/SYS | field_training_task_submission | `originalScore`, `newScore`, `maxScore`, `originalReviewStatus`, `review_status`, `reason`, `source`, `taskTitle`, `universityStudentNumber` | `fieldTraining.service.js:1622`, `fieldTraining.tafilaApprovedResult.service.js:237, 1173` |
| `FIELD_TRAINING_TAFILA_APPROVED_RECONCILIATION` | University-approved result reconciliation | SA | field_training_opportunity | plan summary | `fieldTraining.tafilaApprovedResult.service.js:909` |
| `FIELD_TRAINING_SUPERVISOR_ASSIGNMENTS_IMPORTED` | Supervisor Excel import applied | SA/AD | field_training_supervisor_import_batch | `created`, `updated`, `unchanged`, `filename`, `file_hash` | `fieldTraining.supervisorExcel.service.js:675` |
| `FIELD_TRAINING_STUDENT_REPORTS_BULK_EXPORTED` | Bulk student reports ZIP job | SA/AD/IN | field_training_opportunity | `jobId`, `filename`, `filters`, `filterSummary`, `matchingCount`, `included`, `failed`, `reportType` | `fieldTraining.studentReportsBulk.service.js:437` |

#### Field Training — attendance

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `FIELD_TRAINING_ATTENDANCE_WINDOW_OPENED` | Open code window | IN/AD | field_training_attendance_window | `duration_seconds`, `expires_at`, `mode`, `session_id` | `fieldTraining.attendanceWindow.service.js:248` |
| `FIELD_TRAINING_ATTENDANCE_WINDOW_CLOSED` | Close window (manual or expiry) | IN/AD/SYS (93/104 SYS) | field_training_attendance_window | `reason`, `session_id`, `status` | `…attendanceWindow.service.js:191` |
| `FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM` | Student confirms with code | ST | field_training_attendance | `method`, `mode`, `session_id`, `status`, `window_id` + IP | `…attendanceWindow.service.js:869` |
| `FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT` | Unconfirmed → absent | IN/AD | field_training_attendance | `status` → `method`, `session_id`, `status`, `student_id` | `…attendanceWindow.service.js:399` |
| `FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE` | Manual attendance change | IN/AD | field_training_attendance | old `method,status,student_id` → `manual_reason`, `method`, `operation`, `session_id`, `session_title`, `status`, `student_id` | `…attendanceWindow.service.js:484`, `fieldTraining.workflowService.js:248` |
| `FIELD_TRAINING_ATTENDANCE_MARK_ALL_PRESENT` | Mark all present | IN/AD | field_training_session | `previous_statuses` (summary), `eligible_students`, `updated`, `created`, `skipped`, `reason`, `mode` | `…attendanceWindow.service.js:643` |

#### Field Training — evaluation, reports, completion letters, recorded lectures

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `FT_EVAL_TEMPLATE_UPLOADED` / `FT_EVAL_TEMPLATE_REPLACED` | Upload evaluation template (ternary on `replace_of`) | SA/AD | field_training_evaluation_template | `isDefault`, `version`, `role`, `opportunityId` | `fieldTrainingEvaluation.service.js:524` |
| `FT_EVAL_TEMPLATE_DEFAULT_CHANGED` | Set default template | SA/AD | field_training_evaluation_template | `role`, `opportunityId` | `fieldTrainingEvaluation.service.js:554` |
| `FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED` | Assign template to opportunity | SA/AD | field_training_opportunity | `templateId`, `role` | `fieldTrainingEvaluation.service.js:620, 643` |
| `FT_EVAL_POLICY_CHANGED` | Evaluation policy upsert | SA/AD | field_training_evaluation_policy | `version`, `role` | `fieldTrainingEvaluation.service.js:833` |
| `FT_EVAL_MANUAL_RATING_SAVED` | Supervisor rating saved | IN/AC | field_training_supervisor_rating | `applicationId`, `providedFields`, `role`, `source`, `studentId` | `fieldTrainingEvaluation.service.js:951` |
| `FT_EVAL_BULK_ELIGIBLE_RATING_SAVED` | Per-student row of bulk rating (`auditAction` option) | IN/AD | field_training_supervisor_rating | `applicationId`, `fieldsAtFive`, `overwrittenPrevented`, `role`, `source`, `studentId` | `fieldTrainingEvaluation.service.js:1189` |
| `FT_EVAL_BULK_ELIGIBLE_RATING_APPLIED` | Bulk rating summary | IN/AD | field_training_opportunity | `applicationIds`, `studentsAffected`, `ratingsApplied`, `existingScoresOverwritten`, `authorizedRole`, `reason` | `fieldTrainingEvaluation.service.js:1208` |
| `FT_EVAL_REPORT_GENERATED` / `FT_EVAL_REPORT_REGENERATED` | Final evaluation PDF (ternary on `regenerate`) | IN/AD/SYS | field_training_final_evaluation | `finalStatus`, `version`, `role`, `studentId` | `fieldTrainingEvaluation.service.js:2018` |
| `FT_EVAL_BULK_ZIP_DOWNLOADED` | Evaluation reports ZIP | SA/AD/IN | field_training_final_evaluation | `selected`, `included`, `missing`, `failed` | `fieldTrainingEvaluation.service.js:2656` |
| `FT_EVAL_ACADEMIC_SUPERVISOR_SYNC` | Sync academic supervisors | SA/AD | field_training_opportunity | sync counts | `fieldTrainingEvaluation.service.js:3034` |
| `FT_EVAL_SUPERVISOR_ZIP_DOWNLOADED` / `FT_EVAL_ALL_SUPERVISOR_ZIP_DOWNLOADED` | Supervisor reports ZIP | SA/AD | field_training_opportunity | `supervisor`, `included`, `skipped`, `failed` | `fieldTraining.supervisorReports.service.js:248` |
| `FT_EXCEL_EVALUATION_EXPORTED` | University Excel evaluation export | SA/AD | field_training_opportunity | `rowCount`, `eligible`, `notEligible`, `templateSource`, `templateVersion` | `fieldTrainingExcelEvaluation.service.js:284` |
| `FIELD_TRAINING_COMPLETION_LETTER_ISSUED` / `_REGENERATED` | Issue / regenerate letter | SA/AD/SYS (bulk job) | field_training_completion_letter | `application_id`, `source_data_hash` | `fieldTraining.completionLetter.service.js:790` |
| `FIELD_TRAINING_COMPLETION_LETTER_REVOKED` | Eligibility sync revokes letter | SYS | field_training_completion_letter | `application_id`, `eligibility`, `pdfPreserved`, `previousStatus`, `reason` | `fieldTraining.completionLetter.service.js:243` |
| `RECORDED_LECTURE_CREATED` / `_UPDATED` / `_PUBLISHED` / `_HIDDEN` | FT recorded lecture CRUD (`AUDIT` constants) | SA/AD/IN | field_training_recorded_lecture | `status` / `id` | `fieldTraining.recordedLectures.service.js:156` + `…constants.js:19` |
| `RECORDED_LECTURE_IMPORTED_SINGLE` / `RECORDED_LECTURES_IMPORTED_PLAYLIST` / `RECORDED_LECTURE_PLAYLIST_SYNCED` | YouTube import / playlist sync | SA/AD/IN | field_training_recorded_lecture | `count`, `playlistId`, `provider`, `imported`, `discoveredNew`, `removedFromSource`, `unavailable` | `fieldTraining.recordedLectures.youtubeImport.service.js` |
| `RECORDED_LECTURES_REORDERED` | Reorder lectures | SA/AD/IN | field_training_recorded_lecture | `count`, `opportunityId` | `fieldTraining.recordedLectures.service.js` |

#### Reports (generic wrappers)

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `report.read` | Viewing an analytics/FT report endpoint | SA/AD/AC/Reviewer | report, field_training_report | `report_type`, `type`, `university_id`, `summary` + IP | `modules/reports/reports.controller.js:24`; `fieldTrainingReport.controller.js` (11 call sites) |
| `report.export` | Excel/PDF/CSV export | same | report, field_training_report | `format`, `report_type`, `filters`, `row_count`, `opportunity_id`, `university_id` + IP | `reports.controller.js:105`; `fieldTrainingReport.controller.js` (8 sites); `adminFieldTraining.controller.js:111` |
| `report.generate` | Generate report artefact | same | field_training_report | summary | `fieldTrainingReport.controller.js:189–223` |

#### Communication, help, notifications, popups

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `announcement.create` / `.update` / `.update_audience` / `.publish` / `.schedule` / `.pause` / `.archive` / `.duplicate` | Announcement lifecycle | SA/AD | announcement | old/new announcement | `modules/announcements/announcements.service.js:482` wrapper; calls 567–902 |
| `popup_created` / `popup_updated` / `popup_published` / `popup_paused` / `popup_archived` | Managed popup lifecycle | SA/AD | managed_popup | `status`, `version` | `modules/popups/popups.service.js:323–468` |
| `NOTIFICATION_RULE_CREATED` / `_UPDATED` | Rule CRUD | SA | notification_rules | rule | `notificationRules.service.js:191, 243` |
| `NOTIFICATION_RULE_DRAFT` / `_ACTIVE` / `_PAUSED` / `_ARCHIVED` | Rule status change (`NOTIFICATION_RULE_${status}`) | SA | notification_rules | status | `notificationRules.service.js` |
| `NOTIFICATION_TEMPLATE_CREATED` | Template create | SA | notification_templates | template | `notificationRules.service.js:361` |
| `NOTIFICATION_DELIVERY_RETRY` | Retry failed delivery | SA | notification_deliveries | delivery id | `notificationRules.service.js:620` |
| `NOTIFICATION_MANUAL_SEND` | Manual broadcast | SA/AD | notifications | audience/event | `notificationRules.service.js:737, 780` |
| `HELP_CATEGORY_CREATED` / `_UPDATED` / `_ARCHIVED` | Help categories | SA | help_categories | | `help.service.js:915, 959, 985` |
| `HELP_ARTICLE_CREATED` / `_UPDATED` / `_PUBLISHED` / `_UNPUBLISHED` / `_ARCHIVED` / `_VERSION_RESTORED`, `HELP_ARTICLES_REORDERED` | Help articles | SA | help_articles | | `help.service.js:1050–1295` |
| `USER_GUIDE_CREATED` / `_UPDATED` / `_PUBLISHED` / `_ARCHIVED` | User guides | SA | user_guides | `status` | `help.service.js:1388–1482` |

#### Legacy event dispatcher (micro-credential era)

| Audit Action | Trigger | Actor | Entity | Metadata | Source File |
|---|---|---|---|---|---|
| `certificate.issue` | Micro-credential certificate created (dispatched event) | SA/AD | certificate | certificate | `shared/services/eventDispatcher.service.js:32` |
| `certificate.status` | Certificate status patched | SA/AD | certificate | status | `eventDispatcher.service.js:58` |
| `recognition_request.status` | Recognition request status | SA/AD | recognition_request | status | `eventDispatcher.service.js:10` |
| `integrity_case.reported` | Integrity case reported | IN/AD | integrity_case | | `eventDispatcher.service.js:128` |

### 4.3 Production volume by action (top 25 of 97)

| Action | Rows | Last seen |
|---|---|---|
| FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE | 1,617 | 2026-10-12 |
| FT_EVAL_REPORT_REGENERATED | 1,193 | 2026-09-04 |
| FT_EVAL_REPORT_GENERATED | 705 | 2026-09-02 |
| USER_ACTIVATED | 623 | 2026-10-07 |
| FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM | 617 | 2026-10-12 |
| FIELD_TRAINING_SUBMISSION_REVIEWED | 591 (551 with NULL actor) | 2026-10-03 |
| USER_REGISTERED | 574 | 2026-10-07 |
| USER_LOGIN_SUCCESS | 369 | 2026-10-13 |
| USER_EMAIL_VERIFIED | 364 | 2026-10-07 |
| FIELD_TRAINING_APPLICATION_APPROVED | 341 | 2026-10-07 |
| report.read | 287 | 2026-10-05 |
| report.export | 273 | 2026-10-10 |
| FIELD_TRAINING_COMPLETION_LETTER_ISSUED | 267 | 2026-09-07 |
| FT_EVAL_BULK_ELIGIBLE_RATING_SAVED | 235 | 2026-09-02 |
| FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1 | 233 | 2026-08-31 |
| FIELD_TRAINING_COMPLETION_LETTER_REGENERATED | 181 | 2026-09-07 |
| PASSWORD_RESET_REQUESTED | 170 | 2026-10-12 |
| FIELD_TRAINING_TAFILA_SUPERVISOR_ASSIGN_‹PERSON›_V1 | 161 | 2026-08-31 |
| PASSWORD_RESET_OTP_VERIFIED | 129 | 2026-10-04 |
| FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT | 125 | 2026-10-12 |
| PASSWORD_RESET_COMPLETED | 120 | 2026-10-04 |
| FIELD_TRAINING_ATTENDANCE_WINDOW_CLOSED | 104 | 2026-10-12 |
| BULK_EMAIL_VERIFIED | 69 | 2026-09-28 |
| FIELD_TRAINING_OPPORTUNITY_CREATED | 69 | 2026-09-09 |
| FIELD_TRAINING_ASSESSMENT_PUBLISHED | 60 | 2026-09-28 |

### 4.4 Script-only and historical action names (not emitted by runtime code)

| Action (as stored) | Origin | Rows | Note |
|---|---|---|---|
| `FIELD_TRAINING_TASK_SUBMISSIONS_BULK_GRADED` | `backend/scripts` | 1 | Contains `backup_file` path key. |
| `training_assessment.create` / `.update` / `.publish` | `backend/scripts` seeds | 4 / 8 / 12 | NULL actor. |
| `training_evaluation_template.seed` | `backend/scripts` | 7 | NULL actor. |
| `TRAINING_PROGRAM_UPDATED` | scripts | 3 | NULL actor. |
| `FIELD_TRAINING_TAFILA_SUPERVISOR_ASSIGN_‹PERSON›_V1` | one-off script | 161 | **Action name embeds a person's name** → `PRIVACY_REVIEW_REQUIRED`, `AUDIT_GRANULARITY_REVIEW`. |
| `TAFILA_TASKS_POST_ELIGIBLE_AND_ISSUE_LETTERS_V1`, `TAFILA_POST_COMPLETE_ELIGIBLE_140H_ISSUE_LETTERS_V1` | one-off scripts | 6 / 6 | |
| `FIELD_TRAINING_MARK_STUDENT_PRESENT_ALL_SESSIONS_V1`, `FIELD_TRAINING_MUTAH_POST_COMPLETE_LETTER_ELIGIBLE_V1`, `FIELD_TRAINING_UNIFY_TAFILA_TEMPLATE_CONVERT_ELIGIBLE_V1`, `FIELD_TRAINING_MARK_‹PERSON›_ELIGIBLE_V1` | one-off scripts | 8 / 3 / 2 / 1 | One embeds a first name. |
| `FIELD_TRAINING_ACADEMIC_SUPERVISOR_NAME_UPDATED`, `BULK_USERS_VERIFIED_AND_ACTIVATED` | historical / scripts | 1 / 2 | No current source match. |
| `TASK_SUBMITTED` / `TASK_RESUBMITTED` | historical (older code) | 3 / 1 | Today `TASK_SUBMITTED` is a **domain event** (`emitDomainEvent`), not an audit row. |

Classification: `AUDIT_GRANULARITY_REVIEW` — free-text `action_type` with no registry/enum lets scripts invent ad-hoc names (including personal names), complicating filtering and reporting.

---

## 5. Authentication Logging

| Event | Stored? | Where | Fields | Classification |
|---|---|---|---|---|
| Successful login | **YES** | `audit_logs` `USER_LOGIN_SUCCESS`; `users.last_login_at`; morgan line `POST /api/v1/auth/login 200` | user_id, university_id, `source='password_login'`, `portalType`, ip (= gateway) | `GOOD` (IP quality: `SECURITY_RISK`) |
| Failed login (wrong password / unknown email) | **NO** | Only anonymous morgan/nginx line with status 401 | — | `MISSING_LOG` · `MISSING_SECURITY_EVENT` (P0) |
| Login blocked by account gate (inactive / unverified / suspended / institution pending) | **NO** | 403 in access log only | — | `MISSING_SECURITY_EVENT` (P1) |
| Logout | **NO** | `auth.service.logout()` returns a message; JWT stays valid until expiry | — | `MISSING_SECURITY_EVENT` (P2) |
| Session creation / tracking | **NO** | Stateless JWT (`expiresIn: JWT_EXPIRES_IN` = 7d), no refresh, no revocation list, no session table | — | `OBSERVABILITY_GAP` |
| Token expiry / invalid token | **NO** | 401 from `auth.middleware`, access log only | — | `MISSING_SECURITY_EVENT` (P2) |
| Organization switch (`setActiveOrganization`) | **NO** | — | — | `MISSING_LOG` (P2) |
| Registration | YES | `USER_REGISTERED`, `INSTITUTION_USER_REGISTERED` (actor NULL) | email, full_name / organizationId | `GOOD` (PII: `PRIVACY_REVIEW_REQUIRED`) |
| Email verification (self OTP) | PARTIAL | `email_verification_otps` (hash, attempts); admin verifications audited (`USER_EMAIL_VERIFIED`, `EMAIL_VERIFIED_ADMIN`, `BULK_EMAIL_VERIFIED`); self-verification writes no audit row | | `MISSING_LOG` (P3) |
| Password reset | **YES** | `PASSWORD_RESET_REQUESTED` → `_OTP_VERIFIED` → `_COMPLETED`; OTP rows hashed; email masked in app logs | email | `GOOD` |
| Failed OTP attempts | PARTIAL | `attempts_count` on OTP rows (BUSINESS DATA); no audit event | | `MISSING_SECURITY_EVENT` (P2) |
| JWT payload | — | `{userId, roles, universityId, isGlobal, portalType}` — no PII | | `GOOD` |

---

## 6. Security Logging

### 6.1 Security Coverage Matrix

| Event | Logged? | Destination | Actor identity | IP | User-Agent | Rating |
|---|---|---|---|---|---|---|
| Successful login | **YES** | `audit_logs` + `users.last_login_at` + access logs | YES | Gateway IP only (audit) / real IP in host nginx | NO (audit) / YES (nginx, unlinked) | PARTIAL |
| Failed login | **NO** | access logs (status 401) | NO | host nginx only | host nginx only | **MISSING (P0)** |
| Logout | **NO** | access log line only | NO | — | — | MISSING (P2) |
| Password change (self, authenticated) | **N/A** | No self-service change-password endpoint exists | — | — | — | N/A |
| Password reset | **YES** | `audit_logs` ×3 actions; admin reset `USER_PASSWORD_RESET` | YES | NO (self flow) / gateway (admin) | NO | GOOD |
| Role change | **PARTIAL** | `USER_UPDATED.new_values.role_codes` (old roles **not** captured); `ROLE_PERMISSIONS_UPDATED` old+new | YES | gateway | NO | PARTIAL · `AUDIT_GRANULARITY_REVIEW` |
| Account deactivation | **YES** | `USER_STATUS_CHANGED`, `ACCOUNT_DISABLE`/`_REJECT`/`_ACTIVATE`, `ORGANIZATION_UPDATED.status` | YES | gateway | NO | GOOD |
| Permission denial (403) | **NO** | access logs only (no user id) | NO | — | — | MISSING (P1) |
| Cross-org denied access | **NO** | 403/404 from scope guards (`assertOrganizationAccess`, `resolveUniversityIdFilter`) not recorded | NO | — | — | MISSING (P1) |
| Session expiry | **NO** | 401 in access log | NO | — | — | MISSING (P2) |
| Rate-limit hit (429) | **NO** | access log status only; limiter keyed on shared gateway IP | NO | — | — | MISSING (P1) + `SECURITY_RISK` |
| Audit-log read by admin | **NO** | reading `/audit-logs` is not itself audited | — | — | — | MISSING (P2) |

### 6.2 Key security findings

| ID | Finding | Evidence | Class |
|---|---|---|---|
| S-1 | **Client IP collapsed to Docker gateway** | `app.js:18` `app.set('trust proxy', 1)` (hard-coded; `env.TRUST_PROXY` is parsed but unused). Proxy chain has 2 hops. Audit IP prefixes: `172.19.x.x` 1,056 rows (all since container cutover); earlier rows show `::1` 886, `10.2x.x.x` ~600 (previous hosting proxy), `127.0.x.x` 93. | `SECURITY_RISK`, `OBSERVABILITY_GAP` (P0) |
| S-2 | **All rate limiters share one key** | `rateLimit.middleware.js` keys on `req.ip` → global auth limit 60/15 min (server env) and API 1,200/15 min shared by all users → brute-force not attributable; lockout of all users possible. | `SECURITY_RISK` (P0) |
| S-3 | **JWT in query string** | `auth.middleware.js:19` accepts `req.query.access_token` / `req.query.token` on GET; used by `frontend/src/utils/protectedUploadUrl.js:24` and `features/analytics/commandCenter.service.js:58` (SSE). Morgan `:url`, container nginx `$request`, host nginx `$request` log full URL. Current retained logs: 0 occurrences. | `SECURITY_RISK` (P1, latent) |
| S-4 | No failed-auth / denial events | §5, §6.1 | `MISSING_SECURITY_EVENT` |
| S-5 | Audit table not tamper-evident | No FK, no trigger, no REVOKE, no hash chain; app DB role can `UPDATE/DELETE`; scripts insert directly with arbitrary names. | `SECURITY_RISK` (P1) |
| S-6 | No external error monitoring / alerting | No Sentry/OTel; `SENTRY_DSN` unset; no log shipping. | `OBSERVABILITY_GAP` |
| S-7 | Host nginx error log = scanner probes only; no app-level WAF signal | `error.log*` small (≤4.3 kB/day) | `GOOD` (quiet) |

---

## 7. Admin Actions

| Admin action | Audited? | Action name(s) | Notes |
|---|---|---|---|
| Create / update / status / activate user | YES | `USER_CREATED`, `USER_UPDATED`, `USER_STATUS_CHANGED`, `USER_ACTIVATED` | Bulk "activate all pending" loops `activateUser` → one row per user (GOOD). |
| Role assignment on user | PARTIAL | inside `USER_UPDATED` | Old role set missing. |
| Role permission matrix | YES | `ROLE_PERMISSIONS_UPDATED` | old + new permission codes. |
| Admin password reset | YES | `USER_PASSWORD_RESET` | |
| Email verification (single/bulk) | YES | `USER_EMAIL_VERIFIED`, `BULK_EMAIL_VERIFIED` | Bulk stores counts + filters, not user list → `AUDIT_GRANULARITY_REVIEW`. |
| Users export | YES | `USERS_EXCEL_EXPORTED` | filename, count, filters. |
| Reviewer ↔ university | YES | `REVIEWER_UNIVERSITY_ASSIGNED/UNASSIGNED` | |
| Universities create/update | **NO** | — | `universities.service.js` `createUniversity`, `updateUniversity` — `MISSING_LOG` (P1). |
| Platform settings update | **NO** | — | `settings.service.js updateSettings` — `MISSING_LOG` (P1). |
| KPI target set | NO | — | P3. |
| Qualification policy upsert | NO | — | `fieldTraining.qualification.service.js upsertUniversityPolicy` — P2. |
| Notification rules / templates / manual send / retry | YES (template update: NO) | `NOTIFICATION_*` | `updateTemplate` not audited (P3). |
| Announcements, popups, help, user guides | YES | see §4 | |
| Audit log viewing | NO | — | P2. |

---

## 8. Users

| Event | Audited | Business record | Notes |
|---|---|---|---|
| Registration | YES (actor NULL) | `users` | stores email + full name in audit JSON |
| Profile edit by admin | YES | | old/new snapshot includes email, phone, full name |
| Self profile edit | Not found as audited | | P3 |
| Status / activation | YES | | |
| Account deletion lifecycle | YES (5 actions) | `account_deletion_requests` | Anonymization does **not** scrub prior audit JSON (`PRIVACY_RISK`). |
| Last login | — | `users.last_login_at` | Overwritten each login. |
| User activity view | — | `users.repository.findRecentAuditForUser` (last 20 audit rows where `user_id` or `entity_id` = user) | Rows are not re-filtered by university scope → `PRIVACY_REVIEW_REQUIRED` (low). |

## 9. Organizations

Audited: `ORGANIZATION_CREATED/UPDATED`, `ORG_BRANCH_CREATED/UPDATED`, `ORG_DEPARTMENT_CREATED`, `ORG_ASSIGNMENT_CREATED`, `EMAIL_VERIFIED_ADMIN`, `ACCOUNT_ACTIVATE/REJECT/DISABLE`.
Not found: department update/delete, assignment update/removal, branch delete (if exposed) → `MISSING_LOG` (P2). Organization-scoped admins have **no read access** to their own organization's audit rows (scope logic only handles `admin` + `universityId`) → `OBSERVABILITY_GAP`.

## 10. Courses

| Area | Audited | Not audited |
|---|---|---|
| Course CRUD (`courses.service`) | create, update, publish, archive | sections create/update/delete, lessons create/update/delete/reorder/publish-all (P2) |
| Training programs | create, update (`COURSE_UPDATED`), publish | cohort create, enrollment create, **enrollment import commit** (P1), session create |
| Trainers | assign / update / revoke / create trainer user | |
| Materials & recorded lectures | full CRUD | |
| Completion | `TRAINING_FINALIZED`, `TRAINING_REOPENED`, `FINAL_EVALUATION_REOPENED` | `approveCompletion` (emits `COURSE_COMPLETED` domain event only) (P1); trainer evaluation `saveDraft`/`submitEvaluation` (P2) |
| Lesson training (`lessonTraining.service`) | — | start, submitFile, submitAnswers, admin upsert (P3) |

## 11. Assignments (course tasks)

| Event | Audited | Detail |
|---|---|---|
| Task create / update | YES | `TASK_CREATED`, `TASK_UPDATED` |
| Student submission | YES | `TRAINING_TASK_SUBMITTED` (attemptNo, fileCount, totalBytes — no file names/content: `GOOD`) |
| Resubmission | **NO** | domain event only |
| **Grading** | **NO** | `trainingTaskWorkflow.gradeTask` emits `TASK_GRADED` domain event; no audit, no old/new score → `MISSING_LOG` (P1) |
| Request revision / reopen submission | **NO** | P1 |
| Draft attachment upload/delete | **NO** | `taskSubmissionFiles.service` (P2) |
| Attachment download | **NO** | P2 |

Note: domain events (`emitDomainEvent`) only feed notification rules; if no active rule matches they leave **no trace** at all.

## 12. Field Training

Strongest-covered domain. Audited: opportunity lifecycle, application approve/reject, start, expulsion request/expel, assessments publish/update, hours update, eligibility recalculation/backfill, submission review with original/new score, attendance (all paths), evaluation templates/policy/ratings/reports, ZIP and Excel exports, completion letters issue/regenerate/revoke, supervisor imports, recorded lectures.

| Gap | Class | Priority |
|---|---|---|
| Student **apply** / **cancel application** not audited | `MISSING_LOG` | P1 |
| FT task create / update / delete (`createOpportunityTask` etc.) not audited | `MISSING_LOG` | P1 |
| Student task file submission (`submitTaskFile`) not audited | `MISSING_LOG` | P2 |
| Evaluation comments update, report defaults save | `MISSING_LOG` | P3 |
| Pre/post assessment attempts | BUSINESS DATA only (attempt rows) — acceptable | — |
| `syncCompletionLettersWithEligibility` (revocations audited, sync run summary not) | `AUDIT_GRANULARITY_REVIEW` | P3 |
| 551/591 `FIELD_TRAINING_SUBMISSION_REVIEWED` rows have NULL actor (scripted reconciliation) | `AUDIT_GRANULARITY_REVIEW` | P2 |
| `universityStudentNumber` and `taskTitle` duplicated into audit JSON | `PRIVACY_REVIEW_REQUIRED` | P2 |

## 13. Attendance

| Path | Audited | Granularity |
|---|---|---|
| FT window open/close | YES | session, mode, duration; 93/104 closes are SYS (expiry) |
| FT electronic confirm | YES (617) | per student + IP (gateway) ; business row also stores `ip_address` + `device_info` |
| FT manual update | YES (1,617) | old/new status, `manual_reason`, `operation` — `GOOD` |
| FT finalize absent | YES (125) | per student |
| FT mark-all-present | YES (31) | **summary only** (`previous_statuses` summary, counts) — affected student IDs not listed → `AUDIT_GRANULARITY_REVIEW` |
| Training-program attendance set | YES (`TRAINING_ATTENDANCE_SET`) | |
| Training-program mark-all-present | YES | `{mode, updated}` only → `AUDIT_GRANULARITY_REVIEW` |
| Training-program open window / confirm | **NO** | P2 |
| Legacy cohort attendance (`attendance.service saveSessionAttendance`, `updateAttendanceRecord`) | **NO** | P2 (legacy module) |
| Code attempts | BUSINESS DATA (`field_training_attendance_window_attempts`, 656) | |

## 14. Assessments

| Module | Audited |
|---|---|
| FT assessments publish / update | YES |
| Training-program assessments (`trainingAssessment.service`: upsert, publish, attempts, grading) | **NO** (scripts wrote `training_assessment.*` historically) → P1 for `gradeAttempt`/`publishAssessment`, P3 for attempts |
| Legacy assessments / grades / submissions / rubrics (`assessments`, `grades`, `submissions`, `rubrics` modules) | **NO** → P2 (`finalizeGrade`, `updateGrade` P1 if module is in use) |
| Score / eligibility changes (FT) | YES — `FIELD_TRAINING_SUBMISSION_REVIEWED` (original/new score), backfill (previous/new hours + eligibility), `field_training.hours.update` (difference) — `GOOD` |

## 15. Recorded Lectures

| Data | Category | Detail |
|---|---|---|
| CRUD / import / sync / reorder / publish / hide | AUDIT EVENTS | Fully audited (FT and course variants). |
| Student watching | ANALYTICS / BUSINESS DATA | Frontend heartbeat every **10 s** (`recordedLectureWatchTracker.js` `HEARTBEAT_INTERVAL_SECONDS = 10`, keepalive beacon on unload). Each heartbeat runs a transaction that **deletes all segments** for the progress row and **re-inserts** the merged set, then updates the progress row (`fieldTraining.recordedLectures.watch.repository.js:118–160`). |
| Volume | | 12,935 segment rows across 132 progress rows (~98 per row), 16 MB in ~1 month — the largest "log-like" table. |
| Rate limit | | Heartbeat limiter 90/min (per IP — shared gateway IP, see S-2). |
| Audit of viewing | Not audited (correct — this is analytics). |

Classification: `PERFORMANCE_RISK` (write amplification and dead tuples), `NO_RETENTION_POLICY_FOUND`.

## 16. Certificates

| Certificate type | Issuance audited | Status change | Download audited |
|---|---|---|---|
| Micro-credential `certificates` | YES via `certificate.issue` (event dispatcher) | YES `certificate.status` | n/a |
| Training program `training_certificates` (`trainingPrograms.service.issueCertificateCore`) | **NO** → `MISSING_LOG` (P1) | Revocation inside `TRAINING_REOPENED` only | NO |
| Public verification `GET /certificates/verify/:code` | NO (public) | | Access log only (code in URL) |

## 17. Completion Letters

| Event | Audited |
|---|---|
| Issue / regenerate (single and per-letter in bulk job) | YES — `application_id`, `source_data_hash` (no PDF content: `GOOD`) |
| Revoke | YES — previous status, reason, `pdfPreserved` (failure swallowed: `.catch(() => null)` after raw SQL update → `AUDIT_GRANULARITY_REVIEW`) |
| Bulk issue job start | Job row only (`completion_letter_jobs`); no audit summary (P3) |
| **Student download / manager download / academic download / preview** | **NO** (P1 for manager/academic downloads of other people's letters) |
| Issued-letters ZIP download | **NO** (P1) |

## 18. Micro-Credentials

`microCredentials.service` create/update/status, `learningOutcomes` CRUD, `cohorts`, `sessions`, `tracks`: **no audit events**. Certificates and recognition requests use the legacy dispatcher (audited). Classification: `MISSING_LOG` (P2 — legacy module; production usage appears low).

## 19. Reports and Exports

| Export / report | Audited | Action |
|---|---|---|
| Analytics reports (`/reports/*`) read | YES | `report.read` (**not caught** — an audit failure turns a computed report into HTTP 500) |
| Analytics reports export | YES | `report.export` |
| FT reports (global/university/student/applications) read/export/generate | YES | `report.*` with `row_count` for Excel (`GOOD`) |
| FT students Excel export | YES | `auditStudentsExcelExport` → `report.export` |
| Users Excel | YES | `USERS_EXCEL_EXPORTED` |
| FT Excel evaluation | YES | `FT_EXCEL_EVALUATION_EXPORTED` |
| Evaluation ZIPs, supervisor ZIPs, bulk student reports job | YES | `FT_EVAL_*_ZIP_DOWNLOADED`, `FIELD_TRAINING_STUDENT_REPORTS_BULK_EXPORTED` |
| Bulk student reports **ZIP download** (job result) | NO | P2 |
| Comprehensive student report PDF (admin/instructor) | NO | P1 |
| Opportunity final / comprehensive PDF | NO | P2 |
| Evaluation report single download / student download | NO | P3 |
| Training program report PDF/Excel, enrollment report PDF | NO | P2 |
| Super-admin analytics PDF (`/analytics/export/pdf`) | NO | P2 |

## 20. File Upload/Download

| Operation | Audited | Business record | Logs |
|---|---|---|---|
| `files.service uploadDirect` / `confirmUpload` | **NO** | `files` row: uploader, `original_name`, mime, size, storage key | morgan line |
| `files.service deleteFile` | **NO** | soft delete `deleted_at` | |
| Signed download URL (`GET /files/:id/download-url`) | **NO** | — | morgan line (URL has file UUID only) |
| `/uploads/*` (authenticated static) | **NO** | — | morgan + both nginx (JWT may be in `?access_token=`) |
| Task submission attachments (upload/delete/download) | **NO** | `training_task_submission_files` | |
| FT submission download / download-url | **NO** | | |
| Template / instruction file downloads | **NO** | | |
| Supervisor import upload | YES (summary) | filename + `file_hash` | |
| R2 object access logs | Not configured in repository | | `OBSERVABILITY_GAP` |

File contents are never written to audit payloads (`GOOD`). Classification: `MISSING_LOG` (P1 for deletes and for downloads of other users' files; P2 for uploads).

## 21. Notifications

* `notifications` (14,607 rows, 10 MB, since 2026-07-06; ~2,100/month) and `notification_deliveries` (857) are BUSINESS DATA with **no retention/purge** (`NO_RETENTION_POLICY_FOUND`).
* Read/archive/preference changes are not audited (correct for user-side state; P3).
* Admin rule/template/manual-send/retry are audited.
* Unknown domain events log `warn '[notificationEngine] UNKNOWN_EVENT'` (event type only).
* Email delivery failures log masked recipient (`ab***@domain`) and provider error message — `GOOD`.
* Push: Firebase disabled; `mobile_push_registrations` empty.

## 22. Analytics/Realtime

| Item | Category | Storage | Notes |
|---|---|---|---|
| Command center overview / live SSE (`/analytics/command-center/live`) | ANALYTICS (read side) | **Not stored**; computed from `audit_logs` + domain tables every **8 s** per connected admin (`analytics.controller.js:215`) | Scoped via `scopeAuditSql(scope)`; roles `super_admin`, `admin`. JWT passed in `?access_token=` (S-3). `PERFORMANCE_RISK` (low today). |
| "Currently watching" | ANALYTICS | derived from progress `last_watched_at` | |
| Recorded-lecture heartbeat | ANALYTICS / BUSINESS DATA | §15 | |
| Attendance polling | — | no storage; dedicated limiter | |
| Help search | ANALYTICS | `help_search_logs.query` free text (22 rows) | `PRIVACY_REVIEW_REQUIRED` (users may type names/IDs) |
| Help article views, popup/announcement states, onboarding progress | ANALYTICS | own tables | no retention |
| KPI | METRICS | `kpi_snapshots` (18), `kpi_alerts` (0) | |
| Perf timing | METRICS | stdout when `PERF_LOGGING` set (disabled) | Would log raw SQL text → `PRIVACY_REVIEW_REQUIRED` if enabled. |

## 23. Frontend Console Logging

* `frontend/src`: **1** `console.*` call in total (`console.error` ×1); 0 `log`/`warn`/`info`/`debug`. `GOOD`.
* No remote error reporting (no Sentry/LogRocket/etc.): client-side crashes are invisible to operators → `OBSERVABILITY_GAP`.
* PII in SPA URLs: `/verify-email?email=…` built in `resolveAuthenticatedLandingRoute.js:53`, `RegisterForm.jsx:129`, `InstitutionRegisterPage.jsx:130`. Client-side navigation does not hit the server, but a reload/direct open writes the email into host + container nginx access logs. Current retained logs: 0 occurrences. `PRIVACY_RISK` (low).

## 24. Backend Application Logging

| Source | Count | Content | Class |
|---|---|---|---|
| `log()` structured calls | 30 | warn/error/info with codes (`PDF_RENDER_FAILED`, `MISSING_FONT`, policy resolution info, masked email) | `GOOD` |
| `console.*` | 25 (3 inside `logger.js`) | `server.js` lifecycle; `Unhandled promise rejection` / `Uncaught exception` print the full error object (stack) to stdout **even in production**; `audit.service` P2021 warning; notification/push warnings; 2 FT `console.error` with error object | `PRIVACY_REVIEW_REQUIRED` (Prisma errors can embed query values), `OBSERVABILITY_GAP` (unstructured) |
| 5xx errors | per error | `requestId`, `code`, `prismaCode`, `name`, message; **no stack in prod**; response `REQ-…` id | `GOOD` |
| 4xx errors | none | not logged | `OBSERVABILITY_GAP` |
| Request bodies | never | | `GOOD` |
| Production sample (18 h) | 6,368 lines | 6,311 morgan (99.1 %), 19 JSON info, 0 warn, 0 error, 0 stack-like, 0 bearer/password mentions | |
| `x-request-id` in morgan | 0 / 6,311 populated | `:req[x-request-id]` reads request header nobody sets | `OBSERVABILITY_GAP` |
| `LOG_LEVEL` | unset / not implemented | everything is emitted | |

## 25. Nginx Logs

| Property | Host nginx (Ubuntu, 1.24) | Frontend container nginx |
|---|---|---|
| Access log | `/var/log/nginx/access.log` — **default `combined`** (no custom `log_format`) | `main` format → `/dev/stdout` |
| Fields | remote_addr (real client), time, `$request` (full URL incl. query), status, bytes, referer, user-agent | remote_addr (host proxy), `$request`, status, bytes, referer, UA, `$http_x_forwarded_for` (real client) |
| Shared? | **Yes — single file for all 5 vhosts** (eprojecto + 4 other tenants) | eprojecto only |
| Error log | `/var/log/nginx/error.log` default level; tiny; scanner probes only | `notice` → stderr |
| Rotation | logrotate daily, `rotate 14`, `compress`, `delaycompress`, `0640 www-data:adm` | Docker json-file 10 MB × 3 |
| Volume | ~7.7 MB/day, ~35 k lines/day; 12 MB on disk total | ~5.3 MB/day (incl. healthcheck noise) |
| Request ID | not generated / not forwarded | not forwarded |
| Health-check noise | — | `Wget` `GET /` every 30 s (~2,880 lines/day) |
| Query-string secrets (counts) | `access_token=` 0, `token=` 0, `email=` 0 (current + .1 + all .gz) | 0 |

Classifications: `RETENTION_GAP` (14 days; multi-tenant mixing), `PRIVACY_RISK` (real IP + UA + full URL for 14 days, shared file), `EXCESSIVE_LOG` (healthcheck), `OBSERVABILITY_GAP` (no request id, no upstream timing).

## 26. Docker Logs

| Container | Driver / opts | Current file | Rate | Effective history |
|---|---|---|---|---|
| `battechno-lms-backend` | json-file, `max-size 10m`, `max-file 3` (daemon default) | 1.26 MB after ~18 h | ~1.7 MB/day | ≤ ~17 days **or until next redeploy** (container recreate deletes logs) |
| `battechno-lms-frontend` | same | 3.97 MB after ~18 h | ~5.3 MB/day | ≤ ~5–6 days or next redeploy |

`docker-compose` defines no per-service logging section (daemon defaults apply). No log shipping. Classification: `RETENTION_GAP`, `OBSERVABILITY_GAP`.

## 27. Database/Infrastructure Logs

| Source | Status |
|---|---|
| Neon PostgreSQL server logs / query logs | Managed by Neon; not accessible or configured from the application; retention per Neon plan — **not verified**. No `pgaudit`. |
| Prisma query logging | Not enabled (perf middleware disabled). |
| journald | 94.8 MB (systemd defaults). |
| Host auth logs (`btmp`, `wtmp`, rsyslog) | Default Ubuntu logrotate. |
| Monarx agent / unattended-upgrades | Present in logrotate. |
| Backups | Deployment backups under `/root/deployment-backups/` (code, not logs). |
| Disk | 193 GB, 9 % used — no capacity risk from logs. |

## 28. PII and Sensitive Data

### 28.1 Privacy Matrix

| Data | `audit_logs` | Other DB tables | Backend logs (morgan/JSON) | Nginx logs | Docker logs | Risk |
|---|---|---|---|---|---|---|
| **User ID** | YES (`user_id`, `entity_id`, JSON ids) | everywhere | URLs contain entity UUIDs | URLs | via morgan/nginx | Low |
| **Name** | YES — `full_name` in 594 rows (registration, user create/update); session/opportunity/task titles | users, files | NO | NO | NO | `PRIVACY_REVIEW_REQUIRED` |
| **Email** | YES — 1,067 rows (USER_REGISTERED 574, PASSWORD_RESET_* 419, INSTITUTION_USER_REGISTERED 54, USER_CREATED/UPDATED) | users, OTP tables | **masked** (`ab***@x`) | possible via `/verify-email?email=` (0 found) | same | `PRIVACY_RISK` (survives deletion) |
| **Phone** | YES — USER_CREATED / USER_UPDATED snapshots | users | NO | NO | NO | Low/Medium |
| **University number** | YES — `universityStudentNumber` 551 rows (FT submission review) | users | NO | NO | NO | `PRIVACY_REVIEW_REQUIRED` |
| **IP** | YES — 2,666 rows (values = proxies, not clients) | `field_training_attendance.ip_address` | morgan `:remote-addr` (gateway) | **real client IP** (host), XFF (container) | YES | `PRIVACY_RISK` (nginx) / data-quality issue (DB) |
| **User-Agent** | NO | `field_training_attendance.device_info` | NO | YES (both) | YES | Medium |
| **Password** | NO (0 real hits) | bcrypt hash in `users` only | NO | NO | NO | `GOOD` |
| **JWT** | NO | NO | Only if `?access_token=` used (0 found) | same (0 found) | same | `SECURITY_RISK` (latent) |
| **Cookies** | NO | NO | NO (morgan format excludes) | NO (combined/main exclude) | NO | `GOOD` |
| **Request Body** | Partial — selected fields / spread of validated update `data` (e.g. `USER_UPDATED`) | — | NO | NO | NO | `GOOD` / review spreads |
| **Uploaded File Name** | YES — import `filename`, export `filename`, bulk `backup_file` | `files.original_name` | NO | URL path only for `/uploads/` keys | — | Low |
| **OTP / reset tokens** | NO | hashed only | NO | NO | NO | `GOOD` |
| **File contents** | NO | — | NO | NO | NO | `GOOD` |

### 28.2 Notable privacy findings

* **P-1 Audit PII survives account deletion** — `accountDeletion.repository.anonymizeUserIdentity` anonymizes `users` and deletes OTP rows but does not touch `audit_logs` JSON. `PRIVACY_RISK`.
* **P-2 Person names embedded in `action_type`** (two script action names). `PRIVACY_REVIEW_REQUIRED`.
* **P-3 Shared multi-tenant host access log** holds real IP + UA + full URLs of all tenants in one file for 14 days. `PRIVACY_RISK`.
* **P-4 Free-text search terms** — 21 list endpoints accept `search` query params; typed names/emails appear in morgan + nginx URLs. `help_search_logs.query` stores free text. `PRIVACY_REVIEW_REQUIRED`.
* **P-5 Process-level crash logs** print raw error objects (may include Prisma query values). `PRIVACY_REVIEW_REQUIRED`.

## 29. Retention

| Store | Retention mechanism | Effective retention | Class |
|---|---|---|---|
| `audit_logs` | none | indefinite (oldest 2026-05-19) | `NO_RETENTION_POLICY_FOUND` |
| `notifications`, `notification_deliveries` | none | indefinite | `NO_RETENTION_POLICY_FOUND` |
| `email_verification_otps`, `password_reset_otps` | deleted only on account deletion; expired rows never purged | indefinite | `NO_RETENTION_POLICY_FOUND` |
| `help_search_logs`, `help_article_views`, popup/announcement states | none | indefinite | `NO_RETENTION_POLICY_FOUND` |
| Recorded-lecture progress / segments | segments replaced per heartbeat; rows kept with progress (cascade) | indefinite | `NO_RETENTION_POLICY_FOUND` |
| Attendance attempts, supervisor import audit, letter jobs | none | indefinite | `NO_RETENTION_POLICY_FOUND` |
| `kpi_snapshots` | none | indefinite | `NO_RETENTION_POLICY_FOUND` |
| Host nginx | logrotate daily × 14 | 14 days | `RETENTION_GAP` (too short for incident forensics; no archive) |
| Docker json-file | 10 MB × 3, deleted on recreate | ~5–17 days or since last deploy | `RETENTION_GAP` |
| journald | systemd default | size-capped | — |
| Neon | provider-managed | not verified | `OBSERVABILITY_GAP` |

No scheduled cleanup job exists in `backend/src` (no `cron`, no `deleteMany` on these tables except account deletion and the heartbeat rewrite).

## 30. Authorization to View Logs

| Log / data | Who can read | Scope enforcement | Class |
|---|---|---|---|
| `GET /api/v1/audit-logs`, `/:id` | Roles from `AUDIT_LOG_READ_ROLE_CODES` (default `super_admin,admin`) | `auditScopeWhere`: super admin = all; `admin` with `universityId` = own university rows only (rows without `university_id` hidden; detail endpoint returns 403 for them); every other role = empty set | `GOOD` |
| List view fields | id, user (name+email), university, action, entity, timestamp; detail adds old/new JSON + IP | | |
| Command center (overview + live SSE) | `super_admin`, `admin` | `scopeAuditSql(scope)` | `GOOD` |
| Admin dashboard recent activity | scoped by `resolveUniversityIdFilter`; non-global without scope → `[]` | | `GOOD` |
| User detail "recent activity" | user-management readers | not re-scoped per audit row | `PRIVACY_REVIEW_REQUIRED` (low) |
| Organization (company) admins | **no access** to their organization's audit rows | `organization_id` column unused for read | `OBSERVABILITY_GAP` |
| 49 % of rows with no university/org | super admin only | | `AUDIT_GRANULARITY_REVIEW` |
| Host nginx logs | root / `adm` group (`0640 www-data:adm`) | OS | `GOOD` |
| Docker logs | root / docker group | OS | `GOOD` |
| Database (all tables) | Anyone with `DATABASE_URL` (app role) — can also modify audit rows | none | `SECURITY_RISK` |
| Reading audit logs is itself audited | NO | | `MISSING_LOG` (P2) |

**Cross-organization log isolation: YES at the API layer** (university-scoped; organization-level read missing). **Audit modification protection: PARTIAL** — append-only by code convention only.

## 31. Performance Impact

| Item | Cost | Failure semantics | Class |
|---|---|---|---|
| `recordAudit` | One synchronous `INSERT` (6 indexes) awaited inside the request; ~43 rows/day today | `audit.service` rethrows all errors except missing table. Callers vary: login & FT report audits are try/catch (request continues); letter revoke `.catch(() => null)` (silent loss); **`reports.controller.auditReportRead` uncaught → HTTP 500 after report computed** | `PERFORMANCE_RISK` (low), `AUDIT_GRANULARITY_REVIEW` |
| `recordAuditMany` (`createMany`) | batched for bulk ops | | `GOOD` |
| Recorded-lecture heartbeat | Every 10 s per active viewer: transaction = SELECT + DELETE all segments + INSERT ~N segments + UPDATE progress; retry on P2034/P2024 | 16 MB for 12,935 live rows indicates bloat/dead tuples | `PERFORMANCE_RISK` (medium as usage grows) |
| Command-center SSE | Query bundle every 8 s per open admin tab | | `PERFORMANCE_RISK` (low) |
| Morgan | One stdout line per request (attendance polls & heartbeats dominate) | | `EXCESSIVE_LOG` (volume, low cost) |
| Perf timing middleware | disabled | | — |
| Audit table growth | 5.6 MB / 10 k rows → negligible | | — |

## 32. Missing Critical Events

| # | Missing event / capability | Priority | Class / Flag |
|---|---|---|---|
| 1 | Real client IP in backend (`trust proxy` hop count) — prerequisite for every security log and limiter | **P0** | `SECURITY_RISK`, `OBSERVABILITY_GAP` |
| 2 | Failed login attempts (email/user id if known, reason, IP, UA) | **P0** | `MISSING_SECURITY_EVENT` |
| 3 | Login denied by account gate (inactive, unverified, suspended, pending institution) | P1 | `MISSING_SECURITY_EVENT` |
| 4 | 403 permission denials and cross-organization access denials (actor, route, target org) | P1 | `MISSING_SECURITY_EVENT` |
| 5 | Rate-limit (429) events | P1 | `MISSING_SECURITY_EVENT` |
| 6 | Course-task grading / revision / reopen with old → new score | P1 | `MISSING_LOG` |
| 7 | Training certificate issuance (`training_certificates`) and course completion approval | P1 | `MISSING_LOG` |
| 8 | Downloads of other users' sensitive artefacts: completion letters (manager/academic), letters ZIP, comprehensive student PDF, submission files | P1 | `MISSING_LOG` |
| 9 | File delete; enrollment import commit; universities create/update; settings update | P1 | `MISSING_LOG` |
| 10 | FT student apply / cancel; FT task create/update/delete | P1 | `MISSING_LOG` |
| 11 | Role change old value (roles before update) | P1 | `AUDIT_GRANULARITY_REVIEW` |
| 12 | Audit table tamper protection (DB privileges / trigger / hash chain) | P1 | `SECURITY_RISK` |
| 13 | Logout; token expiry; organization switch | P2 | `MISSING_SECURITY_EVENT` |
| 14 | Failed OTP attempts (verification & reset) as events | P2 | `MISSING_SECURITY_EVENT` |
| 15 | Audit-log read access | P2 | `MISSING_LOG` |
| 16 | File uploads; training-program assessments/grades; legacy grades/attendance; course sections/lessons | P2 | `MISSING_LOG` |
| 17 | Bulk operations listing affected IDs (mark-all-present, bulk email verify) | P2 | `AUDIT_GRANULARITY_REVIEW` |
| 18 | Request ID correlation across nginx → morgan → error → audit | P2 | `OBSERVABILITY_GAP` |
| 19 | Self profile edits, self email verification, notification template update, KPI target | P3 | `MISSING_LOG` |
| 20 | Evaluation comments / report defaults; lesson-training actions | P3 | `MISSING_LOG` |

## 33. Excessive Logging

| Item | Evidence | Class | Recommendation (future) |
|---|---|---|---|
| Frontend container healthcheck access lines | `Wget GET /` every 30 s ≈ 2,880 lines/day, majority of a 30 MB cap | `EXCESSIVE_LOG` | Exclude healthcheck UA/path from access log. |
| Morgan logs every poll/heartbeat | 99 % of backend log lines; attendance polling + 10 s heartbeats | `EXCESSIVE_LOG` | Sample or skip high-frequency endpoints; keep status ≥ 400. |
| `report.read` on every report view (with `summary` JSON) | 287 rows; dashboard refreshes create rows | `AUDIT_GRANULARITY_REVIEW` | Keep for exports; consider sampling/deduping reads. |
| `FT_EVAL_REPORT_REGENERATED` | 1,193 rows (bulk regenerations) | `AUDIT_GRANULARITY_REVIEW` | Summarize bulk runs in one parent event + child ids. |
| Duplicated PII in audit JSON (email, name, university number) | §28 | `PRIVACY_RISK` | Store ids; resolve names at read time. |
| Watch-segment rewrite | §15 | `PERFORMANCE_RISK` (business data, not a log) | Append/merge incrementally. |
| Not excessive | No request bodies, no stack traces in prod, no SQL logging, frontend console nearly silent | `GOOD` | — |

## 34. Recommended Logging Architecture

*(Design only — nothing implemented.)*

1. **Correct client identity first** — set trust-proxy to the exact hop count (or trusted subnet list) and forward a request ID from the host nginx (`$request_id` → `X-Request-Id`) through the container nginx; have Express reuse it.
2. **Three explicit streams**
   * **Security event log** (new `security_events` table or `audit_logs` with `category='security'`, `outcome`, `severity`, `user_agent`, `request_id`): login success/failure, account-gate denial, logout, token invalid/expired, 401/403/cross-org denials, 429, OTP failures, role/permission changes.
   * **Business audit** (`audit_logs`): keep current helper; add an action-name **registry/enum**, mandatory `actor_role`, `request_id`, `outcome`; store IDs not PII; one parent event for bulk operations with affected-ID arrays.
   * **Operational logs** (stdout JSON): one logger for everything (`console.*` → `log()`), `LOG_LEVEL`, request ID on every line, 4xx summary at `info`, redaction of `access_token`/`token`/`email` query params.
3. **Ship logs off-host** (e.g. Loki/Grafana, Better Stack, CloudWatch) with ≥ 90-day operational retention; add error monitoring (Sentry backend + frontend) with PII scrubbing.
4. **Remove JWTs from URLs** — short-lived signed URLs for uploads; cookie or one-time ticket for SSE.
5. **Tamper resistance** — dedicated DB role with `INSERT`/`SELECT` only on `audit_logs`, `BEFORE UPDATE/DELETE` trigger rejecting changes, optional hash chain; scripts must use the same helper and registered action names.
6. **Retention policy** (documented + scheduled job): security events 1 year, business audit ≥ 3–5 years (academic records) with PII minimization, notifications 180 days, OTP rows 30 days after expiry, analytics 12 months (aggregate then purge), host nginx 30–90 days archived, per-vhost access logs.
7. **Privacy** — per-vhost log files, IP truncation after N days, erase/pseudonymize audit PII on account deletion, never log free-text search terms in URLs (POST or redact).

## 35. Phase 2 Recommendations

Suggested future commit message (not executed): `feat: strengthen platform audit logging and observability`

| Order | Item | Priority | Effort |
|---|---|---|---|
| 1 | Fix trust-proxy hop count; verify `req.ip`, audit IP and rate limiter keys | P0 | S |
| 2 | Persist failed logins + account-gate denials (with IP/UA, no password) | P0 | S |
| 3 | Request-ID propagation nginx → Express → morgan → error → audit | P1 | S |
| 4 | Security events for 403 / cross-org / 429 / token expiry | P1 | M |
| 5 | Audit: course-task grading & revisions, training certificates, completion approval, file delete, enrollment import, universities, settings, FT apply/cancel, FT tasks | P1 | M |
| 6 | Audit downloads of completion letters, ZIPs, comprehensive PDFs, submission files | P1 | M |
| 7 | Capture old roles in `USER_UPDATED`; affected IDs in bulk events | P1 | S |
| 8 | Replace JWT query-string auth (signed URLs / SSE ticket); redact query tokens in all access logs meanwhile | P1 | M |
| 9 | Audit-table write-only DB role + update/delete trigger; action-name registry | P1 | M |
| 10 | Make `report.read` audit non-fatal (consistent failure semantics) | P2 | S |
| 11 | Off-host log shipping + Sentry (backend & frontend) | P2 | M |
| 12 | Retention jobs and documented policy for all tables in §29 | P2 | M |
| 13 | PII minimization in audit JSON; scrub on account deletion | P2 | M |
| 14 | Healthcheck/heartbeat log filtering; per-vhost nginx logs; longer host retention | P3 | S |
| 15 | Incremental watch-segment merge (remove delete+reinsert) | P3 | M |

---

## Appendix A — Master Table

| Area | Event/Data | Stored? | Destination | Fields | Retention | Who Can Access | Risk |
|---|---|---|---|---|---|---|---|
| Auth | Login success | YES | `audit_logs`, `users.last_login_at`, access logs | user, portal, source, IP(gateway) | indefinite / 14 d nginx | SA, scoped AD | IP quality (P0) |
| Auth | Login failure | NO | access logs (status only) | — | 14 d | root | `MISSING_SECURITY_EVENT` P0 |
| Auth | Logout | NO | — | — | — | — | P2 |
| Auth | Password reset | YES | `audit_logs`, OTP tables (hashed) | email | indefinite | SA, scoped AD | PII retention |
| Auth | Sessions | NO | stateless JWT 7 d | — | — | — | no revocation |
| Security | 401/403/429 | NO (status only) | access logs | URL, status | 14 d / ≤17 d | root | P1 |
| Admin | User CRUD/status/roles | YES / PARTIAL roles | `audit_logs` | old/new snapshot | indefinite | SA, scoped AD | PII in JSON |
| Admin | Role permissions | YES | `audit_logs` | old/new codes | indefinite | SA | — |
| Admin | Universities / settings | NO | — | — | — | — | P1 |
| Org | Institution/branch/dept/assignment | YES | `audit_logs` | names/status | indefinite | SA (org admins: none) | org read gap |
| Courses | Course/program CRUD, trainers, materials, lectures | YES | `audit_logs` | fields | indefinite | SA, AD | — |
| Courses | Sections/lessons, cohorts, enrollment import | NO | — | — | — | — | P1/P2 |
| Assignments | Submit | YES | `audit_logs` | attempt, file count/bytes | indefinite | SA, AD | — |
| Assignments | Grade / revise / reopen | NO | domain event only | — | — | — | P1 |
| Field Training | Lifecycle, attendance, evaluation, letters, exports | YES | `audit_logs` + domain tables | rich | indefinite | SA, scoped AD | PII (univ. number) |
| Field Training | Apply/cancel, FT tasks CRUD | NO | — | — | — | — | P1 |
| Attendance | FT all paths; program set/mark-all | YES (bulk = summary) | `audit_logs`, `field_training_attendance` (+IP, device) | status, reason | indefinite | SA, AD | granularity |
| Assessments | FT publish/update | YES | `audit_logs` | | indefinite | | — |
| Assessments | Program/legacy grading | NO | — | — | — | — | P1/P2 |
| Recorded lectures | Admin CRUD | YES | `audit_logs` | | indefinite | | — |
| Recorded lectures | Watching | ANALYTICS | progress + segments | intervals | indefinite | admins via reports | `PERFORMANCE_RISK` |
| Certificates | Micro-credential issue/status | YES | `audit_logs` | | indefinite | | — |
| Certificates | Training certificate issue | NO | — | — | — | — | P1 |
| Completion letters | Issue/regenerate/revoke | YES | `audit_logs` | app id, hash | indefinite | | — |
| Completion letters | Downloads / ZIP | NO | access log only | URL | 14 d | root | P1 |
| Micro-credentials | CRUD | NO | — | — | — | — | P2 |
| Reports | Read/export/generate | YES | `audit_logs` | type, filters, row_count, IP | indefinite | SA, AD | read audit can 500 |
| Files | Upload/delete/download | NO (metadata only) | `files` | uploader, original name | soft delete | — | P1/P2 |
| Notifications | In-app & deliveries | BUSINESS DATA | tables | | indefinite | user / SA | `NO_RETENTION_POLICY_FOUND` |
| Analytics | Command center SSE | not stored | computed | — | — | SA, AD | JWT in URL |
| Analytics | Help search | YES | `help_search_logs` | free-text query | indefinite | SA | `PRIVACY_REVIEW_REQUIRED` |
| Ops | Access log (app) | YES | morgan → Docker | IP(gateway), method, URL, status, size, ms | ≤17 d / redeploy | root | no request id |
| Ops | App errors | YES | JSON → Docker | requestId, code, message | ≤17 d | root | no external sink |
| Ops | Host nginx | YES | `/var/log/nginx` | real IP, URL, UA, referer | 14 d | root/adm | multi-tenant file |
| Metrics | KPI snapshots | YES | `kpi_snapshots` | aggregates | indefinite | SA | — |

## Appendix B — Server Log Table

| Log Source | Location | Format | Rotation | Approx Size | Contains PII |
|---|---|---|---|---|---|
| Host nginx access | `/var/log/nginx/access.log` (+ .1, .2–.14.gz) | nginx `combined` (all vhosts) | logrotate daily × 14, compress | ~7.7 MB/day; 12 MB total on disk | **Yes** — client IP, UA, full URL (possible search terms / email / token params) |
| Host nginx error | `/var/log/nginx/error.log` | default | daily × 14 | ≤ 4.3 kB/day | Client IP of scanners |
| Frontend container nginx access | stdout → Docker json-file | `main` (+ `$http_x_forwarded_for`) | 10 MB × 3 | ~5.3 MB/day | **Yes** — XFF client IP, UA, URL |
| Frontend container nginx error | stderr → Docker json-file | `notice` | 10 MB × 3 (shared) | small | IP |
| Backend morgan | stdout → Docker json-file | custom text (`remote-addr method url status length ms req-id`) | 10 MB × 3 | ~1.7 MB/day | Gateway IP only; URL params |
| Backend app logger | stdout/stderr → Docker json-file | JSON line | 10 MB × 3 (shared) | small (19 lines/18 h) | Masked emails only |
| Backend process crashes | stdout → Docker json-file | raw `console.error` | shared | rare | Possible (error objects) |
| journald | `/var/log/journal` | binary | systemd caps | 94.8 MB | system/service level |
| Host auth (`wtmp`/`btmp`) | `/var/log` | binary | logrotate | small | SSH source IPs |
| PostgreSQL (Neon) | provider | provider | provider | n/a | not verified |

## Appendix C — Business Audit Matrix

| Domain | Create | Update | Delete/Archive | Status/Decision | Bulk ops | Export/Download | Overall |
|---|---|---|---|---|---|---|---|
| Users | YES | YES (roles PARTIAL) | N/A (deletion lifecycle YES) | YES | YES (counts) | YES (export) | **YES** |
| Organizations | YES | YES | NO (dept/assignment removal) | YES | N/A | N/A | **PARTIAL** |
| Courses | YES | YES | YES (archive) / NO (sections, lessons) | YES | NO (enrollment import) | NO (program reports) | **PARTIAL** |
| Assignments | YES | YES | NO | NO (grading/revision) | N/A | NO (attachments) | **PARTIAL** |
| Field Training | YES | YES | YES (archive) | YES | YES | YES (most) / NO (comprehensive PDF) | **YES** (gaps: apply, tasks) |
| Attendance | YES | YES | N/A | YES | YES (summary) | N/A | **YES** (FT) / PARTIAL (program, legacy) |
| Assessments | YES (FT) / NO (program, legacy) | YES (FT) / NO | N/A | NO (grading) | N/A | N/A | **PARTIAL** |
| Certificates | YES (micro) / NO (training) | YES (status, micro) | NO | YES (micro) | N/A | NO | **PARTIAL** |
| Completion Letters | YES | YES (regenerate) | YES (revoke) | YES | YES (per letter) | NO | **PARTIAL** (downloads) |
| Micro-Credentials | NO | NO | NO | NO | N/A | N/A | **NO** |

## Appendix D — Finding Classification Summary

| Classification | Key items |
|---|---|
| `GOOD` | Central append-only-by-code audit table with 152 runtime action types; FT attendance/evaluation/eligibility/letters/exports with old→new values; login success + full password-reset trail; report exports with row counts; no passwords/JWTs/cookies/request bodies/file contents in any log or audit; hashed OTPs; masked emails in logs; no stack traces in prod; frontend console near-silent; scoped audit read API; command center scoped. |
| `MISSING_LOG` | Grading, revisions, training certificates, downloads, files, universities, settings, FT apply/tasks, legacy modules. |
| `EXCESSIVE_LOG` | Healthcheck lines; morgan on polls/heartbeats; read-audit volume. |
| `PRIVACY_RISK` | Audit PII surviving deletion; shared host access log; email in SPA URLs. |
| `SECURITY_RISK` | Gateway IP everywhere; shared rate-limit key; JWT in query string; mutable audit table. |
| `RETENTION_GAP` | Docker logs lost on redeploy; 14-day host logs; no archive. |
| `PERFORMANCE_RISK` | Heartbeat delete+reinsert; uncaught `report.read` audit failure; SSE 8 s polling. |
| `OBSERVABILITY_GAP` | No request-id correlation, no external sink/monitoring, no 4xx logging, no org-level audit view, Neon logs unverified. |
| `MISSING_SECURITY_EVENT` | Failed login, gate denial, logout, 403, cross-org, 429, token expiry, OTP failures. |
| `PRIVACY_REVIEW_REQUIRED` | Names/emails/university numbers in audit JSON; names in action types; help search text; crash logs; perf SQL logging if enabled. |
| `AUDIT_GRANULARITY_REVIEW` | Bulk summaries without IDs; old roles missing; NULL actors on scripted rows; free-text action names; 49 % unscoped rows. |
| `NO_RETENTION_POLICY_FOUND` | All DB log-like/analytics tables. |

---
*End of report. Read-only audit; no production or repository changes were made other than creating this file.*

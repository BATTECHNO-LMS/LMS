# BATTECHNO LMS — Slowness Root-Cause Report

**Date:** 2026-08-26  
**Production:** https://lms.battechno.com  
**Mode:** Diagnosis only. No source, schema, Nginx, Docker, or production-data changes.  
**SSH:** `orderzhouse` (`root@72.61.179.29`) → **Permission denied (publickey,password)**. Local-container probes on the VPS were **not** possible.  
**Authenticated production APIs:** **NOT MEASURED** (no session token used). Estimates below are derived from measured public endpoints × traced query counts.

---

## 1. Executive Summary

The LMS feels slow for two independent, measured reasons:

1. **Every database round trip is expensive.** Neon is in **us-east-2 (Ohio)**. The app VPS is **Hostinger Frankfurt (DE)**. Users in this session are in **Amman**. A trivial `SELECT 1` is **~0.2 ms of SQL** and **~625–850 ms of network**. Eight sequential Prisma queries take **~6.8 s** from this workstation. Production keepalive `GET /health` (no DB) is **182 ms**; `GET /health/ready` (`SELECT 1`) is **807 ms**.

2. **Authenticated pages issue many of those round trips.** Auth middleware reloads user + roles + assignments + university + permissions on **every** API. Typical `/auth/me` is **~9–11 queries in ~4 waves**. The student dashboard then fires **~10 APIs in parallel**, each paying auth again. That is not a large-table problem: `training_programs` ≈ 6 rows, `users` ≈ 575, legacy QA/risk/integrity/recognition tables are **empty**.

A third, first-paint problem: **production JS/CSS are not gzipped** and have **no `Cache-Control`**. Main JS is **899 KB** on the wire (~1.7 s download from Amman). HTML `Last-Modified: Mon, 17 Aug 2026` — live frontend is older than current repo Nginx gzip/`/assets/` caching.

**Primary verdict:** `TOO_MANY_DB_ROUND_TRIPS` amplified by `DATABASE_NETWORK_BOUND`.  
SQL execution and missing indexes are **not** the limiter. Server CPU/RAM were **not** inspected (SSH failed).

---

## 2. Production HTTP Baseline

Client: this workstation (Amman, JO). Tool: `curl.exe`. Times in seconds.  
`tls` in curl is `time_appconnect` (elapsed from start through TLS), not TLS-only.

### 2.1 Homepage / SPA shell

Endpoint: `https://lms.battechno.com/`  
Status: **200** `text/html`  
Size: **1167 B** uncompressed; gzip **yes** (when `Accept-Encoding: gzip`)

| Sample | DNS | Connect | TLS (appconnect) | TTFB | Total | Size |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.188 | 0.360 | 0.569 | 0.745 | 0.746 | 541* |
| 2 | 0.012 | 0.205 | 0.401 | 0.594 | 0.594 | 541* |
| 3 | 0.005 | 0.197 | 0.410 | 0.613 | 0.614 | 541* |

\* `--compressed` `size_download` after gzip. Identity `Content-Length: 1167`.

`Last-Modified: Mon, 17 Aug 2026 14:50:30 GMT`  
`Server: nginx/1.24.0 (Ubuntu)`  
No `Cache-Control` on HTML in the identity response. Repo wants `no-cache`.

Login routes (`/login`, `/login/admin`, `/privacy-policy`) return the **same 541/1167 B SPA shell** (client-side router). TTFB ~0.57–0.63 s on new connections.

### 2.2 `GET /health` (no DB)

Status: **200**, size **84 B**, `application/json`

New-connection TTFB samples (s):  
0.649, 0.602, 0.650, 0.669, 0.632, 0.585, 0.651, 0.600, 0.589, 0.609

| | DNS | TCP (connect−dns) | TLS (appconnect−connect) | TTFB | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| typical | ~0.015 | ~0.19 | ~0.21 | **~0.61** | ~0.61 |

**Keepalive (2nd request, same TCP):** TTFB **0.182 s**, DNS/connect/TLS **0**.

Breakdown of a new connection: ~400 ms TCP+TLS tax + ~180–210 ms Node/Nginx once TLS is done.

### 2.3 `GET /health/ready` (`SELECT 1`)

Status: **200**, size **51 B**

New-connection TTFB samples (s):  
1.212, 1.115, 1.101, 1.088, 1.170, 1.118, 1.130, 1.156, 1.098, 1.713

Steady median ≈ **1.12 s** (ignore 1.713 outlier as cold/jitter).

**Keepalive:** TTFB **0.807 s**.

Implied **app → Neon** (keepalive ready − keepalive health): **807 − 182 = 625 ms**.

### 2.4 Public API `GET /api/v1/public/landing-stats`

Status: **200**, size **428 B** JSON (usersCount 575, universities 7, …).

New-connection TTFB: 1.782, 1.202, 1.284 s then repeats 1.13–2.15 s.  
**Keepalive:** 0.827 s (one sample) and **1.346 s** (later sample). Not as stable as `/health`; still DB-touching (visit counter increments). 60s in-process cache exists in **repo** code; live timings do **not** drop to the ~182 ms no-DB floor, so each call still pays at least one Neon round trip (increment and/or cache miss).

### 2.5 `GET /api/auth/me` without token

Status: **401**, size **139 B**, keepalive TTFB **0.189 s** (no DB). Matches `/health`.

### 2.6 Other public probes

| Endpoint | Status | Keepalive/new TTFB | Notes |
| --- | ---: | ---: | --- |
| `GET /api/v1/universities` | 401 | new ~0.58 s class | Auth required |
| `GET /api/v1/popups/active` | 401 | 0.624 s new | Auth required |
| `GET /api/v1/help` | 404 | 0.636 s new | Wrong path; catalog is `/api/v1/help/...` |
| `GET /api/v1/announcements` | 404 | 0.578 s new | User route is `/api/v1/announcements` unmounted at that exact path or 404 JSON |
| `GET /api/v1/auth/me` | 404 | 0.581 s | Real route is **`/api/auth/me`** |

---

## 3. Local vs Public API Comparison

| Endpoint | Public (this client) | Local backend on VPS (`127.0.0.1:4400`) | Difference |
| --- | --- | --- | --- |
| `GET /health` | keepalive **182 ms** / new ~610 ms | **NOT MEASURED** (SSH denied) | — |
| `GET /health/ready` | keepalive **807 ms** / new ~1120 ms | **NOT MEASURED** | Public already includes ~625 ms Neon |
| `GET /api/v1/public/landing-stats` | keepalive **0.83–1.35 s** | **NOT MEASURED** | — |
| Authenticated APIs | **NOT MEASURED** | **NOT MEASURED** | — |

**Inference without SSH:** public `/health` keepalive **182 ms** is already Node+Nginx+Internet with **no DB**. Adding `SELECT 1` jumps to **807 ms**. Latency after login is therefore **not** “Nginx is slow”; Nginx+Node without DB is fine. The extra **~625 ms per SQL round trip** is **Node/Prisma → Neon**.

Compose (repo): backend `127.0.0.1:4400:4000`, frontend `127.0.0.1:8080:80`. Host Nginx terminates TLS and proxies to `:8080`.

---

## 4. Neon Round-Trip Benchmark

**Where measured:** this workstation → same Neon pooled database the app uses (575 users matches production landing-stats). **Not** measured inside the Frankfurt container.

Secrets not printed. Host summary only: provider `neon`, region hint **`us-east-2`**, `host_kind: neon-pooler`, `pgbouncer=true`, `connection_limit=25`.

### 4.1 Connection establishment vs warm query

| Probe | Time |
| --- | ---: |
| Disconnect + first `SELECT 1` (reconnect) | **2391 ms** |
| Warm `SELECT 1` (20 samples) | see table |

### 4.2 Warm `SELECT 1` (already-open Prisma client, 20 reps)

| | min | median | avg | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| **ms** | **836.9** | **855** | **864.5** | **884** | **1022.1** |

Earlier 10-sample run (separate process): min 848.6 / median 864.1 / avg 881.3 / p95 953 / max 953.

### 4.3 Sequential vs parallel (same warm connection)

| Pattern | Total |
| --- | ---: |
| 8 sequential `SELECT 1` | **6801 ms** |
| 4 parallel `SELECT 1` (`Promise.all`) | **2135 ms** |
| 2 rounds (4 then 2 parallel) | **1745 ms** |

`Promise.all` is **not** 1× RTT (would be ~855 ms). It is ~2.5× one query — Prisma/PgBouncer does not fully parallelize four statements on this path. Sequential is still much worse (8× ~850 ms).

### 4.4 SQL execution vs network (EXPLAIN ANALYZE, read-only)

| Query | Planning | Execution | Node |
| --- | ---: | ---: | --- |
| `SELECT COUNT(*) FROM users` | 1.8 ms | **0.17 ms** | Aggregate |
| `SELECT COUNT(*) FROM notifications WHERE is_read = false AND archived_at IS NULL` (unscoped) | 8.7 ms | **47.3 ms** | Aggregate |

**SQL is fast. The second is spent in the network.** Hundreds of milliseconds for `SELECT 1` is a **major finding**.

---

## 5. Neon Pooling Review

| Check | Result |
| --- | --- |
| Runtime pooled connection | **YES** (`-pooler.` host, `pgbouncer=true` via `applyPrismaPoolParams`) |
| Direct connection used for migrations | **YES** — `backend/scripts/start-production.js` prefers `DIRECT_URL`, else derives non-pooler host. Runtime `PrismaClient` uses `DATABASE_URL`. |
| `schema.prisma` datasource | `url = env("DATABASE_URL")` only |
| Potential configuration issue | Pooling itself: **PASS**. Geography: **ISSUE** (see §20/§22). |

---

## 6. PrismaClient Lifecycle

Runtime `new PrismaClient(...)`:

| Location | Role |
| --- | --- |
| `backend/src/config/db.js` | **One shared process client** (`createPrismaClient()`). In non-production cached on `globalThis.__battechnoPrisma`. Production relies on Node module cache (still one instance per process). |
| `backend/scripts/*`, some tests | Isolated CLI/test clients — **not** the HTTP server. |

**No per-request PrismaClient.** Lifecycle: **PASS**.

---

## 7. Authentication Cost

`authenticate` (`backend/src/middlewares/auth.middleware.js`) runs on almost every private route. JWT is not authoritative; `loadCurrentAuthContextFromDb` always hits Postgres.

### 7.1 Middleware queries (`currentAuthContext.js`)

| Wave | Parallel? | Queries |
| --- | --- | --- |
| 1 | `Promise.all` | `users`, `user_roles`, `user_organization_assignments` (+ org), `reviewer_university_assignments` (**4**) |
| 2 | `Promise.all` | `roles`; university (60s cache); permissions via `rolePermissionCache` (60s). Cache miss: **2 sequential** (`role_permissions` then `permissions`) |
| 3 | conditional | remapped roles, second permission load, second university, org identity |

Warm typical admin: **~6 queries, 2 waves**. Cold: **~8**.

Caches: `rolePermissionCache` 60s; `universityIdentityCache` / `organizationIdentityCache` 60s (`lookupCache.js`). **Not cached:** user row, role links, assignments, reviewer assignment.

### 7.2 Extra cost on `GET /api/auth/me`

Controller always `findUserProfileById` (second user row + specialties). `toLoginUser` **always re-queries assignments and university** even when `authContext` already has roles/permissions.

| | Count |
| --- | --- |
| Auth DB queries/request (typical API) | **~6 warm / ~8 cold** (middleware only) |
| `/auth/me` total | **~9 warm / ~11 cold** |
| Sequential waves | **~4** on `/auth/me` |
| Auth DB time (estimated from 625 ms prod RTT × waves, **not** live `/me`) | **~1.2–2.5 s** middleware; **~2–4 s** `/auth/me` |
| Repeated lookups on `/auth/me` | user, assignments+org, university |

Unauthenticated `/api/auth/me`: **189 ms** keepalive (no DB) — proves the stack is fine until Prisma starts.

`NotificationBell` unread-count **polls every 60 s** and pays **full auth + 1 COUNT** each time.

---

## 8. Slowest APIs

Direct DB timing for authenticated routes: **NOT MEASURED**.

| Endpoint | Total | Backend | DB | Query count | Payload |
| --- | --- | --- | --- | --- | --- |
| `GET /health` | keepalive **182 ms** | ~182 ms | 0 | 0 | 84 B |
| `GET /health/ready` | keepalive **807 ms** | ~807 ms | ~625 ms net + &lt;1 ms SQL | 1 | 51 B |
| `GET /api/v1/public/landing-stats` | **0.83–2.15 s** | DB-bound | ≥1 RTT; miss path ~10 parallel counts | 428 B | &lt;100 KB |
| `GET /api/auth/me` (401) | **189 ms** | no DB | 0 | 0 | 139 B |
| `GET /api/auth/me` (authenticated) | **NOT MEASURED** | auth + profile + assignments | ~9–11 | small |
| `GET /api/v1/dashboard/admin-stats` | **NOT MEASURED** | auth + 6 parallel KPI queries; institution path already parallel org counts | ~8–14 | small |
| `GET /api/v1/training/trainee/my-programs` | **NOT MEASURED** | auth + list | small table | small |
| `GET /api/v1/training/trainer/dashboard` | **NOT MEASURED** | duplicate assignment fetch + sequential sessions then counts | medium | small |
| `GET /api/v1/student/courses` | **NOT MEASURED** | auth + unbounded catalog + **2 queries per enrolled course** (progress) | N+1 | varies |
| `GET /api/v1/sessions/me` | **NOT MEASURED** | auth + **N+1 serializeSession/module** | N+1 | varies |
| `GET /api/v1/enrollments/me` | **NOT MEASURED** | auth + unbounded enrollments | sequential serialize | varies |
| `GET /api/v1/notifications/unread-count` | **NOT MEASURED** | auth + `count` | 1 + auth | tiny |
| `GET /api/v1/admin/field-training` | **NOT MEASURED** | auth + list + parallel aggregates (repo) | moderate | moderate |
| Reports `GET /api/v1/reports/:type` | **NOT MEASURED** | unbounded `findMany` + **legacy QA/recognition** | high | can be large |
| Analytics overview | **NOT MEASURED** | two waves including **all** `user_roles` / grades + QA/integrity | high | moderate |
| Completion readiness | **NOT MEASURED** | **~10–12 queries per enrollment** sequential `for` | critical if N trainees | moderate |

---

## 9. Rank: 20 slowest (frequent paths)

Times with a token are **estimates** = stack ~180 ms + (waves × ~625 ms prod Neon RTT). Ranked by **user impact**, not obscurity.

| Rank | Endpoint | Time | DB queries | Payload | Main bottleneck |
| ---: | --- | --- | --- | --- | --- |
| 1 | Student dashboard **fan-out** (10 APIs) | wall **NOT MEASURED**; likely **several seconds** | 10 × (auth 6–8 + handler) | mixed | auth × N + N+1 sessions/courses |
| 2 | `GET /api/auth/me` | est. **2–4 s** | ~9–11 | small | duplicate user/assignment waves |
| 3 | Any authenticated API (middleware only) | est. **1.2–2.5 s** | ~6–8 | — | auth waterfall × Neon RTT |
| 4 | `GET .../programs/:id/completion-readiness` | est. **N×(10–12)×RTT** | N+1 progress | moderate | sequential per enrollment |
| 5 | Instructor dashboard | **NOT MEASURED** | 1 + up to **30** session GETs | — | frontend waterfall |
| 6 | `GET /sessions/me` | **NOT MEASURED** | N+1 modules | — | serialize per session |
| 7 | `GET /student/courses` | **NOT MEASURED** | 2 / enrolled course | catalog include | N+1 progress + over-fetch lessons |
| 8 | `GET /health/ready` | **807 ms** measured | 1 | 51 B | Neon RTT |
| 9 | `GET /api/v1/public/landing-stats` | **0.83–2.15 s** | 1–12 | 428 B | Neon + optional miss |
| 10 | `GET /training/trainer/dashboard` | **NOT MEASURED** | duplicate assignments + sequential sessions | small | waterfall |
| 11 | Admin FT **manage overview** | **NOT MEASURED** | detail + applications + sessions + submissions | large nested | eager extra collections |
| 12 | `GET /reports/:type` | **NOT MEASURED** | unbounded + legacy | can be large | fetch-all |
| 13 | Analytics overview | **NOT MEASURED** | ~30+ | moderate | unbounded + legacy |
| 14 | `GET /users` list | **NOT MEASURED** | page + **2–3 queries × 7 roles** | paged | role-count N+1 |
| 15 | Unread-count (every 60 s) | est. **1.2–2.5 s** | auth + 1 | tiny | auth, not COUNT |
| 16 | `GET /enrollments` by cohort | **NOT MEASURED** | 1 user / row | — | unused batch helper |
| 17 | Field-training attendance save | **NOT MEASURED** | 1 upsert/row + eligibility | — | sequential |
| 18 | Student FT progress (`staleTime: 0`) | **NOT MEASURED** | auth + progress | small | refetch always |
| 19 | Main JS `/assets/index-tSzqNN2G.js` | **1.65–1.82 s** download | 0 | **899 KB** ungzipped | no gzip |
| 20 | Main CSS `/assets/index-DC376wxl.css` | **1.49–1.63 s** | 0 | **409 KB** ungzipped | no gzip |

---

## 10. Slowest Queries

| Query | SQL time | Network | Notes |
| --- | ---: | ---: | --- |
| `SELECT 1` | ~0.2 ms class | **625 ms prod / 855 ms this PC** | Dominates every Prisma call |
| `COUNT(*)` users | **0.17 ms** | same RTT | Seq scan of 575 rows is irrelevant |
| Unscoped unread notifications COUNT | **47 ms** | same RTT | Real unread uses `user_id` + existing `idx_notifications_user_read` |
| Auth `users.findUnique` + role graph | not EXPLAIN’d | 2 waves × RTT | Highest frequency |
| `computeAndPersistProgress` bag | 8+ statements | 8+ RTTs **per trainee** | Completion board |

No query plan showed a pathological Seq Scan on a large hot table. Largest hot table is `notifications` (~10.8k rows, 8 MB).

---

## 11. N+1 Findings

**NPLUS1-001**  
File: `backend/src/modules/trainingPrograms/trainingCompletion.service.js`  
Function: `getProgramCompletionReadiness`  
Parent rows: all enrollments in program/cohort  
Queries per row: **~10–12** (`calculateTrainingCompletionEligibility` → `computeAndPersistProgress`)  
Likely query count: `1 + 1 + N×11`  
Recommended batch: read `training_progress` / batch sessions-tasks-assessments once per program.

**NPLUS1-002**  
File: `backend/src/modules/sessions/sessions.service.js`  
Function: `listMine` / `serializeSession`  
Parent: student sessions  
Queries per row: **1+ module/cohort lookups**  
Recommended: join/select module in the parent query.

**NPLUS1-003**  
File: `backend/src/modules/courses/courses.service.js`  
Function: `listStudentCourses`  
Queries per enrolled course: **2** (lesson count + progress)  
Recommended: `groupBy` / one progress `findMany` where `course_id in (...)`.

**NPLUS1-004**  
File: `backend/src/modules/enrollments/enrollments.service.js`  
Function: `listByCohort` → `serializeEnrollment`  
Queries per row: **1 user** (parallel). Batch helper `findUsersBrief` exists and is unused here.

**NPLUS1-005**  
File: `backend/src/modules/users/users.service.js`  
Function: `countUsersByCanonicalRole`  
Parent: 7 role codes, every users list  
Queries per role: **2–3**, and `findUserIdsByRoleCode` loads **all** user ids for the role.

**NPLUS1-006**  
File: `backend/src/modules/fieldTraining/fieldTraining.notifications.js`  
Function: multiple `notify*`  
Queries per recipient: **1 insert** sequential.

**NPLUS1-007**  
File: `backend/src/modules/attendance/attendance.service.js`  
Function: `recalcCohortAttendancePercentages`  
Queries per enrollment: sequential record fetch + update.

**NPLUS1-008**  
File: `frontend/src/pages/instructor/InstructorDashboardPage.jsx`  
Function: `useQueries` sessions by cohort  
Parent: up to **30** cohorts  
Queries per row: **1 HTTP** (each with full auth).

**NPLUS1-009**  
File: `backend/src/modules/cohorts/cohorts.service.js`  
Function: `listAvailableForUniversity`  
Queries per cohort: capacity count (up to 500).

**NPLUS1-010**  
File: `backend/src/modules/fieldTraining/fieldTraining.attendanceWindow.service.js`  
Function: `listActiveWindowsForStudent`  
Queries per window: expire + attendance lookup.

---

## 12. Sequential Query Findings

| File | Function | Sequential DB rounds | Can parallelize? | Impact @ ~625–855 ms RTT |
| --- | --- | ---: | --- | --- |
| `currentAuthContext.js` | `loadCurrentAuthContextFromDb` | 2–4 waves | Wave 1–2 already parallel; perm cache miss still inner-sequential | **1.2–3.4 s** every API |
| `auth.service.js` | `me` + `toLoginUser` | +2 waves after middleware | **YES** — reuse `req.user` | **+1–2 s** on `/auth/me` |
| `dashboard.service.js` | `countUsers` / `countPendingEnrollments` | 2 each (ids then count) | **YES** (subquery/count join) | **+0.6–1.7 s** inside already-parallel KPI bag |
| `student.service.js` | `buildCourseSchedule` | **5 waves** | **YES** for independent lookups | **~3–4 s** |
| `trainerAssignments.service.js` | `getTrainerDashboard` | list courses → assignments **again** → sessions → then `Promise.all` counts | **YES** | extra 1–2 RTTs |
| `trainingCompletion.service.js` | readiness `for` loop | **N sequential** eligibility | **YES** batch | **tens of seconds** if many trainees |
| `analytics.service.js` | `getOverviewAnalytics` | 2 large waves | partly | Super-admin only |
| `courses.service.js` | `getStudentCourseById` | 4–7 | partly | course detail CMS |

Auth was already improved in repo (2 parallel rounds vs old ~8 sequential). **Production `/health/ready` still proves RTT is ~625 ms**, so remaining waves still dominate.

---

## 13. Over-Fetching

| Location | What | UI need |
| --- | --- | --- |
| `courses.repository.js` `findPublishedManyForStudent` | all sections/lessons (or all lesson ids) on **list** | cards need title/progress, not curriculum |
| `fieldTraining.repository.js` `findAssessmentsByOpportunity` | questions **and all attempts** | manage tab |
| `computeAndPersistProgress` | assessments with **all attempts** | eligibility flags |
| `analytics.service.js` `buildModuleSummaries` | **all** `user_roles`, **all** grade scores, evidence files | overview widgets |
| `fieldTraining.workflow.js` eligibility | opportunity + **all task submissions** | per persist |
| Training course **overview** (`?sections=overview`) | lean (good) | — |

---

## 14. Fetch-all then filter

Student dashboard: loads assessments/submissions/grades/certificates/courses **then** `filter`/`slice` in the browser (`StudentDashboardPage.jsx`). PostgreSQL `take` is used on some list APIs (page_size 30/50) but **sessions/enrollments/courses catalog** can still be unbounded.

Reports: repository `findMany` without take, then serialize — high-volume if types grow.

`countUsersByCanonicalRole`: load all role membership ids, then count — should be SQL `GROUP BY`.

---

## 15. Pagination

| List | Server-paginated? |
| --- | --- |
| Users admin list | **YES** (skip/take) |
| Users role counts | **NO** (all ids per role) |
| `training_programs` admin/trainee lists | **NO** (safe today: **6** programs) |
| Academic enrollments by cohort/student | **NO** |
| Student published courses | **NO** |
| FT applications by opportunity | **NO** (3 opportunities live) |
| FT admin opportunity list | **YES** |
| Notifications list | **YES** (default 200) |
| Unread | COUNT |
| Academic submissions/grades/certificates | default **take 200** |
| Reports attendance/assessments/recognition | **NO** |
| Training enrollments / completion board | **NO** |

---

## 16. Query Plans

Read-only `EXPLAIN (ANALYZE, BUFFERS)` from this workstation:

- `COUNT(*)` on `users`: Aggregate, **0.17 ms** execution. No index emergency.
- Unscoped notification unread COUNT: Aggregate, **47 ms**. For **10.8k rows** this is acceptable. Per-user count should use `idx_notifications_user_read`.

No large Nested Loop / bad estimates on hot paths were captured. **Do not add indexes from this audit** until a traced slow `SELECT` on production shows Seq Scan on a growing table.

---

## 17. Index Recommendations

Existing relevant indexes already cover notifications (`user_id`, `user_id+is_read`, `user_id+created_at`), enrollments, sessions, audit_logs, FT applications.

**INDEX-REC:** none with EXPLAIN evidence.  
Optional later (only if unread COUNT per user grows and plans show filter-after-scan): `(user_id, is_read, archived_at)` — **not** justified at 10k rows / 47 ms.

---

## 18. Database Size (approx live tuples)

| Table | Rows | Total MB | Index MB |
| --- | ---: | ---: | ---: |
| notifications | 10842 | 7.95 | 2.70 |
| audit_logs | 4644 | 2.41 | 0.72 |
| users | 575 | 0.57 | 0.35 |
| field_training_applications | 279 | 0.53 | 0.22 |
| training_assessment_attempts | 56 | 0.27 | 0.05 |
| help_articles | 41 | 0.24 | 0.17 |
| training_enrollments | 50 | 0.13 | 0.08 |
| training_programs | 6 | 0.14 | 0.08 |
| organizations | 12 | 0.11 | 0.09 |
| field_training_opportunities | 3 | 0.23 | 0.13 |
| training_assessments / tasks / sessions / attendance | 11 / 4 / 3 / 3 | ≤0.08 | |
| qa_reviews, corrective_actions, risk_cases, integrity_cases, recognition_requests | **0** | ~0.07–0.10 | |
| grades, submissions, assessments (academic) | **0** | | |
| announcements | 0 | | |
| managed_popups | 4 | 0.13 | |

**Not a size problem.**

---

## 19. Legacy modules on active pages

| Surface | Hits QA / risk / integrity / recognition / evidence? |
| --- | --- |
| Dashboard admin-stats | **NO** |
| Auth | **NO** |
| Courses / training programs | **NO** |
| Landing stats **service** hot path | **NO** (repository still *defines* `getQaCompletionRate`; current `getLandingStats` does not call it) |
| Analytics overview / Excel | **YES** — `qa_reviews`, `integrity_cases`, recognition, `evidence_files` |
| Academic reports | **YES** — `qa_reviews` groupBy, `recognition_requests` |
| Event dispatcher | `qa_reviews.findUnique` on some events |

Empty tables still cost **one Neon RTT each** when queried.

---

## 20. Frontend Waterfall

Browser DevTools: **not available** in this session. Counts from source.

Layout (every logged-in shell): unread-count 60s, announcements, popups (keyed by pathname), optional FT tour, universities catalog for global users, student attendance-window poll.

### 20.1 Admin dashboard

Initial API count: **1** (`/dashboard/admin-stats`) + layout.  
Needed for first render: **YES**.

### 20.2 Student dashboard

Initial API count: **10** parallel + optional FT progress + layout.  
Slowest call: **NOT MEASURED** (likely `sessions/me` or `student/courses`).  
Duplicates: notifications `page_size=5` vs bell `page_size=8` (different keys); unread-count separate.  
Payload total: **NOT MEASURED**.  
Needed for first render: **NO** — certificates, submissions, notifications preview, full course catalog are secondary.

### 20.3 Trainee / trainer dashboards

1 imperative GET each (`my-programs` / `trainer/dashboard`). No React Query cache — refetch every visit.

### 20.4 Instructor dashboard

Cohorts → **up to 30** `GET /cohorts/:id/sessions` (true waterfall) + assessments + submissions.

### 20.5 Course detail eager loading

| Page | Overview loads |
| --- | --- |
| `AdminTrainingCourseDetailPage` | program + cohorts only. Sessions/attendance/trainees/materials/tasks/assessments/reports **tab-gated**. |
| `TrainerCoursePage` | `?sections=overview` only. Extra sections on tab. |
| `TraineeCourseDetailPage` | `?sections=overview` only. |
| Admin FT **manage** overview | **eager** applications + sessions + submissions |

**Training course overview: PASS (not eager-all). FT manage overview: ISSUE.**

---

## 21. Student dashboard (recap)

Initial API count: **10 + layout**  
Slowest call: **NOT MEASURED**  
Duplicate calls: notification list vs bell; each API repeats auth  
Payload total: **NOT MEASURED**  
All requests needed for first render: **NO**

---

## 22. React Query / fetching

`frontend/src/lib/queryClient.js` + `queryDefaults.js`:

- `staleTime` default **60 s**; dashboard **90 s**; notifications **30 s**; auth constant **3 min** but `/me` is **not** a React Query.
- `refetchOnWindowFocus`: **false**
- `refetchOnMount`: default **true** if stale
- No empty `invalidateQueries()`; `qc.clear()` on login/logout
- Trainee/trainer dashboards bypass React Query
- Student FT progress: `staleTime: 0`, `refetchOnMount: 'always'`
- Popups query key includes **pathname** → refetch on every route
- `/auth/me`: imperative bootstrap, no interval; StrictMode may double it in **dev** only

---

## 23. Payload Sizes

Measured:

| Response | Class |
| --- | --- |
| HTML, health, ready, landing-stats, 401 JSON | **&lt;100 KB** |
| Main JS 899 KB, CSS 409 KB | **500 KB–1 MB** (JS); **100–500 KB** (CSS) |

Authenticated JSON: **NOT MEASURED**. Unlikely &gt;1 MB given table sizes except reports/analytics if they serialize unbounded academic rows (currently tiny).

Largest **measured** payload: **`/assets/index-tSzqNN2G.js` 899 055 bytes**.

---

## 24. Frontend bundle / static delivery

| Asset | Identity length | Gzip? | TTFB | Total | Cache-Control |
| --- | ---: | --- | ---: | ---: | --- |
| `index-tSzqNN2G.js` | **899 055** | **NO** | ~0.77–0.83 s | **~1.65–1.82 s** | **missing** |
| `index-DC376wxl.css` | **409 065** | **NO** | ~0.79–0.81 s | **~1.49–1.63 s** | **missing** |
| `react-vendor-CCvOV8qn.js` | 142 232 | **NO** | ~0.73–0.79 s | ~1.08–1.21 s | **missing** |
| `i18n-Co4clWl7.js` | 49 500 | **NO** | ~0.70–0.79 s | ~0.87–0.97 s | **missing** |
| `tanstack-query-*.js` | 45 073 | **NO** | ~0.76–0.84 s | ~0.94–1.04 s | **missing** |

HTML **is** gzipped. JS/CSS **are not**, despite repo `gzip_types` including `application/javascript`.  
No `immutable` header on live `/assets/` (repo `deploy/nginx-lms.battechno.com.conf` and `frontend/nginx.conf` both set it).  
`Last-Modified: 2026-08-17` on HTML and JS — **live frontend predates 2026-08-23 perf commit**.  
Google Fonts loaded from `fonts.googleapis.com` on every HTML (extra RTT).  
xlsx/recharts: route-lazy in **current repo**; jspdf unused in `src/`. Live bundle may differ (old hash).  
Windows curl `--http2` unsupported here; Nginx config in repo enables `http2`. Live responses shown as **HTTP/1.1**.

---

## 25. Nginx

Inspected **repo** configs read-only + **live headers**.

Repo (host + frontend container): HTTP/2, gzip + `gzip_types` for JS/CSS/JSON, `/assets/` `max-age=31536000, immutable`, `/api/` `no-store`, proxy HTTP/1.1, `Connection ""` (keepalive to upstream), 300s timeouts.

**Live:**

| Check | Result |
| --- | --- |
| gzip HTML | **PASS** |
| gzip JS/CSS | **ISSUE** — `Content-Length` identical with `Accept-Encoding: gzip` |
| gzip JSON health | **ISSUE** (84 B below `gzip_min_length 256` — expected) |
| `/assets/` immutable cache | **ISSUE** — no `Cache-Control` |
| index.html caching | no `Cache-Control` on identity dump |
| proxy keepalive | likely working (curl multi-URL reuse) |
| Brotli | **not** in repo; **not** in live headers |
| HTTP/2 | configured in repo; this curl client did not negotiate it |

**Do not modify Nginx in this task.** Live site does not match current repo gzip/cache snippets.

---

## 26. Docker / Server Health

| Check | Result |
| --- | --- |
| SSH `orderzhouse` | **FAIL** — publickey/password denied |
| `docker stats` / `docker ps` | **NOT MEASURED** |
| CPU / RAM / swap / disk / load | **NOT MEASURED** |
| Container restarts / OOM | **NOT MEASURED** |
| VPS identity (public IP) | `72.61.179.29` — **srv1528115.hstgr.cloud**, **Frankfurt am Main, DE**, Hostinger AS47583 |

Server resources: **UNKNOWN** (treat as **not proven HEALTHY**). Nothing in HTTP timings suggests CPU peg (empty `/health` is 182 ms stable).

---

## 27. Backend process health

| Check | Result |
| --- | --- |
| Node memory / event-loop lag | **NOT MEASURED** (no SSH) |
| Unhandled exceptions | **NOT MEASURED** |
| Puppeteer/Chromium | Compose sets `PUPPETEER_EXECUTABLE_PATH`; **not** invoked on page open (export-only) |
| `withDbRetry` in `db.js` | retries transient Neon disconnects (can **add** latency on blips) |

---

## 28. Reports / PDF / Excel

Opening `/admin/reports`: JSON `GET /reports/:type` only. CSV/JSON export on button. **No** Puppeteer.  
Analytics PDF/Excel: **button only**.  
FT PDF/xlsx: **export/generate buttons**.  
Training PDF routes: on-demand download.

**ISSUE:** report JSON can still run **unbounded SQL + legacy QA/recognition**, which is slow because of **RTT**, not Chromium.

---

## 29. Notifications

`GET /notifications/unread-count`: Prisma **`count`** (not full rows). Indexed.  
Material cost is **auth middleware**, not the COUNT.  
Poll: **60 s** from `NotificationBell` on every shell.  
Preview list only when dropdown open (`page_size=8`).

---

## 30. Latency Budget (representative)

### A. First visit (logged-out homepage) — **measured**

| Layer | Time |
| --- | ---: |
| TCP+TLS (new connection) | ~400 ms |
| HTML TTFB | ~600 ms total |
| Parallel JS/CSS download (ungzipped ~1.5 MB) | **~1.7–1.8 s** (longest asset) |
| Google Fonts | extra third-party (not timed) |
| `landing-stats` | **0.8–2.2 s** |
| **Primary delay** | **uncompressed JS/CSS + Neon for stats** |

### B. Keepalive, no auth

| Layer | Time |
| --- | ---: |
| Nginx+Node | **182 ms** |
| + `SELECT 1` | **807 ms** |
| Neon network | **~625 ms** |
| SQL | **&lt;1 ms** |

### C. Trainee course detail (overview) — **estimated, not live-token**

Page: Trainee Course Detail (`?sections=overview`)  
Total: **NOT MEASURED**  
API requests: `/auth/me` (once per session) + program overview + layout unread/announcements/popups  
Slowest API: likely first authenticated call (`/me` or program GET)  
Auth: **~6–11 queries / 2–4 waves**  
DB network: **~625 ms × waves**  
SQL: **&lt;50 ms**  
Payload: small (6 programs, section-gated)  
**Primary delay:** auth + Neon RTT, **not** eager tab data (overview is lean)

### D. Student dashboard — **estimated**

API requests: **10 + layout**  
Each pays auth. Wall clock ≈ slowest API, plus pool contention.  
**Primary delay:** too many authenticated round trips in parallel on a 625 ms DB.

---

## 31. Root-Cause Ranking

**ROOT-CAUSE-001**  
Severity: **CRITICAL**  
Measured evidence: 8× sequential `SELECT 1` = **6801 ms**; prod keepalive health **182 ms** vs ready **807 ms**; EXPLAIN COUNT users **0.17 ms**.  
Affected pages: **every authenticated screen**.  
Why: Prisma issues many statements; each waits on Frankfurt↔Ohio.  
Recommended fix: request-scoped auth cache; reuse `req.user` on `/me`; batch remaining waves; reduce API count on student dashboard.  
Expected impact: **VERY HIGH**  
Implementation risk: **LOW–MEDIUM**

**ROOT-CAUSE-002**  
Severity: **CRITICAL**  
Measured evidence: Neon `us-east-2`; VPS Frankfurt; workstation Amman; warm `SELECT 1` **855 ms** from JO, **~625 ms** from public `/health/ready`.  
Affected pages: all DB-backed APIs.  
Why: speed of light + pooler, not table size.  
Recommended fix: move Neon **or** app to the **same region** (ops plan, no migrate in this task).  
Expected impact: **VERY HIGH** (could cut RTT toward tens of ms)  
Implementation risk: **HIGH** (data move / DNS / pooling)

**ROOT-CAUSE-003**  
Severity: **HIGH** (first paint)  
Measured evidence: JS **899 KB** and CSS **409 KB** **without gzip**; no `Cache-Control`; `Last-Modified` 2026-08-17.  
Affected pages: every cold load.  
Why: megabyte-scale JS over ~180 ms RTT to Frankfurt.  
Recommended fix: deploy current frontend Nginx gzip + hashed `/assets/` immutable cache (already in repo, **not live**).  
Expected impact: **HIGH** for first visit; **LOW** after login  
Implementation risk: **LOW**

**ROOT-CAUSE-004**  
Severity: **HIGH**  
Measured evidence: Student dashboard 10 hooks; instructor ≤30 session GETs; each API repeats auth.  
Affected: student, instructor.  
Why: N HTTP × auth queries × RTT.  
Recommended fix: one dashboard aggregator endpoint; section/idle queries `enabled: false` until needed.  
Expected impact: **HIGH**  
Implementation risk: **MEDIUM**

**ROOT-CAUSE-005**  
Severity: **HIGH** on completion/finalization  
Evidence: sequential `for` + ~11 queries/enrollment.  
Affected: trainer/admin finalization tab.  
Recommended fix: batch progress.  
Expected impact: **HIGH** when N&gt;5  
Implementation risk: **MEDIUM**

**ROOT-CAUSE-006**  
Severity: **MEDIUM**  
Analytics/reports still query empty legacy QA/integrity/recognition/evidence.  
Expected impact: **MEDIUM** (1 RTT each)  
Risk: **LOW**

**ROOT-CAUSE-007**  
Severity: **LOW–MEDIUM**  
Unread COUNT is cheap; **auth + 60 s poll** is not.  
Risk: **LOW** (request-scoped auth)

**ROOT-CAUSE-008**  
Severity: **LOW** (today)  
Unbounded lists; tables still tiny.  
Risk: **LOW** to add `take`

Prisma lifecycle, pooling flags, training-course overview section gating: **not** root causes.

---

## 32. Prioritized Fix Plan (do not implement here)

**Phase 1 — Auth (highest leverage, low risk)**  
- Request-scoped memo of `loadCurrentAuthContext` (one load per HTTP request).  
- `GET /auth/me`: skip second user/assignments/university queries; shape response from `req.user` + one profile select if needed.  
- Keep 60s role-permission cache.

**Phase 2 — Cut dashboard HTTP fan-out**  
- Student: single aggregator or disable non-above-the-fold queries.  
- Instructor: batch sessions by cohort ids (one API).  
- Trainer dashboard: stop duplicate assignment query.

**Phase 3 — Batch remaining N+1**  
- Completion readiness.  
- `listMine` sessions, student course progress, `serializeEnrollment`, users role counts.

**Phase 4 — Deploy live static/Nginx already in repo**  
- gzip JS/CSS, `/assets/` immutable, current hashed bundles. Confirm headers after deploy.  
- Do not treat this as a substitute for Phase 1.

**Phase 5 — Indexes**  
- Only if a production `EXPLAIN` on a growing table says so. **None now.**

**Phase 6 — Region**  
- Same-region Neon and VPS. Separate approved ops plan. No `db push` / migrate in app code.

**Phase 7 — Legacy analytics/reports**  
- Stop counting empty QA/recognition/evidence on default overview.

**Phase 8 — Pagination caps**  
- Defense in depth for programs/enrollments/reports when data grows.

---

## 33. Code vs infrastructure

**APPLICATION CODE:** Too many Prisma round trips (auth every request, `/me` duplicates, student/instructor fan-out, completion N+1, some sequential dashboards). Overview course detail is already section-gated.

**DATABASE QUERY DESIGN:** N+1 and fetch-all-then-filter. SQL itself is cheap on current sizes.

**DATABASE NETWORK:** **Dominant.** Frankfurt (app) ↔ Neon us-east-2 ≈ **625 ms** per round trip at the public edge; Amman ↔ Neon ≈ **855 ms**.

**DATABASE INDEXES:** Adequate for current size. No evidence-based new index.

**FRONTEND:** 10-call student dashboard; instructor session waterfall; popups refetch by path; trainee/trainer no RQ cache. **Live** JS/CSS ungzipped and uncached.

**NGINX:** Repo config is fine; **production headers do not match** (no JS gzip, no asset immutable).

**SERVER:** Frankfurt Hostinger VPS. CPU/RAM **NOT MEASURED** (SSH failed). `/health` 182 ms does not look CPU-bound.

---

## 34. Final Verdict

**TOO_MANY_DB_ROUND_TRIPS** on a **DATABASE_NETWORK_BOUND** path.

Not `DATABASE_QUERY_BOUND` (EXPLAIN &lt; 50 ms).  
Not `BACKEND_BOUND` (Node without DB is 182 ms).  
Not solely `STATIC_DELIVERY_BOUND` (that explains **first paint**, not **every click after login**).  
`MIXED` only in the sense that cold-load gzip is a **second** real problem; the product “feels slow” after login is **query count × Neon RTT**.

---

## 35. Git / safety

No `git add` / commit / push. No production mutations. No schema/Nginx/Docker edits.

The only file this audit added is this report.

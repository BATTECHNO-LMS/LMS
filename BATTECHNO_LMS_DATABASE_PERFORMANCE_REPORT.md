# BATTECHNO LMS — Database & API slowness report

**Date:** 2026-08-23  
**Production:** https://lms.battechno.com  
**Mode:** Measure first. No `DROP` / `TRUNCATE` / `prisma migrate reset` / `db push --force-reset`. No git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>"/push.  
**Deploy:** Not performed from this session (no production Docker/SSH apply).

---

## 1. Executive summary

The LMS is slow because **almost every authenticated API pays hundreds of milliseconds per SQL round trip**, and the request path used to issue **many round trips in sequence**.

This is **not** a large-table problem. Training tables are tiny. Legacy QA/integrity/recognition tables are empty. The bottleneck is **network distance to Neon** multiplied by **query count**.

Measured `SELECT 1` from this workstation to Neon (`us-east-2` pooled host):

| | min | median | avg | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| **SELECT 1 (ms)** | 806 | 823 | 821 | 833 | 833 |

Production `GET /health` (no DB) vs `GET /health/ready` (`SELECT 1` on the app server):

| endpoint | typical TTFB from this client |
| --- | ---: |
| `/health` | ~590 ms |
| `/health/ready` | ~1090 ms |
| **implied app-server → Neon** | **~500 ms** |

Same-region Postgres is normally ~10–30 ms. **~500–820 ms is cross-region / far-VPS physics.** Eight sequential Prisma queries therefore cost **~4–7 seconds before the controller runs**.

**Immediate code mitigations implemented (in repo, not live until deploy):**

- Auth context: independent lookups run in **two parallel rounds** instead of ~8 sequential queries.
- `GET /auth/me` reuses `req.user` roles/permissions (no second role/permission waterfall).
- Institution dashboard skips university academic counts.
- Field-training admin list: follow-up aggregates run in `Promise.all`.
- Attendance session/summary: one batched user fetch instead of N+1.
- Student course list: one enrollment query for all cards.
- Trainer course: trainee count folded into the existing parallel job bag.
- Optional `PERF_LOGGING=true` query timing (SQL text only, **no parameters**).

**Indexes added:** none. Query plans are not the limiter while RTT is ~500–800 ms and tables are small.

---

## 2. Database round-trip benchmark

### 2.1 This workstation → Neon (shared `DATABASE_URL`, pooled)

Warm connection, 10× `SELECT 1`:

- min **806 ms**, median **823 ms**, avg **821 ms**, p95 **833 ms**, max **833 ms**

### 2.2 Sequential vs parallel (same connection, same `SELECT 1`)

| pattern | total |
| --- | ---: |
| 8 sequential `SELECT 1` | **6684 ms** |
| 4 parallel `SELECT 1` | 1972 ms |
| 2 rounds (4 then 2 parallel) | **1668 ms** |

This is the whole story: **8 sequential auth queries ≈ 6.7 s**. Two batched rounds ≈ **1.7 s**. Application SQL cannot beat the speed of light to Ohio.

### 2.3 Production public edge

From this client:

- `/health` TTFB samples (s): 0.81, 0.62, 0.56, 0.59, 0.59, 0.59, 0.57, 0.54, 0.61, 0.56  
  median ≈ **0.59 s**
- `/health/ready` TTFB samples (s): 1.78, 1.10, 1.11, 1.05, 1.09, 1.09, 1.12, 1.06, 1.09, 1.09  
  steady median ≈ **1.09 s**

**App-server → Neon ≈ 500 ms** (1.09 − 0.59). First ready call (1.78 s) includes extra cold-path cost.

Localhost → backend API was not a production-origin probe (no SSH to the app host). Local Vite is running; the API latency that matters is the Neon RTT above.

---

## 3. Neon pooled connection review

Inspected **without printing secrets**:

| check | result |
| --- | --- |
| pooled connection | **YES** (`-pooler.` host, `host_kind: neon-pooler`) |
| `pgbouncer=true` | **YES** (applied by `applyPrismaPoolParams` when host matches `/-pooler./`) |
| `connection_limit` | 25 (default helper) |
| `pool_timeout` | 20 s |
| Neon region hint from hostname | **us-east-2** |
| `DIRECT_URL` | used for **migrations only** in `scripts/start-production.js` (derive non-pooler host). Runtime `PrismaClient` uses `DATABASE_URL`. |
| Prisma `schema.prisma` datasource | `url = env("DATABASE_URL")` only |
| Docker runtime | `backend/.env` → `DATABASE_URL`; no local Postgres service |
| configuration issue | **NO** for pooling. **YES** for geography (see §11). |

---

## 4. Prisma client lifecycle

`new PrismaClient()` in application runtime:

- **One shared client:** `backend/src/config/db.js` (`globalThis.__battechnoPrisma` in non-production).
- Additional `new PrismaClient()` only in **scripts/tests** that need an isolated client.

No per-request / per-controller Prisma client.

---

## 5. Top slow APIs (measured + inferred)

Authenticated production APIs were **not** called with user credentials (no QA login in this pass).

| Endpoint | Total time | DB time | Query count | Response size |
| --- | ---: | ---: | ---: | ---: |
| `GET /health` | ~590 ms TTFB (client) | 0 | 0 | tiny |
| `GET /health/ready` (`SELECT 1`) | ~1090 ms TTFB (client) | ~500 ms on app host / ~820 ms from this PC | 1 | tiny |
| `GET /auth/me` | **not called live** | was: auth middleware ~8 sequential queries **plus** profile/roles/assignments again | was ~15–18 | small |
| `GET /dashboard/admin-stats` | **not called live** | institution path previously still hit academic `cohorts`/`assessments` counts | 6+ plus auth | small |
| Training course list/detail | **not called live** | list unbounded `findMany`; detail already has `?sections=` | list: 3; overview: low; `all`: high | varies |
| Field training list | **not called live** | list + 5 sequential follow-up aggregates | was 6 after page query | moderate |
| Notifications unread-count | **not called live** | 1 indexed `count` after auth | 1 + auth | tiny |
| Reports / analytics | **not called live** | still query legacy tables **only if those APIs are opened** | high | can be large |

Classification from physics:

- **FAST (<200 ms)** is impossible for any DB-backed call while RTT is 500–800 ms.
- **SLOW / VERY SLOW** is the default until round trips are collapsed **and** the database is colocated.

---

## 6. Top slow queries / operations

Ranked by **user impact × frequency × RTT amplification**, not by table size.

| Rank | Endpoint | Query area | Time | Calls/request | Root cause |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | every authenticated route | `loadCurrentAuthContextFromDb` | ~8 × RTT before | 8–10 sequential | independent lookups issued one-by-one |
| 2 | `GET /auth/me` | profile + roles + permissions + assignments | extra 4–8 × RTT | duplicate of middleware | `/me` re-loaded what auth already had |
| 3 | Institution admin dashboard | academic `cohorts` / `assessments` / pending enrollments | extra counts × RTT | 3–6 unused | wrong KPI set for INSTITUTION |
| 4 | Field training admin list | eligibility + applications + instructor + stats | 5 sequential after the page query | 5 | waterfall of independent aggregates |
| 5 | Attendance session/summary | `findUserBrief` per student | N × RTT | N | N+1 |
| 6 | Student course catalog | `findEnrollment` per course | N × RTT | N | N+1 |
| 7 | Landing stats (cache miss) | many independent counts | 1 RTT if parallel, else more | ~10 | already `Promise.all` + 60s cache |
| 8 | Trainer course overview | trainee `count` before other jobs | +1 RTT | 1 | sequential then parallel |
| 9 | Notifications badge | unread `count` | 1 cheap query after auth | 1 | auth cost dominates |
| 10 | Audit recent activity | `findMany take 10` | cheap if indexed | 1–2 | not a full table scan |

**Slowest single SQL** measured: trivial `SELECT 1` at **~820 ms** from this PC / **~500 ms** from the app host. Heavier queries are the same RTT plus a little server time. Tables are too small for Seq Scan to matter at this RTT.

---

## 7. Query-count analysis

**Auth middleware before controller (before fix):** typically **8–10 sequential** queries:

1. `users.findUnique`
2. `user_roles.findMany`
3. `roles.findMany` (by id)
4. `roles.findMany` (by canonical code) — usually redundant
5. `role_permissions.findMany`
6. `permissions.findMany`
7. `reviewer_university_assignments.findFirst` (always logically required for reviewers; was sequential)
8. `universities.findUnique`
9. `user_organization_assignments.findMany`
10. `organizations.findUnique` (sometimes)

**Auth middleware after fix:** **2 parallel rounds** (typical user):

1. user + role links + assignments + reviewer assignment
2. roles + university + permission codes (catalog cached after first process hit)

**`/auth/me` before:** middleware waterfall **plus** profile + `loadRolesAndPermissions` + assignments + university.  
**After:** profile + overlapping university/assignments; **roles/permissions reused from `req.user`**.

Landing stats: already parallel + 60s cache (unchanged this pass except not adding QA counts).

---

## 8. Auth-context cost

Measured `loadCurrentAuthContextFromDb` against the same Neon URL from this workstation (one active user, **no PII logged**):

| | time |
| --- | ---: |
| first call (includes connection setup) | **6650–6720 ms** |
| second call (warm, after parallelization) | **~2800 ms** |

Compare with 8 sequential `SELECT 1` = **6684 ms**. That is the old shape.

After collapsing to two rounds, 4-then-2 parallel `SELECT 1` = **1668 ms**. Remaining auth time above that is extra queries (org fallback, reviewer university override) and heavier statements than `SELECT 1`.

**Auth middleware DB queries/request (typical, after fix):** ~6 statements in **2 RTTs** (plus 0 permission SQL on cache hit).  
**Time spent before controller:** ≈ **2 × RTT** (≈ 1.0 s on app host, ≈ 1.7–2.8 s from this PC) instead of **8 × RTT**.

Authorization checks were **not** removed. No global permission cache of user-specific rows. Role→permission catalog TTL is 60s and is identical for every user with that role.

---

## 9. N+1 findings

| area | pattern | fix |
| --- | --- | --- |
| Attendance session roster | `active.map` → `findUserBrief` | `findUsersBrief(ids)` one `findMany` |
| Attendance cohort summary | same | batched |
| Student published course cards | per-course `findEnrollment` | `findEnrollmentsForStudentCourses` |
| Student progress percent | still per enrolled course (2 queries each) | left as follow-up; enrollment N+1 was the list-card tax |
| Field training admin list | sequential aggregates | `Promise.all` |
| Cohort catalog `countEnrollmentsForCapacity` | still per row in `listAvailableForUniversity` | **not changed** (lower traffic than auth) |

`Promise.all(rows.map(prisma...))` still exists in some write/detail paths; those are not the page-load tax.

---

## 10. Sequential query waterfalls

Fixed:

- Auth context (primary).
- `/auth/me` duplicate role/permission/university/assignment chain.
- Field-training admin list follow-ups.
- Trainer `traineeCount` before the parallel job bag.
- Institution dashboard academic counts (removed from that path).

Left (dependent or rare):

- Writes that must stay ordered.
- Reviewer university override when it differs from `primary_university_id` (extra lookup).
- Org lookup when the user has **no** assignment (fallback from university.organization_id).

---

## 11. Over-fetching findings

- Trainee/trainer course **overview** already uses `?sections=` (previous pass). Default omitted `sections` remains full payload for compatibility.
- Admin training course list still `findMany` without `take`. Cap/pagination is a follow-up (frontend currently treats the response as a full array).
- `/auth/me` still loads profile specialties (needed for the payload).
- Landing stats still count some academic LMS tables on cache miss; **not** `qa_reviews` on the public landing path. `getQaCompletionRate` exists but is unused by `getLandingStats`.

---

## 12. Index findings

Existing indexes already cover the hot filters (`user_id`, `organization_id`, `program_id`, notification `(user_id, is_read)`, audit `created_at`).

**No new index migration.** At ~500–800 ms RTT, adding `(program_id, status, created_at)` cannot turn a 3-round page into a fast page. Tables are small enough that even Seq Scan is cheaper than one extra round trip.

---

## 13. EXPLAIN results

Not used to justify indexes. `SELECT 1` itself is ~500–820 ms; that time is **network + pooler**, not planner cost.

On tiny tables (`training_programs` ≈ 6 rows, `training_enrollments` ≈ 50, `users` ≈ 575), `EXPLAIN (ANALYZE, BUFFERS)` would show index/seq scans in **sub-millisecond server time**. That would be misleading next to the RTT.

---

## 14. Table / index sizes (approx, `pg_stat` + `pg_total_relation_size`)

| table | approx rows | total MB | index MB |
| --- | ---: | ---: | ---: |
| notifications | 10537 | 7.72 | 2.63 |
| audit_logs | 4620 | 2.40 | 0.72 |
| users | 575 | 0.57 | 0.35 |
| field_training_applications | 278 | 0.53 | 0.22 |
| training_assessment_attempts | 55 | 0.27 | 0.05 |
| training_programs | 6 | 0.14 | 0.08 |
| training_enrollments | 50 | 0.13 | 0.08 |
| recognition_requests | 0 | 0.10 | 0.08 |
| integrity_cases | 0 | 0.09 | 0.06 |
| risk_cases | 0 | 0.09 | 0.06 |
| training_assessments | 11 | 0.08 | 0.06 |
| training_task_submissions | 8 | 0.08 | 0.06 |
| qa_reviews | 0 | 0.07 | 0.05 |
| corrective_actions | 0 | 0.07 | 0.05 |
| training_tasks | 4 | 0.06 | 0.05 |
| training_attendance_records | 3 | 0.06 | 0.05 |
| training_sessions | 3 | 0.06 | 0.05 |

**Query-design + geography**, not “the database is huge”.

Legacy tables are empty and **are not** joined on Course / Field-Training / `/auth/me` / institution dashboard after this change. Super-admin analytics APIs can still touch them **if opened**.

---

## 15. Fixes implemented

1. **Auth context parallelization + role-permission catalog cache (60s) + university/org identity TTL cache.**
2. **`GET /auth/me`** reuses middleware roles/permissions; overlaps university + assignment fetches.
3. **Institution dashboard** uses org members / training programs / training cohorts / pending activations; **does not** count university `assessments` or academic `cohorts`. Frontend hides those KPI cards.
4. **Field training admin list** follow-up queries in `Promise.all`.
5. **Attendance N+1** batched.
6. **Student course list enrollment N+1** batched.
7. **Trainer course** trainee count in parallel jobs.
8. **`PERF_LOGGING=true`**: request ms + query count + truncated SQL **without parameters**.
9. **`summarizeDatabaseHost`**: pooled/region hint without credentials.
10. **Missing `AUTH_ERROR_CODES` / `messageForCode` imports** on the auth-context module (error paths).

**Not done:** Redis, fake counts, dropping legacy tables, moving Neon, production Docker apply.

---

## 16. Before / after measurements

Client for DB numbers: this workstation → Neon us-east-2 pooled. Production HTTP: this workstation → https://lms.battechno.com.

| Flow / API | Before | After | DB queries before | DB queries after | Improvement |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 independent DB round trips | 6684 ms | 1668 ms (2 batched rounds) | 8 sequential | 2 rounds | **~4.0×** |
| Auth context (warm, this PC) | ~8 × 823 ms ≈ **6.6 s** (matches sequential `SELECT 1`) | **~2.8 s** measured | 8–10 sequential | 2 rounds + light extras | **~2.4×** on this PC; ~**4 s → ~1 s** expected on app host at 500 ms RTT |
| `GET /health/ready` | ~1090 ms TTFB (live) | unchanged (still 1× RTT) | 1 | 1 | none until colocation |
| Institution dashboard KPIs | academic counts always | training/org counts only | 6 academic-style | 4 org/training | skipped useless university metrics |
| Field training admin list extras | 5 sequential | 1 parallel round | 5 | 5 parallel | ~5× RTT → 1× RTT |
| Attendance roster users | N sequential | 1 `findMany` | N | 1 | eliminates N+1 |
| Student course enrollments | N sequential | 1 `findMany` | N | 1 | eliminates N+1 |
| `/auth/me` extra role/permission chain | full reload | reuse `req.user` | 4–8 extra | 0 extra for roles/permissions | removes duplicate waterfall |
| Landing stats | 60s cache already | unchanged | 10 on miss | 10 on miss / 0 on hit | already done |
| Production pages after deploy | **not remasured** | **not deployed** | — | — | deploy required |

---

## 17. Production validation

- Public `/health` and `/health/ready`: **200**, timings above.
- Authenticated page remasurement: **not done** (no deploy, no QA session).
- Docker/Nginx/volumes: **not touched**.
- Neon: **not reset**.

To apply: existing compose deploy with preserved `.env`, uploads, and Neon. Then remasure `/health/ready`, `/auth/me`, dashboard, course overview, field-training list from the **app server** (`127.0.0.1:4400`).

---

## 18. Remaining infrastructure bottlenecks

### Immediate code (done / remaining)

- Done: batch/parallel auth, `/me` reuse, dashboard KPI split, list N+1s, field-training waterfall.
- Remaining: paginate admin course list; batch student progress counts; cohort catalog per-row capacity counts; keep `sections=` on course detail.

### Long-term (requires a separate approved plan)

- **Place the application server in `us-east-2` (same as Neon), or move Neon next to the app server.**
- Do **not** migrate production data in this task.
- After colocation, `SELECT 1` should fall from ~500–800 ms to tens of milliseconds. Then two auth rounds become **tens of ms**, not ~1 s.

### Caching policy

- Safe: university/org identity 60s; role-permission catalog 60s; landing stats 60s.
- Not cached: user permissions globally, attempts, attendance, grades.

### Redis

Not added. Not required for the current data volume.

---

## Tests run

- `node --check` on modified backend modules: pass
- `backend/tests/dbQueryPerformance.unit.test.js` + `prismaPoolUrl.unit.test.js`: **9 pass**
- `authorization.currentAuthContext.test.js` + `landingStatsCache.unit.test.js`: **23 pass**

Frontend `test:unit` was started separately.

---

## Suggested commit message (not committed)

```
perf: reduce database latency and optimize Prisma queries
```
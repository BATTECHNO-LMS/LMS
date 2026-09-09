# BATTECHNO LMS — Performance Fix Report

**Date:** 2026-08-26  
**Production:** `187.55.228.232` / `https://lms.battechno.com`  
**Project on server:** `/root/BATTECHNO_LMS`  
**Git:** no commit, no push, no PR (per instructions)

---

## Executive Summary

Production was running an **August 17 frontend** and **August 19 backend**. Every authenticated request paid **8–9 sequential database round trips** to Neon `us-east-2` at **~500 ms each** (~4.0–4.5 s auth floor). The live frontend had **no gzip** and **no immutable asset cache**.

This session:

1. Deployed the current optimized backend and frontend to the **correct** LMS VPS only (GigzHouse left running).
2. Reduced auth to **two DB waves** (parallel user + assignments + roles + reviewer, then role/permission/university cache).
3. Stopped `/auth/me` from repeating assignment/university/role queries after authentication.
4. Collapsed the student dashboard to **one summary API**, and instructor cohort sessions to **one server-derived batch**.
5. Made completion readiness a **read-only batch** (no N writes when an admin opens the board).
6. Removed confirmed N+1 patterns (sessions, student courses, enrollments, role counts, cohort capacity).
7. Turned on **gzip + immutable hashed assets** in the frontend container Nginx, and **HTTP/2** on the LMS host vhost only.

**Remaining floor:** warm `SELECT 1` is still **~503 ms**. Node is healthy (`/health` **~2.1 ms**). A Neon EU region move is **planned, not executed**.

---

## Production versions before / after

| | Before | After |
|---|---|---|
| Backend container created | 2026-08-19T09:50:51Z | **2026-08-26T11:36:56Z** |
| Frontend container created | 2026-08-17T14:53:16Z | **2026-08-26T11:37:07Z** |
| Main JS | `index-tSzqNN2G.js` (~878 KiB / ~899 KB) | **`index-BozSE9yi.js`** |
| Main CSS | `index-DC376wxl.css` (~400 KiB / ~409 KB) | **`index-BORDngjN.css`** |
| Auth implementation | sequential 8–9 queries | **2 parallel waves** + nested assignments |
| Frontend container gzip | off | **on** |
| Hashed `/assets/` cache | missing | **`public, max-age=31536000, immutable`** |

GigzHouse (`gigzhouse-web` / `gigzhouse-api`) was not restarted or rebuilt.

---

## Auth

**Before (production Aug-19 image):** 8–9 sequential Prisma queries per authenticated request. At ~500 ms RTT: **~4.0–4.5 s auth floor**.

**After (deployed):**

Wave 1 (parallel):

- `users` including nested `user_organization_assignments`
- `user_roles`
- `reviewer_university_assignments`

Wave 2 (parallel / cached):

- `roles.findMany`
- university identity cache
- permission cache

**Auth after: 2 DB waves.**  
**Estimated auth floor after: ~1.0–1.5 s** at the current ~500 ms RTT (2 waves; cache hits do not remove the first user/roles round trip).

Authorization semantics preserved: organization type, university scope, active assignment, reviewer scope, `super_admin` `isGlobal`.

---

## `/auth/me`

**Before:** `authenticate` already loaded context, then `me()` / `toLoginUser` queried profile, assignments, and university again.

**After:** `req.authContext = req.user`. `me()` reuses `_profile`, `_assignmentRows`, `university`, `roles`, `permissions`. Extra assignment/university/role queries run only if context is missing.

**Duplicate queries: FIXED.**

Regression unit tests cover: super_admin, University Admin, Institution Admin, reviewer, instructor, student, trainer, trainee, multi-organization user. Response shape (`id`, `roles`, `permissions`, `isGlobal`, `scope`, `organizationAssignments`, `organizationType`, `universityId`, `role`, `activeRole`) is unchanged.

---

## Student dashboard

**Before:** ~10 business APIs + layout + `/auth/me` (each paying auth).

**After:** **`GET /api/v1/student/dashboard-summary`** (one authenticated business request) returning above-the-fold summaries only (active courses, next sessions, FT summary, pending assessment/task counts, progress, certificate **count**, notification preview). Full curricula, full grade/submission histories, and full certificate objects are not returned.

Layout still uses unread **count** and popups (not a full notification dump).

---

## Instructor dashboard

**Before:** load cohorts, then **up to 30** `GET /cohorts/:id/sessions`.

**After:** **`GET /api/v1/sessions/instructor`**. Cohort IDs are derived from `cohorts.instructor_id = requester.userId` (take 30). The browser cannot supply arbitrary cohort IDs. Super-admin (`isGlobal`) is still allowed by role middleware.

---

## Trainer dashboard

- Reuses `listTrainerCourses` assignments (no second `listActiveTrainerAssignments`).
- Upcoming sessions and KPI counts run in **one parallel wave**.
- Frontend uses React Query (`useTrainerDashboard`, `useTraineePrograms`) with `STALE.dashboard`.

---

## Completion readiness

**Before:** `getProgramCompletionReadiness` → for each enrollment sequentially `calculateTrainingCompletionEligibility` → `computeAndPersistProgress` (~10–12 queries/enrollment, including UPSERTs). Opening the board caused **N writes**.

**After:** program-level tasks/requirements/assessments/sessions loaded **once**; learner attendance/submissions/attempts/evaluations loaded in **batch**; grouped in memory; **read-only**. Persist remains on finalize / explicit progress recompute.

**Completion readiness: FIXED.**

---

## N+1 fixes

| Area | Before | After | Status |
|---|---|---|---|
| Sessions `serializeSession` | module/cohort per row | `serializeSessions` + `findModulesByIds` | **FIXED** |
| Student courses | lesson count + progress per course; lesson trees on list | `groupBy` lesson/progress by course IDs; list has no lesson tree | **FIXED** |
| Enrollments | one user per enrollment | `findUsersBrief` / `id IN (...)` | **FIXED** |
| User role counts | 7 roles × 2–3 sequential ID loads | one `GROUP BY` SQL aggregate | **FIXED** |
| Cohort capacity | `count()` per cohort | `groupBy` enrollment counts | **FIXED** |

---

## Frontend deployment

Rebuilt with `docker compose build --no-cache` so the old `dist` could not stick in the image.

Live hashes **changed** from `index-tSzqNN2G.js` / `index-DC376wxl.css` to **`index-BozSE9yi.js` / `index-BORDngjN.css`**.

---

## Gzip / cache before / after

Measured 2026-08-26 from the production VPS (public `https://lms.battechno.com` and local `127.0.0.1:8080` agree).

| Asset | Before raw | Before transferred | After raw | After transferred | gzip | Cache-Control |
|---|---|---|---|---|---|---|
| Main JS | ~899 KB | ~899 KB (no gzip) | **494 128 B** | **141 060 B** | **PASS** | `public, max-age=31536000, immutable` |
| Main CSS | ~409 KB | ~409 KB (no gzip) | **332 345 B** | **53 885 B** | **PASS** | `public, max-age=31536000, immutable` |
| `index.html` | — | — | 1 155 B | 516 B gzip | gzip on | **`no-cache, no-store, must-revalidate`** (not immutable) |

Authenticated APIs keep `Cache-Control: no-store` via the frontend container `/api/` location.

Host LMS vhost: **HTTP/2 enabled** (`listen 443 ssl http2`). Public probe: `HTTP/2 200`. Other vhosts (`gigzhouse.com`, `jeeran.battechno.com`) were not edited.

---

## Production measurements

From `187.55.228.232` after deploy:

| Probe | Before (audit) | After |
|---|---|---|
| Local `/health` median | 2.07 ms | **2.12 ms** |
| Local `/health/ready` median | 500.88 ms | **484.5 ms** |
| Warm `SELECT 1` median | 499.76 ms | **503.3 ms** |
| Public `/health` median | (host + app) | **31.9 ms** |
| Public `/health/ready` median | — | **545.6 ms** |

`/health` remains healthy. `SELECT 1` staying ~500 ms is **expected** until Neon EU.

**Authenticated timings:** **BLOCKED — no safe QA session.** No fabricated `/auth/me` or dashboard timings.

---

## Tests

| Check | Result |
|---|---|
| `npx prisma validate` | **PASS** |
| Backend `npm test` (729 tests, including new `/auth/me` + batched readiness) | **PASS** (0 fail) |
| Frontend `npm run test:unit` (88 tests) | **PASS** |
| Frontend `vite build` | **PASS** |
| Backend `node --check` on changed modules | **PASS** |
| Production `prisma migrate deploy` on boot | applied additive **`20260819120000_training_query_performance_indexes`** (`CREATE INDEX IF NOT EXISTS` only). No DROP/TRUNCATE/reset. |
| Security regression | **NONE** (scopes preserved; instructor batch does not trust client IDs; FT overview keeps university filter) |

---

## Remaining DB RTT

Paris application server → Neon **us-east-2** remains **~500 ms per query**. Code can no longer remove that floor. Further large gains require the EU Neon project.

---

## Neon migration recommendation

**Do not migrate automatically.**

Plan: `BATTECHNO_LMS_NEON_EU_MIGRATION_PLAN.md`

- Target: **`aws-eu-central-1` (Frankfurt)** — closest advertised Neon EU region to Paris. Alternative: London `aws-eu-west-2`.
- New Neon project required (region is immutable on a project).
- Dump/restore rehearsal, then approved cutover of `DATABASE_URL` (pooler) + `DIRECT_URL` (non-pooler).
- Rollback = restore previous `.env` to Ohio.

**DATABASE MIGRATED (region): NO**

---

## Server

| Item | Status |
|---|---|
| CPU/RAM (prior audit + containers healthy after recreate) | **HEALTHY** |
| Docker LMS backend/frontend | **HEALTHY** (listening; `/health` 200) |
| Unrelated containers | **untouched** |

---

## Suggested commit message (not committed)

```text
perf: reduce LMS database round trips and deploy optimized production build
```

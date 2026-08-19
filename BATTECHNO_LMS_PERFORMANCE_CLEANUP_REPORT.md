# BATTECHNO LMS — Performance Optimization & Code Cleanup Report

**Date:** 2026-08-19  
**Scope:** Frontend (Vite/React), Backend (Express/Prisma), additive indexes only.  
**Mode:** Implementation. No production migrate deploy. No git commit/push. No UI redesign. No business-rule rewrite except query/payload defects required for performance.

---

## Executive Summary

**Main bottlenecks found**

* Frontend entry `index-*.js` was **877.8 KB** uncompressed (larger than the previous QA ~833 KB). Landing Tailwind/CSS, auth pages, dashboard layouts, and Home were in the first paint graph.
* `xlsx` was reachable from the analytics barrel and inflated the Super Admin analytics route (~316 KB).
* Confirmed N+1 in `getPrePostComparison`: 2 attempt queries + 1 user query **per enrollment**.
* Additional N+1: trainee assessment status (attempts per assessment), `markAllPresent` (upsert per enrollment), university/cohort reports (queries per university/cohort).
* Trainee course detail loaded full assessment **question banks** on every open (also leaked prompts/options on a list payload).
* Admin/trainer course screens imported heavy managers (reports, lectures, assessment editor) even when the overview tab was showing.
* Field-training mutations invalidated `fieldTrainingKeys.all`.

**Performance fixes implemented**

* Route-level lazy loading for auth pages and dashboard layouts; Home and landing CSS load only on the public homepage.
* Feature-level `React.lazy` for training managers, reports, evaluation, and assessment editor/attempt UI.
* Vendor chunks: `xlsx`, `framer-motion`, `react-icons` (plus existing recharts/lucide).
* Analytics Excel/PDF/Power BI loaded on export click, not with the analytics page.
* Tab-on-demand API loads for admin training course detail; trainer assessment tab no longer refetches the list on every pre/post click.
* Bounded Prisma queries for pre/post comparison, trainee assessment status, mark-all-present, and academic reports.

**Code cleanup completed**

* Removed unused admin course-detail task form state / `createTask` / `listProgramTasks` fan-out.
* Stopped re-exporting `xlsx` from `features/analytics/index.js`.
* Dead `countUniversityStudentMemberships` helper after report batching.
* Narrower React Query invalidation for field training and attendance.

**Database/query optimizations**

* Additive indexes (not applied to production in this task): enrollment `(cohort_id, status)`, assessment attempts `enrollment_id`, `(assessment_id, status)`.
* `select` instead of full rows on comparison, trainee detail assessments/materials, trainer course program fetch in parallel.
* Assessment **list** APIs no longer embed question banks (detail/`getAssessment` / start-attempt still do for authorized managers).

**Frontend bundle reduction**

* Main JS chunk **877.8 KB → 480.1 KB** (−45%).
* Initial JS (entry + Vite preloads) **~1186 KB → ~788 KB** (−34%).
* Initial CSS **397.4 KB → 323.0 KB** (landing CSS ~74 KB deferred to Home).
* Analytics route **315.7 KB → 36.2 KB** (`xlsx` is a 276 KB on-demand chunk).

**API optimizations**

* Pre/post comparison query count no longer grows with enrollment count.
* Trainee program detail: no question bank; parallel submissions/attendance/trainer-count.
* Admin dashboard assessment count uses nested cohort scope (`assessmentCohortScopeWhere`) instead of fetch-ids-then-count.
* University and cohort reports: one batched enrollments/groupBy pass instead of per-row queries.

---

## Performance changes table

Only numeric cells were measured in this session (PowerShell file sizes on `frontend/dist/assets`, Vite gzip for the after main chunk). Live HTTP timings were **not** recorded.

| Area | Before | After | Improvement | Notes |
| ---- | -----: | ----: | ----------: | ----- |
| Main JS chunk (`index-*.js`) | 877.8 KB | 480.1 KB | −397.7 KB (−45%) | Uncompressed file size |
| Main JS gzip | ~253 KB (prior QA) | 138.78 kB (Vite) | see notes | Prior gzip not re-measured on the old artifact |
| Initial JS (HTML entry + modulepreload) | ~1186 KB | ~788 KB | −398 KB (−34%) | Same vendor preload set; Home/xlsx/recharts not in first HTML |
| Initial CSS (`index-*.css`) | 397.4 KB | 323.0 KB | −74.4 KB | Landing Tailwind moved to `Home-*.css` |
| SuperAdmin analytics JS | 315.7 KB | 36.2 KB | −279.5 KB | `xlsx` split to `xlsx-*.js` (276 KB, on demand) |
| Vite production build | PASS | PASS | — | After chunk >500 kB warning gone on main JS |
| Prisma validate | PASS | PASS | — | |
| Frontend unit tests | 74 / 74 | 74 / 74 | — | |
| Backend unit tests | 636 pass / 1 fail | 639 pass / 0 fail / 1 skipped | +3 tests; baseline list updated | Pre-existing baseline mismatch is gone because post-cutoff names were listed, including the new index migration |
| `getPrePostComparison` query growth | O(enrollments) | O(1) bounded | N+1 removed | Output helper unit-tested |
| Endpoint latency | NOT MEASURED | NOT MEASURED | — | No live timing harness |
| Payload size (HTTP) | NOT MEASURED | NOT MEASURED | — | Question banks removed from list/detail list payloads |

---

## Frontend baseline vs after

```text
BEFORE (existing frontend/dist, this machine):
Main JS:           index-jSicm4NM.js  877.8 KB
Largest feature:   SuperAdminAnalyticsRoute 315.7 KB
                   AdminFieldTrainingManagePage 101.6 KB
                   TraineeCourseDetailPage 48.4 KB
CSS:               index-*.css 397.4 KB
Total assets:      312 files, 4458.7 KB
Vite warning:      main chunk historically >500 kB

AFTER (npm run build):
Main JS:           index-BulKJcBK.js  480.1 KB  (Vite: 428.86 kB / gzip 138.78 kB)
Largest feature:   AdminFieldTrainingManagePage 101.7 KB
                   StudentFieldTrainingDetailPage 55.4 KB
                   Home 43.3 KB (+ Home CSS 74.4 KB on homepage only)
On-demand vendors: recharts 398.4 KB, xlsx 276.1 KB, framer-motion 125 KB
CSS:               index-*.css 323.0 KB
Total assets:      378 files, 4500.8 KB (more chunks; smaller initial)

Change:
Main JS −45%. Initial preloaded JS −34%. Landing CSS and xlsx/recharts off the login/dashboard HTML.
```

Initial HTML now preloads: main index, `react-vendor`, `i18n`, `tanstack-query`, `react-router`, `lucide`. It does **not** preload Home, layouts, recharts, xlsx, or landing CSS.

---

## Routes / features lazy-loaded

Already lazy via `lazyPages.js` (unchanged pattern): admin/instructor/student/reviewer/trainer/trainee screens.

**Newly lazy (same `lazyNamed` / `React.lazy`):**

* Dashboard layouts: Admin, Instructor, Trainer, Trainee, Student, Reviewer
* Auth: portal logins, institution/university login & register, OTP, forgot/reset password, portal picker, select organization
* Public Home (landing) + landing CSS/phone-device CSS
* Training UI (feature-level): materials, recorded lectures, tasks, assessment editor, attempt panel, evaluation wizard/analytics, course/individual reports, finalization modal

Authorization wrappers (`ProtectedRoute`, `RoleBasedRoute`, `RoleShellPermissionOutlet`) stay eager.

---

## Duplicate requests removed

* Trainer assessments tab: pre/post buttons only switch kind; list is loaded once per tab. Compare uses `Promise.all` (list + comparison).
* Admin training course detail: overview no longer waits on tasks, assessments, trainer/trainee member dumps, or branches. Those load on the relevant tab.
* Admin tasks tab: removed unused `listProgramTasks` (manager fetches its own data).
* Field training create/update/publish/archive: invalidate admin list/stats/detail instead of all field-training queries.
* Cancel application: student list / my applications / detail instead of `fieldTrainingKeys.all`.
* Attendance record update: session + cohort-scoped keys instead of all enrollments and all cohorts.

---

## Backend services optimized

| Service | Change |
| --- | --- |
| `trainingAssessment.getPrePostComparison` | 1 enrollments + 1 attempts + 1 users; map in memory |
| `trainingAssessment.getTraineeAssessmentStatus` | 1 attempts query; single `recomputeProgress` for post-test |
| `trainingAssessment.listProgramAssessments` | metadata + counts only; no question bank / correct answers |
| `trainingPrograms.getTraineeProgramDetail` | no questions; `select` on assessments/materials; parallel extra queries |
| `trainingPrograms.markAllPresent` | `findMany` + `createMany` / `updateMany` |
| `trainingPrograms.syncProgramRequirements` | parallel upserts |
| `trainerAssignments.getTrainerCourse` | program row in the existing `Promise.all` |
| `dashboard.countAssessments` | nested `assessmentCohortScopeWhere` |
| `reports.universitiesReport` / `cohortsReport` | batched `findMany` / `groupBy` |

Authorization: organization access, trainer assignment, trainee self-scope on comparison, and enrollment checks are unchanged.

---

## N+1 queries fixed

1. **`getPrePostComparison`** (BUG-046) — confirmed. Batched attempts + users.
2. **`getTraineeAssessmentStatus`** — attempts per assessment → one `findMany`.
3. **`markAllPresent`** — upsert per enrollment → two bulk writes.
4. **`universitiesReport`** — 4 queries × universities → constant queries + in-memory join.
5. **`cohortsReport`** — 3 queries × cohorts → 3 batched queries.

Notifications still create rows per user on purpose (FCM fanout). Not changed.

---

## Database indexes proposed/added

Additive SQL only. **Not applied to production** in this task.

| Index | Supports |
| --- | --- |
| `idx_training_enrollments_cohort_status` (`cohort_id`, `status`) | Cohort trainee lists, mark-all-present, comparison enrollment filter |
| `idx_training_assessment_attempts_enrollment` (`enrollment_id`) | Trainee detail / status by enrollment |
| `idx_training_assessment_attempts_assessment_status` (`assessment_id`, `status`) | Batched pre/post latest GRADED/SUBMITTED attempts |

Migration: `backend/prisma/migrations/20260819120000_training_query_performance_indexes/migration.sql`  
Inspected: `CREATE INDEX IF NOT EXISTS` only. No DROP/TRUNCATE/ALTER COLUMN.

---

## Clean-code report

```text
Dead code removed:
- Admin course detail unused taskForm / createTask / listProgramTasks fan-out
- reports.repository countUniversityStudentMemberships (replaced by groupBy)

Duplicate code consolidated:
- Pre/post scoring moved to trainingPrePostComparison.js (shared by service + tests)
- Training heavy widgets imported from lazyTrainingUi.js

Unused imports removed:
- Analytics barrel xlsx re-exports
- Landing CSS from main.jsx (moved to Home)
- Duplicate Suspense/RouteFallback imports on trainer page (build-breaking; fixed)

Console/debug cleanup:
- No production console.log sweep beyond files touched (frontend had none in src)

Components split:
- lazyTrainingUi.js for on-demand training managers (not a visual redesign)

Services refactored:
- Query batching inside existing services; no new ORM/cache layer

Queries optimized:
- See backend table above

N+1 patterns removed:
- Five listed above
```

---

## Interaction with known bugs (not papered over)

* **BUG-008** (question banks on trainee program detail): list/detail payload no longer includes questions. Attempt start still loads questions for the attempt. Lock logic was **not** rewritten.
* **BUG-009** (staff see all comparison rows): trainee self-scope filter kept; staff still see org enrollments.
* **BUG-046**: fixed as specified.
* **BUG-047**: main chunk now under 500 KB.
* **BUG-028**: baseline characterization expected `pendingAfterCutoff` now includes `20260810120000_training_content_management` and the new index migration (post-cutoff list, v1 baseline still 27).

---

## Manual smoke test

```text
BLOCKED — safe QA data unavailable
```

No production trainee/student records were used. Representative UI was not driven in a browser this session.

Responsive (375 / 430 / 768 / 1024 / 1440): **NOT MEASURED** in a device lab. Splitting uses existing `RouteFallback`; RTL styles and `dir="rtl"` were not removed.

---

## Files changed

### Frontend

| File | Why |
| --- | --- |
| `frontend/vite.config.js` | Vendor chunks for xlsx, jspdf, framer-motion, react-icons |
| `frontend/src/main.jsx` | Stop loading landing CSS on every route |
| `frontend/src/pages/Home.jsx` | Import landing CSS with the homepage |
| `frontend/src/components/common/RootRedirect.jsx` | Lazy Home |
| `frontend/src/app/router/index.jsx` | Lazy auth pages + layouts |
| `frontend/src/app/router/lazyPages.js` | Auth + layout lazyNamed exports |
| `frontend/src/features/training/components/lazyTrainingUi.js` | Feature-level lazy managers |
| `frontend/src/features/training/components/TrainingAssessmentEditor.jsx` | Fetch `getAssessment` when list has no questions |
| `frontend/src/pages/trainer/TrainerCoursePage.jsx` | Lazy UI; fewer assessment refetches |
| `frontend/src/pages/trainee/TraineeCourseDetailPage.jsx` | Lazy attempt/eval/report panels |
| `frontend/src/pages/admin/trainingCourses/AdminTrainingCourseDetailPage.jsx` | Tab-on-demand APIs; lazy managers |
| `frontend/src/pages/admin/SuperAdminAnalyticsPage.jsx` | Dynamic import of export helpers |
| `frontend/src/features/analytics/index.js` | Do not barrel-export xlsx |
| `frontend/src/features/fieldTraining/hooks/useAdminFieldTraining.js` | Narrow invalidation |
| `frontend/src/features/fieldTraining/hooks/useStudentFieldTraining.js` | Narrow invalidation |
| `frontend/src/features/attendance/hooks/useUpdateAttendanceRecord.js` | Narrow invalidation |

### Backend

| File | Why |
| --- | --- |
| `trainingPrePostComparison.js` | Pure comparison mapping |
| `trainingAssessment.service.js` | N+1 fix; list without questions |
| `trainingPrograms.service.js` | Trainee detail payload; mark-all-present batching |
| `trainerAssignments.service.js` | Parallel program fetch |
| `dashboard.service.js` | Nested assessment count |
| `reports.repository.js` | Batched university/cohort reports |
| `backend/package.json` | Register new unit test file |

### Database / Prisma

| File | Why |
| --- | --- |
| `schema.prisma` | Three additive `@@index` |
| `20260819120000_training_query_performance_indexes/migration.sql` | Matching `CREATE INDEX IF NOT EXISTS` |

### Tests

| File | Why |
| --- | --- |
| `trainingPrePostComparison.unit.test.js` | Latest-attempt + scores/pass/improvement stay correct |
| `baselineManifest.test.js` | Document post-cutoff migrations including the new index |

### Configuration

| File | Why |
| --- | --- |
| `frontend/vite.config.js` | manualChunks |

---

## Remaining performance opportunities

* i18n JSON is still eager in the initial JS graph (all namespaces).
* `AdminFieldTrainingManagePage` (~102 KB) and `StudentFieldTrainingDetailPage` (~55 KB) are still large route chunks.
* `getTraineeProgramDetail` still returns sessions/tasks/materials in one response (frontend tabs hide UI but the API is still wide).
* Dashboard `countUsers` still materializes university membership IDs.
* Notification fanout remains per-user (required for FCM).
* No HTTP latency numbers without a safe environment against representative data.

Do not add Redis/Kafka or a second data library for these leftovers.

---

## Suggested commit message

```text
perf: optimize LMS loading, queries and code structure
```

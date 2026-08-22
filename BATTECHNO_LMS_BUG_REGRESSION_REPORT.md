# BATTECHNO LMS — Bug Regression Verification Report

**Audit date:** 20 August 2026  
**Baseline:** `BATTECHNO_LMS_FULL_BUG_AUDIT.md` (48 bugs: 2 P0, 14 P1, 20 P2, 12 P3)  
**Subject:** **CURRENT WORKING TREE** on `main` (uncommitted QA fixes)  
**HEAD:** `8028658` `perf: optimize LMS loading, queries, and trainee course page`  
**Branch:** `main`, up to date with `origin/main`  
**Auditor method:** code-path re-verification of each original reproduction condition + unit tests + Prisma validate + frontend unit tests + production build. Live multi-account HTTP was not executed (no safe QA fixture matrix). Destructive DB actions were not performed.

---

## Executive summary

```text
Previous total:     48
Fixed:              40
Partially fixed:    8
Still present:      0
Regressions:        0
Blocked (as status): 0  (live MEU DB + live portal HTTP remain BLOCKED as evidence gaps)
New bugs:           2

Remaining P0:       0
Remaining P1:       3  (BUG-004, BUG-014, BUG-015 — all PARTIALLY_FIXED)
Remaining P2:       3  (BUG-021, BUG-023, BUG-035)
Remaining P3:       2  (BUG-044, BUG-048)

BUG FIX RATE:       40 / 48 × 100 = 83.3%
```

`PARTIALLY_FIXED` is **not** counted as fully fixed.

### Answer to: هل تم حل مشاكل تقرير BATTECHNO_LMS_FULL_BUG_AUDIT السابق؟

**In the current uncommitted working tree: mostly yes — 40 of 48 are fully fixed, 8 remain partial, 0 P0 remain, 0 original bugs are still fully reproducible.**

**On `origin/main` / last commit: no.** Almost all P0/P1 authorization, task HTTP wiring, sticky portal, academic scoping, and file ACL changes are **uncommitted**. `origin/main` still matches the previous audit except the performance commit (`BUG-008`, `BUG-028`, `BUG-033`, `BUG-046`, `BUG-047`).

### Production readiness

**READY FOR QA**

Not staging/production: remaining security-adjacent P1 residuals, no live cross-portal HTTP matrix, and the fix batch is not on `origin/main`.

---

## 1. Git / worktree state

| Item | Value |
| ---- | ----- |
| Branch | `main` |
| Tracking | up to date with `origin/main` |
| HEAD | `8028658` |
| Write git ops | none |
| Modified files | 59 |
| Untracked (code/tests) | `authorization.academicListByStudent.scope.test.js`, `files.acl.unit.test.js`, `trainingAssessment.attempt.unit.test.js`, `trainingRequirementThreshold.unit.test.js`, `TraineeProfilePage.jsx`, original audit MD |

### `trainingTaskWorkflow.service.js`

- **Present** on HEAD and in the working tree (tracked; additional HTTP/deadline/progress edits unstaged).
- **Imported** by `trainingPrograms.service.js` (`require('./trainingTaskWorkflow.service')`).
- **Used by HTTP routes:** `GET /tasks/:taskId`, `GET /tasks/:taskId/instruction-file`, `GET/POST .../submissions`, resubmit/grade/revision.
- **Covered by tests:** `trainingTaskWorkflow.unit.test.js` (`mapTraineeTask`, `canSubmitTask`) — included in `npm run test:unit`.
- **No `MODULE_NOT_FOUND`** in current tree: `getTraineeProgramDetail` requires the module.

### FCM / `fieldTraining.notifications.js`

- **HEAD / origin/main already uses** `createNotificationForUser` (loop + push fanout), not `createMany`, for `notifyStudentsAttendanceWindowOpened`.
- Working tree **did not modify** this file. `BUG-033` is fixed **on origin/main**.

### Distinction

```text
CURRENT WORKING TREE  = this audit (uncommitted QA batch + HEAD)
CURRENT BRANCH        = main
origin/main           = HEAD only (8028658). Does NOT contain P0/P1 AuthZ, sticky portal, academic listByStudent, /uploads auth, task HTTP extras, etc.
```

---

## 2. Automated checks vs previous baseline

| Check | Previous | Current | Classification |
| ----- | -------- | ------- | -------------- |
| Prisma validate | PASS | **PASS** | same |
| Backend unit | 636 / 637 pass (1 fail: baseline manifest) | **657 pass / 0 fail / 1 skip** (658 tests) | **FIXED FAILURE** (manifest) + new tests added |
| Frontend unit | 74 / 74 | **75 / 75** | new `toDatetimeLocalValue` test; all pass |
| Frontend production build | PASS (main ~833 kB / 253 kB gzip, >500 kB warning) | **PASS** — `index-CnwY4fiK.js` **431.08 kB / 139.14 kB gzip**; no 500 kB warning | **FIXED** `BUG-047` by real `manualChunks`, not by raising the warning threshold |

Backend skip (same as before, not a new failure): `GET /health/ready returns 503 when DATABASE_URL is not configured` — skipped because `DATABASE_URL` is set.

Largest JS chunks after split: `index` 431 kB (139 gz), `recharts` 408 kB (118 gz), `xlsx` 282 kB (95 gz), `react-vendor` 142 kB (46 gz).

---

## 3. Master comparison table

| Bug | Old Severity | Old Status | Current Status | Evidence | Remaining Action |
| --- | ------------ | ---------- | -------------- | -------- | ---------------- |
| BUG-001 | P0 | CONFIRMED | **FIXED** | `manageOpportunityListWhere` deny-all when FT admin has no `universityId`; `assertAdminOpportunityAccess` 403; characterization tests reject null-uni admin | Commit; live institution-admin HTTP once |
| BUG-002 | P0 | CONFIRMED | **FIXED** | `listByStudent` 403 without university; `requireOrganizationType('UNIVERSITY')` on students/grades/submissions; new scope tests | Commit; live HTTP once |
| BUG-003 | P1 | CONFIRMED | **FIXED** | `listByAssessment` adds `student_id` for non-staff | Commit |
| BUG-004 | P1 | CONFIRMED | **PARTIALLY_FIXED** | University routers now `requireOrganizationType('UNIVERSITY')`. Training routers **do not** use `requireOrganizationType('INSTITUTION')` | Add INSTITUTION gate on training admin routers |
| BUG-005 | P1 | CONFIRMED | **FIXED** | Service on git; GET task, instruction-file, submissions, resubmit wired | Commit; live E2E |
| BUG-006 | P1 | CONFIRMED | **FIXED** | Trainee UI: instructions, download, `canSubmit`, file+text | See NEW-BUG-001 for empty submit |
| BUG-007 | P1 | CONFIRMED | **FIXED** | `assertAttemptNotExpired` on save **and** submit; unit tests | Live timed attempt optional |
| BUG-008 | P1 | CONFIRMED | **FIXED** | Trainee program detail returns `questionCount` only (also on HEAD) | — |
| BUG-009 | P1 | CONFIRMED | **FIXED** | `getPrePostComparison` staff vs `user_id` self-scope; batched attempts | — |
| BUG-010 | P1 | CONFIRMED | **FIXED** | `mergeRequirementThreshold` preserves `passing_required` / `blocks_content`; unit test | Live LinkedIn save+re-read |
| BUG-011 | P1 | CONFIRMED | **FIXED** | Playback throws `CONTENT_LOCKED` when `preTestBlocksContent` and pre-test not ok | Live playback |
| BUG-012 | P1 | CONFIRMED | **FIXED** | Learner `listProgramTasks` filters `published_at not null`; trainee detail same | — |
| BUG-013 | P1 | CONFIRMED | **FIXED** | Login `portalType` required; JWT stamp; middleware rejects missing portal; `applyPortalScope` | Mobile clients must send portalType |
| BUG-014 | P1 | CONFIRMED | **PARTIALLY_FIXED** | `visibility==='public'` no longer grants strangers; owner/global only. No enrollment/entity bind | Domain-aware ACL |
| BUG-015 | P1 | CONFIRMED | **PARTIALLY_FIXED** | `/uploads` now `authenticate`. No per-object ACL — any JWT + known key still reads | Authorize storage keys |
| BUG-016 | P1 | CONFIRMED | **FIXED** | `mapAttempt` omits `gradingDetails` when `show_results` false; submit returns null scores | — |
| BUG-017 | P2 | CONFIRMED | **FIXED** | `ROUTE_RULES` for student/instructor/reviewer user-guide + notification-settings | — |
| BUG-018 | P2 | CONFIRMED | **FIXED** | `/reviewer/field-training` mapped to `canViewUniversityReports` | — |
| BUG-019 | P2 | CONFIRMED | **FIXED** | `/admin/courses` nav roles `[SUPER_ADMIN]` only | — |
| BUG-020 | P2 | CONFIRMED | **FIXED** | QA/risk/integrity/CA create/edit/view routes registered | — |
| BUG-021 | P2 | CONFIRMED | **PARTIALLY_FIXED** | `toDatetimeLocalValue` on tasks + assessment editor. Session create on trainer/admin still raw `datetime-local` | Convert session forms |
| BUG-022 | P2 | CONFIRMED | **FIXED** | Per-session `attendanceCodes` map | Confirm 120s product rule |
| BUG-023 | P2 | CONFIRMED | **PARTIALLY_FIXED** | Unlock skipped when `passing_required === true` and not passed. Implied `pass_score` rule in `assessmentOk` not used here | Align with `assessmentOk` |
| BUG-024 | P2 | CONFIRMED | **FIXED** | Required-task query uses `published_at: { not: null }` | — |
| BUG-025 | P2 | CONFIRMED | **FIXED** | Attendance % uses `counts_toward_hours` session set only | — |
| BUG-026 | P2 | CONFIRMED | **FIXED** | `resolveSessionHours` falls back to start/end duration; hours status uses measurable count | — |
| BUG-027 | P2 | CONFIRMED | **FIXED** | `/trainer` and `/trainee` wrapped in `RoleBasedRoute` | — |
| BUG-028 | P2 | CONFIRMED | **FIXED** | Manifest includes `20260810120000_training_content_management` (HEAD); unit tests pass | — |
| BUG-029 | P2 | CONFIRMED | **FIXED** | `submitTask` enforces `due_at`, `canSubmitTask`, recomputes progress. Late always rejected (no `allow_late`) | Confirm product wants no late submit |
| BUG-030 | P2 | CONFIRMED | **FIXED** | Instruction file: org check + trainer assignment for staff; enrollment for learners | — |
| BUG-031 | P2 | CONFIRMED | **FIXED** | `orderQuestions` + shuffle on start | — |
| BUG-032 | P2 | CONFIRMED | **FIXED** | Missing cert → `CERTIFICATE_NOT_ISSUED` | — |
| BUG-033 | P2 | CONFIRMED (origin) / local mitigated | **FIXED** | Attendance-window notify uses `createNotificationForUser` on HEAD | Live FCM optional |
| BUG-034 | P2 | CONFIRMED | **FIXED** | `updateTask` calls `hydrateAttachmentSettings` | — |
| BUG-035 | P2 | CONFIRMED | **PARTIALLY_FIXED** | Create persists `expected_sessions` + `timezone`. `short_description` folded into `description`, not `settings_json.shortDescription` | Align create with update |
| BUG-036 | P2 | CONFIRMED | **FIXED** | Null-uni FT admin deny-all (same root as BUG-001). Assigned instructor still scoped by `assigned_instructor_id` | Dual admin+instructor with uni still university-wide (intended admin) |
| BUG-037 | P3 | CONFIRMED | **FIXED** | `TASK_STATUS_AR` labels on trainee tasks | — |
| BUG-038 | P3 | CONFIRMED | **FIXED** | Admin catch-all → `AdminNotFoundPage` (404 copy) | Other shells still placeholder |
| BUG-039 | P3 | CONFIRMED | **FIXED** | `emailDomainMatchesAllowed` exact equality; test rejects `mail.uni.edu.jo` | — |
| BUG-040 | P3 | CONFIRMED | **FIXED** | Unknown role → `DENY_ALL`; characterization test | — |
| BUG-041 | P3 | CONFIRMED | **FIXED** | Dedicated `TraineeProfilePage` (untracked file — must be committed) | `git add` the page |
| BUG-042 | P3 | CONFIRMED | **FIXED** | Finalize not-eligible emits `TRAINING_NOT_ELIGIBLE` | — |
| BUG-043 | P3 | SUSPECTED | **FIXED** | Policy confirmed in unit test: exceptional finalize issues cert unless `certificateEnabled === false` | Not a defect |
| BUG-044 | P3 | SUSPECTED | **PARTIALLY_FIXED** | Latest GET can still return `legacy: true`; PDF download regenerates official if legacy | Stop serving legacy as READY |
| BUG-045 | P3 | CONFIRMED | **FIXED** | `includeCorrect` only global/admin/trainer — not reviewer | — |
| BUG-046 | P3 | CONFIRMED | **FIXED** | One enrollments query + one batched attempts query (HEAD) | — |
| BUG-047 | P3 | CONFIRMED | **FIXED** | Main JS 431 kB / 139 gz (was 833 / 253); `manualChunks` | Vendor `recharts` still 408 kB |
| BUG-048 | P3 | BLOCKED + missing scripts | **PARTIALLY_FIXED** | Dead `seed:middle-east-university` scripts **removed**. No MEU seed/catalog. Live `meu.edu.jo` **BLOCKED** | Product decision: seed MEU or drop the requirement |

---

## 4. P0 verification

### BUG-001 — FIXED

**Original:** Institution `admin` with `universityId = null` listed/managed all field-training opportunities.

**Current:**

- `manageOpportunityListWhere`: FT admin without `universityId` → `denyAllWhere()` (not `{}`).
- `assertAdminOpportunityAccess`: no university → `FIELD_TRAINING_FORBIDDEN`.
- `adminFieldTraining.routes.js` + academic FT: `requireOrganizationType('UNIVERSITY')` so institution-typed requester gets `PORTAL_MISMATCH`.
- Tests: `authorization.fieldTraining.characterization.test.js` — null-uni admin 403.

**Three-scope check (static + unit, not live HTTP):**

| Actor | Expected | Current |
| ----- | -------- | ------- |
| Institution admin | 403 / PORTAL_MISMATCH / deny-all | Denied by org-type middleware **and** deny-all list |
| University admin | Own university only | Eligibility where on `universityId` |
| Super admin | Global | `isSystemWideAdmin` → `{}` |

Live browser/API as three real accounts: **BLOCKED** (no QA fixture run). Classification remains FIXED because the original reproduction path is closed in Backend.

### BUG-002 — FIXED

**Original:** Staff `admin` without university dumped any student’s academic submissions/grades.

**Current:**

- `listByStudent` (submissions + grades): non-self staff without `isGlobal` and without `universityId` → 403; otherwise `assessmentCohortScopeWhere`.
- Students/grades/submissions routers: `requireOrganizationType('UNIVERSITY')`.
- Tests: `authorization.academicListByStudent.scope.test.js`.

| Actor | Expected | Current |
| ----- | -------- | ------- |
| Institution admin | Denied | PORTAL_MISMATCH on university routers; 403 in service if they somehow call it |
| Wrong-university admin | Denied | `assertUniversityRecordAccess` / cohort scope |
| Same-university admin | Allowed | Scoped `findMany` |

---

## 5. Portal isolation matrix (Backend)

Sticky JWT `portalType` is required. `applyPortalScope` filters roles:

| Role | UNIVERSITY portal | INSTITUTION portal |
| ---- | ----------------- | ------------------ |
| super_admin | allowed (global, unscoped) | allowed (global, unscoped) |
| admin | university roles kept; institution org stripped | institution roles kept; `universityId` nulled |
| reviewer | kept | stripped |
| instructor | kept | stripped |
| student | kept | stripped |
| trainer | stripped | kept |
| trainee | stripped | kept |

University private APIs (`/tracks`, `/universities`, `/assessments`, `/grades`, `/submissions`, `/students`, `/cohorts`, FT admin/academic): **`requireOrganizationType('UNIVERSITY')`**. Hidden nav is **not** the control.

Institution training **list** (`listTrainingCourses`) 403s non-`INSTITUTION` org type. Other `/training/*` manage routes rely on `assertOrganizationAccess` + trainer assignment — **no router-level INSTITUTION type gate** (BUG-004 remainder).

---

## 6. Evidence for FIXED bugs (short)

**BUG-003** — Non-staff `listByAssessment` filters `student_id = requester.userId`. Classmate dump closed at service layer.

**BUG-005** — `trainingTaskWorkflow.service.js` present; routes for get task, instruction-file, list/create submissions, resubmit. Trainee program detail no longer depends on a missing module.

**BUG-006** — `TraineeCourseDetailPage`: instructions, `getTaskInstructionFile`, `canSubmit`, `content_url` file field. Form not hidden after first submit when `canSubmit`.

**BUG-007** — `saveAttemptAnswers` and `submitAttempt` call `assertAttemptNotExpired`; expired IN_PROGRESS marked `EXPIRED`. Unit: `trainingAssessment.attempt.unit.test.js`.

**BUG-008** — `getTraineeProgramDetail` assessment payload is metadata + `questionCount` only. POST questions still require `assertPostTestEligible` on GET assessment.

**BUG-009** — Non-staff comparison query adds `user_id: requester.userId`.

**BUG-010** — `mergeRequirementThreshold({ passing_required: false, ...}, { pass_score })` keeps flags. LinkedIn seed still `passing_required: false` for PRE/POST. Live DB re-read after UI save: BLOCKED.

**BUG-011** — `getMaterialPlaybackUrl` learner path checks `preTestBlocksContent`.

**BUG-012** — Learner task lists require `published_at`.

**BUG-013** — `loginSchema.portalType` required enum; `buildTokenPayload` stores it; auth middleware 401 `PORTAL_REQUIRED` if absent.

**BUG-016** — `mapAttempt` / submit response hide `gradingDetails` and scores when `show_results === false`.

**BUG-017–020, 027, 038, 040, 041** — Router + `rolePermissions` + nav + `TraineeProfilePage` + admin 404 as in master table.

**BUG-022** — `attendanceCodes[s.id]` per session.

**BUG-024–026** — Published required tasks; attendance numerator/denominator same countable set; hours from `resolveSessionHours`.

**BUG-028** — Baseline manifest includes the training-content migration; previous unit failure gone.

**BUG-029–034, 036–037, 039, 042–043, 045–047** — As master table. `BUG-043` closed as **intended policy**, not a remaining defect.

---

## 7. Detailed evidence — unresolved (PARTIALLY_FIXED)

### BUG-004

- **Current reproduction:** Institution admin on INSTITUTION portal calling `GET /api/v1/tracks` or FT admin → `403 PORTAL_MISMATCH`. University `admin`/`instructor`/`reviewer` can still **hit** `PATCH /api/v1/training/programs/:id` (role `manage` includes those codes). Denial then depends on org-id match, not portal type.
- **Expected:** INSTITUTION type middleware on training-course admin, symmetric with university routers.
- **Actual:** University direction fixed; institution training routers ungated by type.
- **Files:** `trainingPrograms.routes.js` (no `requireOrganizationType`); `authorization.middleware.js`; university routers listed in git diff.
- **Remaining root cause:** Recommended INSTITUTION router gate never applied.
- **Next fix:** `router.use(requireOrganizationType('INSTITUTION'))` on training admin (allow global). Complexity: **Small**.

### BUG-014

- **Reproduction:** `GET /files/:id/download-url` as random authenticated user, `visibility=public`, not owner → **denied** (original bug closed). Same user enrolled in a course, file is course material they did not upload → **still denied** (happy path / entity bind missing).
- **Expected:** Owner/global **or** domain authorization (enrollment, task, material).
- **Actual:** Owner/global only (`canAccessFile`).
- **Files:** `files.service.js`; `files.acl.unit.test.js`.
- **Next fix:** Bind ACL to related entity. Complexity: **Medium**.

### BUG-015

- **Reproduction:** Unauthenticated `GET /uploads/<key>` → **401** (original closed). Authenticated other user with guessed key → static handler serves the file (**no** `canAccessFile`).
- **Expected:** Private objects require domain authorization.
- **Actual:** JWT only.
- **Files:** `app.js` (`authenticate` + `express.static`).
- **Next fix:** Replace static mount with an authorized file handler, or keep R2 signed URLs only. Complexity: **Medium**.

### BUG-021

- **Reproduction:** Task due / assessment open-close editors use `toDatetimeLocalValue` (`Asia/Amman`). Trainer and admin **session create** still `<input type="datetime-local">` bound to raw strings (browser local, then ISO).
- **Expected:** All wall times in program timezone.
- **Actual:** Mixed.
- **Files:** `TrainerCoursePage.jsx`, `AdminTrainingCourseDetailPage.jsx` vs `assessmentDate.js`.
- **Next fix:** Same helper on session forms + parse on submit. Complexity: **Small**.

### BUG-023

- **Reproduction:** POST `passing_required === true` and score below pass → evaluation stays locked (`POST_TEST_NOT_PASSED`). If `pass_score` is set but `passing_required` is omitted, `assessmentOk` treats passing as required (`passing_required !== false`) while `unlockEvaluationAfterPostTest` does **not** — failed POST still unlocks L1.
- **Expected:** Same centralized eligibility rule.
- **Actual:** Two predicates.
- **Files:** `trainingEvaluation.service.js` vs `trainingPrograms.service.js` `assessmentOk`.
- **Note:** CPF LinkedIn seed uses `passing_required: false` on POST — unlock-on-submit is correct for that course.
- **Next fix:** Reuse `assessmentOk` / shared helper. Complexity: **Small**.

### BUG-035

- **Reproduction:** Create program now writes `settings_json.expectedSessions` and `timezone`. `short_description` is copied into `description` only, not `settings.shortDescription` (update path still uses settings).
- **Expected:** Create ≡ edit persistence.
- **Actual:** Short description field mismatch.
- **Files:** `trainingPrograms.service.js` `createProgram`.
- **Next fix:** Persist `shortDescription` in settings like update. Complexity: **Small**.

### BUG-044

- **Reproduction:** `getLatestReport` still returns legacy individual/course rows as `status: READY` with `legacy: true`. UI hides export but still presents the snapshot. PDF download path regenerates official if `legacy`.
- **Expected:** Failed/missing official must not look like a generated official report.
- **Actual:** GET latest can still look complete via legacy.
- **Files:** `trainingReports.service.js`, `IndividualReportView.jsx`.
- **Next fix:** 404 or explicit “legacy draft” — never `READY` without official row. Complexity: **Small**.

### BUG-048

- **Reproduction:** `package.json` no longer references missing MEU scripts (original artifact bug closed). Repo has **no** `meu.edu.jo`, `MIDDLE_EAST_UNIVERSITY`, or MEU seed. Baseline catalog still Mutah / TTU / HTU / ZUJ / Yarmouk. Live org: **BLOCKED** (no production SQL).
- **Expected:** MEU UNIVERSITY org + exact `@meu.edu.jo` if still in product scope.
- **Actual:** Email exact-match engine exists (`BUG-039`); MEU row does not.
- **Next fix:** Product call: seed MEU or drop the university from scope. Complexity: **Medium**. Live verify: BLOCKED.

---

## 8. New bugs

### NEW-BUG-001 — Task submit accepts empty text and no file

- **Severity:** P2  
- **Status:** CONFIRMED (code)  
- **API:** `POST /api/v1/training/tasks/:taskId/submissions`  
- **Actual:** `content_text` and `content_url` may both be null; no “file required” check.  
- **Expected (retest §11):** file-only OK; file+text OK; no file fails when file required; optional textarea may be blank.  
- **Files:** `trainingTaskWorkflow.service.js` `submitTask`.  
- **Complexity:** Small.

### NEW-BUG-002 — Authenticated `/uploads` is not object-ACL’d

- **Severity:** P1  
- **Status:** CONFIRMED (code)  
- **Overlap:** residual of BUG-015 after the unauthenticated hole was closed.  
- **Actual:** Any valid JWT can read `GET /uploads/<storageKey>` if the path is known.  
- **Expected:** Same authorization as `canAccessFile` / signed URLs.  
- **Files:** `app.js`.  
- **Complexity:** Medium.

No other new 500s, broken imports, or missing `trainingTaskWorkflow` module were found in the working tree. Frontend production build succeeded.

---

## 9. Workflow area scores (working tree)

| Area | Result | Notes |
| ---- | ------ | ----- |
| Critical authorization (P0) | **PASS** | BUG-001 / 002 closed in Backend + unit tests |
| Portal isolation | **PARTIAL** | University routers typed; training not |
| Training tasks | **PARTIAL** | HTTP+UI wired; empty submit; E2E live BLOCKED |
| Assessments | **PARTIAL** | Timer, privacy, lock, shuffle OK; unlock predicate drift |
| Attendance | **PARTIAL** | Per-session codes OK; session TZ residual |
| Final evaluation | **PARTIAL** | Explicit `passing_required` OK; implied pass_score not |
| Reports | **PARTIAL** | Legacy GET remains |
| Trainer unassigned course | **BLOCKED** live; static `assertTrainerProgramAccess` | |
| Trainee IDOR | **BLOCKED** live; static owner checks on attempts/submissions/certs | |
| LinkedIn CV course | **PASS** static (seed + merge); live save BLOCKED | |
| Middle East University | **BLOCKED** / partial | |
| Performance | **PASS** | Main chunk under 500 kB |

---

## 10. Remaining bugs — fix order

### P0

*(none in working tree)*

### P1 — security / data exposure / auth

1. **NEW-BUG-002 / BUG-015 remainder** — authorize `/uploads` objects  
2. **BUG-004** — `requireOrganizationType('INSTITUTION')` on training admin  
3. **BUG-014** — entity-bound file ACL  

### P2 — core workflow / assessment integrity

4. **BUG-023** — single passing-required helper for evaluation unlock  
5. **NEW-BUG-001** — reject empty task submit when file required  
6. **BUG-021** — session datetime-local → Asia/Amman helper  
7. **BUG-035** — persist `shortDescription` on create  

### P3 — reports / UX / data

8. **BUG-044** — do not present legacy as official READY  
9. **BUG-048** — MEU seed or explicit out-of-scope  
10. Commit **TraineeProfilePage.jsx** with the rest of the batch  

**Then:** commit the working tree, run a live portal×role HTTP matrix, then re-audit `origin/main`.

---

## 11. Production readiness verdict

**READY FOR QA**

| Criterion | Working tree | origin/main |
| --------- | ------------ | ----------- |
| Unresolved P0 | 0 | **BUG-001, BUG-002 still present** |
| Unresolved security-critical P1 | 3 partial (004/014/015) + NEW-BUG-002 | Most original P1 still present |
| Core workflows verified | Unit + static; live E2E incomplete | Pre-fix |
| Build/tests | PASS | HEAD perf tests only |
| Portal isolation | PARTIAL | FAIL |
| Data scope | P0 PASS | FAIL |
| Critical regression | none found | n/a |

**NOT READY** for production or staging until: (1) the working-tree batch is committed and deployed to a QA/staging env, (2) remaining P1 file/portal residuals are fixed or accepted, (3) a live role×portal matrix is run.

---

## 12. Suggested commit message (audit did not change product code)

No source change was required to run this audit. If the existing uncommitted fix batch is committed later:

```text
fix: close LMS audit P0/P1 authz, sticky portal, tasks, and assessment integrity

Enforce university org-type and deny-by-default field-training/academic scope,
require sticky portalType, wire task workflow HTTP, and add server-side
assessment expiry plus requirement-threshold merge.
```

Do **not** commit `.env` or secrets. Include untracked tests and `TraineeProfilePage.jsx`.

---

## 13. Git snapshot at end of audit

See following `git status` / `git diff --stat` in the Cursor response (read-only). This report file is an additional untracked artifact.

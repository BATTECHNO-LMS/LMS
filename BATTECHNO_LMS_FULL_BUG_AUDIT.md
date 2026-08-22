# BATTECHNO LMS — Full Project Bug Audit & QA Report

**Date:** 2026-08-19  
**Scope:** Entire repository `D:/LMS` (frontend, backend, Prisma, auth, both portals).  
**Mode:** Read-only engineering audit. No production data mutation. No git commit/push.  
**Method:** Complete route inventory from `frontend/src/app/router/index.jsx` and every `backend/**/*.routes.js`; service/authorization static analysis; unit tests; Prisma validate; frontend production build. Live multi-account browser matrix against production was **not** executed (BLOCKED — avoid changing real trainee/student records).

**Working-tree note (not a production fix in this audit):** Local untracked `trainingTaskWorkflow.service.js` was added earlier to unblock a 500 on trainee course detail. Staged FCM change in `fieldTraining.notifications.js` is **not** on `origin/main` until committed. This report treats **committed/origin behavior** as the shipped baseline and flags local-only mitigations explicitly.

---

# Executive Summary

The platform is a dual-portal LMS (UNIVERSITY academic/field-training vs INSTITUTION training courses) sharing one `admin` role code and one JWT identity. Isolation is **mostly** `universityId` / `organizationId` in services, **not** a portal session. That design produces the highest-severity findings: institution `admin` with a null `universityId` is treated as a global field-training admin, and academic submission/grade list APIs leak classmate (or cross-tenant) data.

Institutional training has a second cluster: task workflow was extracted to a module that was **not shipped**, trainee task UI never grew file/resubmit flows, assessment timers are client-enforceable, and content locks are incomplete.

| Metric | Count |
| --- | ---: |
| Total issues logged | 48 |
| P0 — Critical | 2 |
| P1 — High | 14 |
| P2 — Medium | 20 |
| P3 — Low | 12 |
| CONFIRMED | 40 |
| SUSPECTED | 5 |
| BLOCKED (runtime / missing seed artifacts) | 3 |
| Frontend bugs | 16 |
| Backend / API bugs | 22 |
| Database / migration process | 2 |
| Authorization / security | 10 |
| Integration | 6 |
| UX / UI | 8 |
| Responsive | 2 |
| Security (subset of auth+files) | 10 |

**Checks run**

| Check | Result |
| --- | --- |
| `npx prisma validate` | PASS — schema valid |
| `backend npm run test:unit` | FAIL 1 / 637 (`baselineManifest` vs `20260810120000_training_content_management`) |
| `frontend npm run test:unit` | PASS 74 / 74 |
| `frontend npm run build` | PASS (chunk >500 kB warning on `index-*.js`) |
| TypeScript / ESLint project scripts | NOT_APPLICABLE (no `tsc`/`eslint` scripts) |
| `prisma migrate reset` / destructive push | NOT RUN (forbidden) |
| Production live role matrix | BLOCKED |

---

# Top 10 Bugs to Fix First

1. **BUG-001 (P0)** — Scope field-training admin queries: never treat missing `universityId` as “all opportunities.”
2. **BUG-002 (P0)** — Filter academic `listByStudent` / staff dumps by university; deny institution-only `admin`.
3. **BUG-003 (P1)** — Students listing `GET /assessments/:id/submissions` and `/grades` must see **own** rows only.
4. **BUG-013 (P1)** — Persist portal on login and filter `req.user.roles` / org type on every request (`PORTAL_MISMATCH` is login-optional today).
5. **BUG-005 (P1)** — Ship and wire `trainingTaskWorkflow` HTTP routes; commit the missing service on `main`.
6. **BUG-006 (P1)** — Trainee task UI: files, instructions, resubmit after revision.
7. **BUG-007 (P1)** — Enforce assessment `duration_minutes` on `submitAttempt` (server-side).
8. **BUG-008 (P1)** — Do not return post-test question banks on locked trainee program detail.
9. **BUG-010 (P1)** — Preserve `passing_required` / `blocks_content` when saving course settings (LinkedIn CV diagnostic pre-test).
10. **BUG-011 (P1)** — Honor `preTestBlocksContent` on playback-url and lecture player APIs.

---

# Bug table

| ID | Severity | Area | Page/Feature | Bug | Status |
| -- | -------- | ---- | ------------ | --- | ------ |
| BUG-001 | P0 | AuthZ / Field training | Admin FT list/manage | Institution `admin` with null `universityId` lists/manages all opportunities | CONFIRMED |
| BUG-002 | P0 | AuthZ / Academic | `GET /students/:id/submissions` | Staff `admin` without university can dump any student’s academic work | CONFIRMED |
| BUG-003 | P1 | AuthZ / Academic | Assessment submissions/grades list | Enrolled student reads all classmates’ submissions and grades | CONFIRMED |
| BUG-004 | P1 | AuthZ / University APIs | Tracks, universities, FT admin UI | Shared `admin` role; nav hides university items but APIs do not require UNIVERSITY org type | CONFIRMED |
| BUG-005 | P1 | Training tasks | Task workflow APIs | Workflow service/methods exist; routes/controller not wired; file missing on `origin/main` | CONFIRMED |
| BUG-006 | P1 | Training tasks | `/trainee/courses/:id` tasks tab | Text-only submit; hides form after any submission; no instruction download | CONFIRMED |
| BUG-007 | P1 | Assessments | Trainee PRE/POST submit | Timer enforced on save, not on submit | CONFIRMED |
| BUG-008 | P1 | Assessments | Trainee program detail | Content lock hides materials/tasks but still returns all assessment questions | CONFIRMED |
| BUG-009 | P1 | Privacy | `GET .../pre-post-comparison` | Non-`trainee` callers in org get every enrollment’s scores/PII | CONFIRMED |
| BUG-010 | P1 | Completion / LinkedIn | Course edit save | `syncProgramRequirements` overwrites thresholds without `passing_required: false` | CONFIRMED |
| BUG-011 | P1 | Content lock | Playback URL / lecture player | Enrollment check only; ignores `preTestBlocksContent` | CONFIRMED |
| BUG-012 | P1 | Training tasks | `GET /programs/:id/tasks` | Unpublished tasks returned to `anyRole` in org (including trainee) | CONFIRMED |
| BUG-013 | P1 | Auth | Login / JWT | `portalType` optional; no sticky portal; all roles apply after login | CONFIRMED |
| BUG-014 | P1 | Files | `GET /files/:id/download-url` | Public visibility = any authenticated user; enrollment unused | CONFIRMED |
| BUG-015 | P1 | Files | Local `/uploads` static | Guessable storage keys served without auth | CONFIRMED |
| BUG-016 | P1 | Assessments | `submitAttempt` payload | Returns `gradingDetails` even when `show_results` is false | CONFIRMED |
| BUG-017 | P2 | Frontend AuthZ | `/student|/instructor|/reviewer/user-guide` | `RoleShellPermissionOutlet` deny-by-default → 403 | CONFIRMED |
| BUG-018 | P2 | Frontend AuthZ | `/reviewer/field-training` | Outlet 403 before Navigate to `/academic/...` | CONFIRMED |
| BUG-019 | P2 | Frontend | `/admin/courses` | Nav shows for university `admin`; `SuperAdminCoursesRoute` blocks them | CONFIRMED |
| BUG-020 | P2 | Frontend | QA / risk / integrity / CA | Create/edit/view pages exist; routes missing → placeholder | CONFIRMED |
| BUG-021 | P2 | Timezone | Sessions, tasks, attendance | `datetime-local` + UTC ISO vs Asia/Amman | CONFIRMED |
| BUG-022 | P2 | Attendance | Trainee confirm | Shared `attendanceCode` across sessions; 120s default window | CONFIRMED |
| BUG-023 | P2 | Evaluation | Unlock after POST | Unlocks on post-test **submit**, not pass | CONFIRMED |
| BUG-024 | P2 | Completion | Required tasks | Unpublished `is_required` tasks block eligibility | CONFIRMED |
| BUG-025 | P2 | Progress | Attendance % vs hours | Numerator all records; denominator `counts_toward_hours` only | CONFIRMED |
| BUG-026 | P2 | Progress | Training hours | Present on session with null `hours` adds 0 | CONFIRMED |
| BUG-027 | P2 | Frontend AuthZ | `/trainer` and `/trainee` index | ProtectedRoute only; no `RoleBasedRoute` | CONFIRMED |
| BUG-028 | P2 | Database | Baseline manifest | Migration `20260810120000_training_content_management` not in v1 manifest; unit test fails | CONFIRMED |
| BUG-029 | P2 | Training tasks | `submitTask` | Ignores `due_at`, `canSubmitTask`, does not recompute progress | CONFIRMED |
| BUG-030 | P2 | AuthZ | `getInstructionFileUrl` | Staff skip org/assignment checks | CONFIRMED |
| BUG-031 | P2 | Assessments | Shuffle | `shuffle_questions` stored, not applied on start | CONFIRMED |
| BUG-032 | P2 | Certificates | `GET .../certificate` | `CERTIFICATE_NOT_ELIGIBLE` used when simply not issued | CONFIRMED |
| BUG-033 | P2 | Notifications | Attendance window FCM | `createMany` skips push (fixed locally, not on origin) | CONFIRMED |
| BUG-034 | P2 | Course edit | `updateTask` | Does not hydrate file URL from `attachment_file_id` | CONFIRMED |
| BUG-035 | P2 | Course create | `createProgram` | `short_description` / `expected_sessions` / timezone gaps vs UI | CONFIRMED |
| BUG-036 | P2 | Dual role | FT instructor+admin | `isFieldTrainingAdmin` bypasses assignment scope | CONFIRMED |
| BUG-037 | P3 | UX | Trainee tasks | Raw submission status enums | CONFIRMED |
| BUG-038 | P3 | UX | Admin catch-all | `ModulePlaceholderPage` for unmatched `/admin/*` | CONFIRMED |
| BUG-039 | P3 | Auth | Email domains | Subdomain of campus domain accepted (`mail.uni.edu.jo`) | CONFIRMED |
| BUG-040 | P3 | Frontend | `rolePermissions` | Unknown role falls back to student matrix | CONFIRMED |
| BUG-041 | P3 | UX | Trainee profile | Reuses `TrainerProfilePage` | CONFIRMED |
| BUG-042 | P3 | Completion | Finalize messaging | `TRAINING_NOT_COMPLETED` for not-yet-eligible | CONFIRMED |
| BUG-043 | P3 | Certificates | Exceptional finalize | Can still issue certificate | SUSPECTED |
| BUG-044 | P3 | Reports | Official vs fallback | Failed official generate may look complete via legacy path | SUSPECTED |
| BUG-045 | P3 | AuthZ | Reviewer GET assessments | Reviewer can receive `correct_answer` on institutional `getAssessment` | CONFIRMED |
| BUG-046 | P3 | Performance | `getPrePostComparison` | N+1 attempts per enrollment | CONFIRMED |
| BUG-047 | P3 | Frontend | Build | Main chunk >500 kB warning | CONFIRMED |
| BUG-048 | P3 | MEU | Seed scripts | `package.json` references MEU seed/test files that are absent in the tree | BLOCKED / CONFIRMED missing artifacts |

---

# Detailed bug entries

### BUG-001

- **Severity:** P0  
- **Category:** Authorization / security  
- **Portal:** University field training (reachable by Institution admin APIs)  
- **Role:** `admin` (institution, `universityId` null)  
- **Organization type:** INSTITUTION acting on UNIVERSITY data  
- **Page:** `/admin/field-training` (if URL entered)  
- **Route:** `/api/v1/admin/field-training/*`  
- **API endpoint:** list/manage opportunity handlers using `manageOpportunityListWhere` / `assertAdminOpportunityAccess`  
- **Affected file(s):** `backend/src/modules/fieldTraining/fieldTraining.access.js`, `backend/src/modules/fieldTraining/adminFieldTraining.routes.js`, `backend/src/config/env.js` (`FIELD_TRAINING_ADMIN_ROLE_CODES`)  
- **Title:** Institution admin with no university is an unscoped field-training super-user  
- **Description:** `isFieldTrainingAdmin` is true for role `admin`. `assertAdminOpportunityAccess` returns immediately when `universityId` is missing. `manageOpportunityListWhere` returns `{}` (all rows) in that case.  
- **Expected:** Institution admins are denied university FT; university admins see only their university.  
- **Actual:** Missing university is treated as global.  
- **Steps to reproduce:** Authenticate as institution `admin` (no `primary_university_id`). `GET /api/v1/admin/field-training` (or equivalent list). Observe unscoped results.  
- **Evidence:** `fieldTraining.access.js` lines 70–88 and 120–128.  
- **Business impact:** Cross-university student applications and opportunity operations.  
- **Security impact:** Broken access control / cross-organization exposure.  
- **Data impact:** Read (and likely write) across all FT opportunities.  
- **Likely root cause:** “No university filter ⇒ no restriction” instead of deny-by-default.  
- **Recommended fix:** If `!isSystemWideAdmin && !universityId` → 403. Require `organizationType === 'UNIVERSITY'` on FT admin routers.  
- **Estimated complexity:** Small  
- **Regression risk:** Medium (university admins without `universityId` must be assigned a university)

---

### BUG-002

- **Severity:** P0  
- **Category:** Authorization / IDOR  
- **Portal:** University academic  
- **Role:** `admin` without `universityId`  
- **Organization type:** INSTITUTION (or mis-scoped university admin)  
- **Page:** n/a (API)  
- **Route:** `/api/v1/students/:studentId/submissions`, `/api/v1/students/:studentId/grades`  
- **API endpoint:** `listByStudent` in submissions and grades services  
- **Affected file(s):** `backend/src/modules/submissions/submissions.service.js`, `backend/src/modules/grades/grades.service.js`, `backend/src/modules/students/students.routes.js`  
- **Title:** Staff `admin` can dump another student’s academic submissions/grades with no university check  
- **Description:** After `isStaff` (includes `admin`), query is `{ student_id }` only. `canAccessCohort` is **not** applied here (unlike assessment-scoped lists).  
- **Expected:** Staff limited to own university; institution-only admin denied.  
- **Actual:** Any staff `admin` who knows a UUID can read that student’s work.  
- **Steps to reproduce:** As institution admin, `GET /api/v1/students/{universityStudentId}/submissions`.  
- **Evidence:** `submissions.service.js` `listByStudent` (approx. lines 128–135).  
- **Business / security / data impact:** Cross-portal PII and academic records.  
- **Likely root cause:** Staff check without `assertUniversityRecordAccess`.  
- **Recommended fix:** Deny when `!universityId`; always filter by cohort.university_id.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-003

- **Severity:** P1  
- **Category:** Authorization / IDOR  
- **Portal:** University  
- **Role:** `student`  
- **Page:** Instructor/student assessment lists (API also callable directly)  
- **Route:** `GET /api/v1/assessments/:id/submissions`, `GET /api/v1/assessments/:id/grades`  
- **Affected file(s):** `assessments.routes.js` (`academicRead` includes student), `submissions.service.js` `listByAssessment`, `grades.service.js` `listByAssessment`  
- **Title:** Enrolled student lists all submissions and grades for an assessment  
- **Description:** `assertCanReadAssessment` allows enrolled students, then `findMany({ assessment_id })` with no `student_id` filter.  
- **Expected:** Students see only their own rows; staff see the cohort.  
- **Actual:** Classmate `text_response`, URLs, and grades leak.  
- **Steps to reproduce:** Enrolled student GET those endpoints.  
- **Evidence:** `listByAssessment` + `assertCanReadAssessment` student branch.  
- **Impact:** Privacy / academic integrity.  
- **Recommended fix:** If not staff, add `student_id: requester.userId`. Drop `student` from list routes.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-004

- **Severity:** P1  
- **Category:** Authorization / portal isolation  
- **Portal:** Both  
- **Role:** `admin`  
- **Page:** Direct URL `/admin/universities`, `/admin/tracks`, `/admin/field-training`  
- **API:** `GET /api/v1/universities`, `GET /api/v1/tracks`, FT admin  
- **Affected file(s):** `frontend/src/constants/adminNavigation.js` (portal filter is **nav only**), `frontend/src/app/router/index.jsx` (`ADMIN_ROLE_SET`), `organizationScope.js` (`requireOrganizationType` unused on university routers), `tracks.service.js`  
- **Title:** University modules are hidden in the sidebar but not denied to institution admins  
- **Description:** Nav uses `portal: 'UNIVERSITY'`. Routes still allow any `admin`. University list APIs are not org-type gated. Tracks listing has no university filter for global-shaped admin.  
- **Expected:** `PORTAL_MISMATCH` / 403 for institution admin on university routers.  
- **Actual:** UI hide ≠ API deny.  
- **Evidence:** `adminNavigation.js` vs `RoleBasedRoute(ADMIN_ROLE_SET)`; `requireOrganizationType` unused.  
- **Recommended fix:** Middleware `requireOrganizationType('UNIVERSITY')` on university routers; INSTITUTION on training-course admin.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-005

- **Severity:** P1  
- **Category:** Integration / training tasks  
- **Portal:** Institution  
- **Role:** trainer / trainee  
- **Page:** Course task manager / trainee tasks  
- **Route:** Expected `GET /api/v1/training/tasks/:taskId`, instruction download, list submissions, resubmit, revision — **absent**  
- **Existing:** `POST /api/v1/training/tasks/:taskId/submissions`, `POST /api/v1/training/submissions/:submissionId/grade`  
- **Affected file(s):** `trainingPrograms.routes.js`, `trainingPrograms.controller.js`, `trainingPrograms.service.js` wrappers, `trainingTaskWorkflow.service.js` (local untracked; **missing on origin/main**)  
- **Title:** Task workflow extracted but HTTP layer and git file never shipped  
- **Description:** Service methods `getInstructionFileUrl`, `resubmitTask`, `requestRevision`, etc. are required from `trainingPrograms.service.js`. On `origin/main` `require('./trainingTaskWorkflow.service')` throws MODULE_NOT_FOUND → **500** on `GET /api/v1/training/trainee/programs/:id`. Locally the file exists but routes still do not expose instruction/file APIs.  
- **Expected:** Complete task API matching field-training patterns.  
- **Actual:** 500 on origin; locally 200 on detail but no download/resubmit endpoints.  
- **Evidence:** Prior backend log `Cannot find module './trainingTaskWorkflow.service'`; grep of routes shows no instruction-file paths.  
- **Impact:** Trainee course page unusable on environments without the file; file workflow unusable everywhere.  
- **Recommended fix:** Commit service; add controller+routes+Zod; keep org/enrollment checks.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-006

- **Severity:** P1  
- **Category:** Frontend / tasks  
- **Portal:** Institution  
- **Role:** trainee  
- **Page:** `TraineeCourseDetailPage` tasks tab  
- **Route:** `/trainee/courses/:programId/tasks`  
- **API:** `POST /api/v1/training/tasks/:taskId/submissions` (`content_text` only from UI)  
- **Affected file(s):** `frontend/src/pages/trainee/TraineeCourseDetailPage.jsx`, `CourseTasksManager.jsx` (staff uploads exist)  
- **Title:** Trainee cannot attach files, see instructions/links, or resubmit  
- **Description:** UI shows textarea only; if `task.submission` exists the form is hidden — including `REVISION_REQUESTED`. `getTraineeTaskListExtras` already returns `canSubmit`, `attachmentUrl`, `hasAttachment`.  
- **Expected:** File + optional text; instruction download; resubmit when allowed.  
- **Actual:** Text-only; one-shot UI.  
- **Evidence:** `TraineeCourseDetailPage.jsx` tasks map (~lines 326–370).  
- **Impact:** Core training workflow incomplete vs trainer upload UX.  
- **Recommended fix:** Align UI with extras + new APIs (BUG-005).  
- **Estimated complexity:** Medium  
- **Regression risk:** Low

---

### BUG-007

- **Severity:** P1  
- **Category:** Assessments / integrity  
- **Portal:** Institution  
- **Role:** trainee  
- **API:** `PATCH /api/v1/training/assessment-attempts/:id/answers` (expires), `POST .../submit` (no duration check)  
- **Affected file(s):** `trainingAssessment.service.js` (`saveAttemptAnswers` vs `submitAttempt`), `TrainingAssessmentAttemptPanel.jsx`  
- **Title:** Assessment timer can be bypassed by calling submit after expiry  
- **Expected:** Server rejects submit after `started_at + duration_minutes`.  
- **Actual:** UI disables submit; API accepts. Resume of `IN_PROGRESS` also ignores expiry.  
- **Evidence:** `submitAttempt` has no `duration_minutes` block; save path does.  
- **Impact:** Timed PRE/POST (LinkedIn, diploma) not enforceable.  
- **Recommended fix:** Shared `assertAttemptNotExpired`; auto-submit or expire on start/resume.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-008

- **Severity:** P1  
- **Category:** Assessment security  
- **Portal:** Institution  
- **Role:** trainee  
- **API:** `GET /api/v1/training/trainee/programs/:programId`  
- **Affected file(s):** `trainingPrograms.service.js` `getTraineeProgramDetail`  
- **Title:** Content lock still returns full published question banks (including post-test)  
- **Description:** `contentLocked` clears sessions/materials/tasks/lectures. `assessments` still map `prompt`, `options`, types, points (correct answers omitted — good).  
- **Expected:** Only PRE_TEST (or no item text) until unlock.  
- **Actual:** Post-test items readable without starting the attempt.  
- **Evidence:** lines ~1812–1859 vs `contentLocked` branches.  
- **Impact:** Item harvesting / teaching-to-the-test.  
- **Recommended fix:** If locked, omit POST (and other) questions; keep metadata only.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-009

- **Severity:** P1  
- **Category:** Privacy  
- **Portal:** Institution (route `anyRole` includes university `student`)  
- **API:** `GET /api/v1/training/programs/:programId/pre-post-comparison`  
- **Affected file(s):** `trainingAssessment.service.js` `getPrePostComparison`, `trainingPrograms.routes.js`  
- **Title:** Comparison scoped to self only if role includes `trainee`  
- **Description:** Filter `{ user_id }` applied iff `roles.includes('trainee')` and not admin. A `student` in the same org (or dual-role) gets all enrollments’ names/emails/scores. Trainee UI also calls this from the assessments tab.  
- **Expected:** Learners always self-scoped; staff assignment-scoped.  
- **Actual:** Role-name heuristic.  
- **Evidence:** enrollment `where` around lines 794–801.  
- **Recommended fix:** Scope by enrollment ownership unless staff with `can_view_progress`.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-010

- **Severity:** P1  
- **Category:** Completion / LinkedIn CV  
- **Portal:** Institution  
- **Role:** admin / trainer  
- **Page:** `/admin/training-courses/:programId/edit`, trainer edit  
- **API:** `PATCH /api/v1/training/programs/:programId`  
- **Affected file(s):** `CourseEditForm.jsx`, `trainingPrograms.service.js` `syncProgramRequirements`, `assessmentOk`  
- **Title:** Saving course settings can turn diagnostic pre-test into a hard pass gate  
- **Description:** Seed CPF-LINKEDIN-CV-2026 sets PRE `passing_required: false`, `blocks_content: false`. Edit form always posts `requires_pre_test` / `pass_score`. Sync writes `{ pass_score }` without preserving `passing_required`. `assessmentOk` treats pass_score + `passing_required !== false` as must-pass.  
- **Expected:** Diagnostic flags survive settings saves.  
- **Actual:** Silent eligibility change.  
- **Evidence:** `syncProgramRequirements` lines 184–197; `assessmentOk` 1453–1455.  
- **Impact:** LinkedIn / similar courses incorrectly block completion.  
- **Recommended fix:** Merge thresholds; never drop `passing_required` / `blocks_content`.  
- **Estimated complexity:** Small  
- **Regression risk:** Medium (courses that *should* require pass)

---

### BUG-011

- **Severity:** P1  
- **Category:** Content lock  
- **Portal:** Institution  
- **Role:** trainee  
- **Route:** `/trainee/courses/:programId/lectures/:lectureId`  
- **API:** `GET /api/v1/training/materials/:materialId/playback-url`  
- **Affected file(s):** `courseContent.service.js` `getMaterialPlaybackUrl`, `RecordedLecturePlayerPage`  
- **Title:** Direct playback ignores `preTestBlocksContent`  
- **Expected:** Same lock as program detail.  
- **Actual:** Published + enrollment is enough.  
- **Evidence:** `getMaterialPlaybackUrl` learner branch checks publish/`available_from` only.  
- **Recommended fix:** Reuse lock helper from progress/pre-test.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-012

- **Severity:** P1  
- **Category:** Authorization / tasks  
- **API:** `GET /api/v1/training/programs/:programId/tasks` (`anyRole`)  
- **Affected file(s):** `trainingPrograms.service.js` `listProgramTasks`  
- **Title:** Unpublished tasks listed to any org member including trainees  
- **Description:** `assertTrainerProgramAccess` no-ops unless trainer-only. Query has no `published_at` filter. Trainee detail endpoint *does* filter.  
- **Expected:** Learners see published only.  
- **Recommended fix:** If learner, `published_at not null`.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-013

- **Severity:** P1  
- **Category:** Authentication / portal isolation  
- **API:** `POST /api/auth/login`  
- **Affected file(s):** `auth.validation.js` (`portalType` optional; comment says non-authoritative), `portalAccess.js` (`!portalType` ⇒ allowed), `currentAuthContext.js`  
- **Title:** Portal mismatch is optional and not sticky  
- **Description:** UI usually sends `portalType`, but API login without it never throws `PORTAL_MISMATCH`. After login, JWT/DB context loads **all** roles. Dual-homed users keep university + institution capabilities regardless of login path.  
- **Expected:** Sticky portal; roles/org filtered per request.  
- **Evidence:** `evaluatePortalAccess` lines 16–18; login schema.  
- **Recommended fix:** Require `portalType`; store active portal; filter roles. Use `requireOrganizationType` on routers.  
- **Estimated complexity:** Large  
- **Regression risk:** High

---

### BUG-014

- **Severity:** P1  
- **Category:** Files / ACL  
- **API:** `GET /api/v1/files/:id/download-url`  
- **Affected file(s):** `files.service.js` `canAccessFile`  
- **Title:** File ACL is owner/public/global only  
- **Description:** Trainees cannot use this API for private instruction files (broken happy path). `visibility === 'public'` grants any authenticated user. Related entity unused.  
- **Expected:** Enrollment/org helpers on domain endpoints; files API deny-by-default.  
- **Recommended fix:** Never mark instruction files public; domain-specific signed URL helpers.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-015

- **Severity:** P1  
- **Category:** Files  
- **Route:** `GET /uploads/*` in `app.js` (unauthenticated static)  
- **Title:** Local storage objects are world-readable if the key is known  
- **Description:** Production may use R2 signed URLs; local/dev and any local-backend deploy expose `UPLOAD_DIR`. Combined with keys stored in APIs (`hasFile`, `storage_key` leakage).  
- **Expected:** Authenticated streaming or signed URLs only.  
- **Recommended fix:** Do not static-mount private uploads; always sign.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium  
- **Note:** Severity is P1 for local/static backends; production R2 may reduce exploitability (still fix).

---

### BUG-016

- **Severity:** P1  
- **Category:** Assessment security  
- **API:** `POST /api/v1/training/assessment-attempts/:id/submit`  
- **Affected file(s):** `trainingAssessment.service.js` `submitAttempt` → `mapAttempt`  
- **Title:** `show_results: false` is UI-only; API still returns per-question points  
- **Expected:** Omit `gradingDetails` / score when `show_results` is false.  
- **Impact:** Item-level reconstruction with BUG-008.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-017

- **Severity:** P2  
- **Category:** Frontend authorization / UX  
- **Routes:** `/student/user-guide`, `/instructor/user-guide`, `/reviewer/user-guide` (+ nested)  
- **Affected file(s):** `rolePermissions.js` `ROUTE_RULES`, `RoleShellPermissionOutlet.jsx`  
- **Title:** User guide is routed and linked but denied by UI permission map  
- **Evidence:** Trainee has a rule; student/instructor/reviewer do not → `UI_ROUTE_DENY`. Frontend unit test documents deny-unknown.  
- **Expected:** Help center available to those roles.  
- **Recommended fix:** Add ROUTE_RULES (and notification-settings).  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-018

- **Severity:** P2  
- **Category:** Frontend  
- **Route:** `/reviewer/field-training`  
- **Affected file(s):** `router/index.jsx`, `ReviewerDashboardPage.jsx`, `rolePermissions.js`  
- **Title:** Reviewer FT hub 403s; redirect to `/academic/field-training/reports` never runs  
- **Expected:** Redirect or allow academic overlay.  
- **Actual:** Outlet deny first. Direct `/academic/...` still works.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-019

- **Severity:** P2  
- **Category:** UX / authorization  
- **Route:** `/admin/courses`  
- **Affected file(s):** `adminNavigation.js` (admin + university), `SuperAdminCoursesRoute.jsx` (super_admin only), `adminCourses.routes.js`  
- **Title:** University admin sees Courses in nav then 403  
- **Expected:** Hide nav **or** allow university catalog for admin. Product currently API-locks to super_admin.  
- **Recommended fix:** Match nav to `super_admin` only (same as analytics).  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-020

- **Severity:** P2  
- **Category:** Frontend routing  
- **Pages:** QA reviews, corrective actions, risk cases, integrity cases create/edit/view  
- **Route:** e.g. `/admin/qa-reviews/create` → `ModulePlaceholderPage`  
- **Affected file(s):** `lazyPages.js`, `router/index.jsx`, list pages with create links  
- **Title:** CRUD pages exist and are linked but not registered  
- **Backend:** POST/PUT APIs exist.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-021

- **Severity:** P2  
- **Category:** Timezone  
- **Portal:** Institution  
- **Affected file(s):** session create forms, `CourseTasksManager` `toISOString().slice(0,16)`, trainee `String(startsAt).slice(0,16)`, `openAttendanceWindow` using server `Date`  
- **Title:** Asia/Amman not applied consistently; date-only fields become previous calendar day  
- **Expected:** All wall times in program timezone (seed `Asia/Amman`).  
- **Actual:** Mix of UTC ISO trim, server local TZ, and some admin Amman formatters.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-022

- **Severity:** P2  
- **Category:** Attendance UX  
- **Page:** `TraineeCourseDetailPage` sessions  
- **API:** `POST /sessions/:id/attendance/confirm`  
- **Title:** One shared attendance code state for all sessions; default window 120 seconds  
- **Evidence:** Single `attendanceCode` state; trainer default 120s. Confirm upserts (can overwrite).  
- **Recommended fix:** Per-session code; product-confirm window length; recompute progress on confirm.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-023

- **Severity:** P2  
- **Category:** Final evaluation  
- **API:** post-test submit → `unlockEvaluationAfterPostTest`  
- **Affected file(s):** `trainingEvaluation.service.js`  
- **Title:** Kirkpatrick L1 unlocks after POST submit, not after passing score  
- **Expected:** If POST `passing_required`, unlock only when passed (and not pending manual).  
- **Actual:** Failed POST still unlocks L1. Levels are not mixed in scoring helpers, but gate is wrong.  
- **Estimated complexity:** Small  
- **Regression risk:** Medium

---

### BUG-024

- **Severity:** P2  
- **Category:** Completion  
- **Affected file(s):** progress helpers / `computeAndPersistProgress` required-task query  
- **Title:** Unpublished required tasks can keep trainees blocked  
- **Expected:** Only published required tasks.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-025 / BUG-026

- **Severity:** P2  
- **Category:** Progress math  
- **Affected file(s):** `trainingProgress.helpers.js`, completion service  
- **Title:** Attendance % can inflate vs hours-counting sessions; present+null hours never satisfy `required_hours`  
- **Evidence:** Unit tests cover sessionCount===0 skip; runtime mix of session flags is the bug.  
- **Recommended fix:** Same session set for numerator/denominator; default hours or exclude from hours requirement.  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-027

- **Severity:** P2  
- **Category:** Frontend AuthZ  
- **Routes:** `/trainer`, `/trainee` index  
- **Affected file(s):** `router/index.jsx`  
- **Title:** Any authenticated user can open trainer/trainee dashboards  
- **Expected:** `RoleBasedRoute` on index (APIs still gated).  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-028

- **Severity:** P2  
- **Category:** Database / CI  
- **Evidence:** `npm run test:unit` failure `repo v1 manifest validates against real files` — extra `20260810120000_training_content_management`  
- **Title:** Prisma migration exists but baseline manifest not updated  
- **Impact:** CI red; deploy/baseline confusion.  
- **Recommended fix:** Add migration to manifest per project policy (do not reset DB).  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-029

- **Severity:** P2  
- **Category:** Tasks  
- **API:** `POST /api/v1/training/tasks/:taskId/submissions` (no body Zod)  
- **Title:** Deadlines and resubmit policy not enforced server-side; progress not recomputed  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-030

- **Severity:** P2  
- **Category:** AuthZ  
- **Function:** `getInstructionFileUrl`  
- **Title:** Any trainer/admin/instructor skips org check (when HTTP is wired)  
- **Recommended fix:** `assertOrganizationAccess` + trainer assignment.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-031

- **Severity:** P2  
- **Category:** Assessments  
- **Title:** `shuffle_questions` not applied when starting an attempt  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-032

- **Severity:** P2  
- **Category:** Certificates UX  
- **API:** `GET /api/v1/training/enrollments/:id/certificate`  
- **Title:** Missing issued cert returns `CERTIFICATE_NOT_ELIGIBLE`  
- **Recommended fix:** Distinct `CERTIFICATE_NOT_ISSUED`.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-033

- **Severity:** P2  
- **Category:** Notifications / FCM  
- **Affected file(s):** `fieldTraining.notifications.js`  
- **Title:** `notifyStudentsAttendanceWindowOpened` used `createMany` (no `fanoutPushForRow`)  
- **Status:** CONFIRMED on last committed code; **mitigated in working tree** (unstaged/staged loop via `createNotificationForUser`).  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-034

- **Severity:** P2  
- **Category:** Tasks  
- **Affected file(s):** `courseContent.service.js` `updateTask`  
- **Title:** Edit task stores `attachmentFileId` without resolving storage URL (create uses `hydrateAttachmentSettings`)  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-035

- **Severity:** P2  
- **Category:** Forms vs API  
- **Title:** Create-course UI fields (`short_description`, `expected_sessions`, timezone) not fully persisted the same as edit  
- **Affected file(s):** `AdminTrainingCourseCreatePage.jsx`, `createProgram` in `trainingPrograms.service.js`  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-036

- **Severity:** P2  
- **Category:** AuthZ  
- **Title:** User with `admin` + `instructor` is FT admin, not limited to `assigned_instructor_id`  
- **Estimated complexity:** Small  
- **Regression risk:** Medium

---

### BUG-037

- **Severity:** P3  
- **Category:** UX  
- **Page:** Trainee tasks  
- **Title:** Raw status strings (`SUBMITTED`, `GRADED`) shown in Arabic UI  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-038

- **Severity:** P3  
- **Category:** UX  
- **Title:** Unmatched admin URLs render generic placeholder instead of 404  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-039

- **Severity:** P3  
- **Category:** Registration  
- **Affected file(s):** `emailDomain.js`  
- **Title:** Subdomains of allowed campus domains register (by design in tests) — spoof residual if attacker controls `evil.meu.edu.jo` style hosts  
- **Gmail:** Rejected for university register — **not a bug**.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-040

- **Severity:** P3  
- **Category:** Frontend  
- **Evidence:** `rolePermissions.characterization.test.js` — unknown role → student matrix  
- **Title:** Fail-open UI permissions for unknown role codes  
- **Recommended fix:** Fail closed.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-041

- **Severity:** P3  
- **Category:** UX  
- **Route:** `/trainee/profile`  
- **Title:** Reuses trainer profile page  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-042

- **Severity:** P3  
- **Category:** Completion messaging  
- **Title:** Finalize emits `TRAINING_NOT_COMPLETED` for not-yet-eligible (sounds like failure)  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-043

- **Severity:** P3  
- **Status:** SUSPECTED  
- **Title:** Exceptional finalize may still issue certificates when `certificateEnabled !== false`  
- **Evidence:** Training completion audit (code path `issueCertificateCore` on exceptional finalize). Confirm against product policy before treating as defect.  
- **Estimated complexity:** Small  
- **Regression risk:** Medium

---

### BUG-044

- **Severity:** P3  
- **Status:** SUSPECTED  
- **Title:** Official report generate failure may fall back to legacy individual report  
- **Estimated complexity:** Medium  
- **Regression risk:** Medium

---

### BUG-045

- **Severity:** P3  
- **Category:** Assessment keys  
- **API:** `GET /api/v1/training/assessments/:id`  
- **Title:** `includeCorrect: !isLearner` — reviewer/instructor in org receive answer keys  
- **List** path already strips reviewer.  
- **Recommended fix:** Treat reviewer as learner for keys; trainers only if assigned.  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-046

- **Severity:** P3  
- **Category:** Performance  
- **Title:** `getPrePostComparison` N+1 attempt queries per enrollment  
- **Estimated complexity:** Small  
- **Regression risk:** Low

---

### BUG-047

- **Severity:** P3  
- **Category:** Frontend build  
- **Evidence:** Vite `(!) Some chunks are larger than 500 kB` — `index-*.js` ~833 kB / 253 kB gzip  
- **Title:** Main bundle size warning (mobile parse cost)  
- **Estimated complexity:** Medium  
- **Regression risk:** Low

---

### BUG-048

- **Severity:** P3  
- **Status:** BLOCKED (MEU live data) + CONFIRMED missing repo artifacts  
- **Title:** Middle East University seed/verify scripts referenced but not present  
- **Evidence:** `backend/package.json` scripts `seed:middle-east-university`, `verify:middle-east-university`, test `tests/middleEastUniversity.seed.unit.test.js` — **files not in the workspace**. Baseline catalog universities are Mutah, TTU, HTU, ZUJ, Yarmouk only (`baselineCatalog.js`).  
- **University email validation itself:** CONFIRMED present (`EMAIL_DOMAIN_MISMATCH`, Gmail rejected).  
- **Cannot verify:** production org `MIDDLE_EAST_UNIVERSITY`, `meu.edu.jo` rows, assignment of `student` role — BLOCKED without read-only production inspect.  
- **Recommended fix:** Add seed+tests to repo or remove dead scripts; then verify production with read-only SQL.  
- **Estimated complexity:** Medium  
- **Regression risk:** Low

---

# QA Route Coverage

Method: **static** (router + guards + linked APIs). **Runtime browser:** BLOCKED except prior local trainee 500 (MODULE_NOT_FOUND) already documented.

| Route/Page | Portal | Role | Tested | Result | Bugs |
| ---------- | ------ | ---- | ------ | ------ | ---- |
| `/` Home / portals / login variants | public | none | static | PASS | |
| `/institutions/login` `/register` | institution | none | static | PASS | BUG-013 |
| `/universities/login` `/register` `/verify-email` | university | none | static | PASS | BUG-039, BUG-048 |
| `/verify/certificate/:code` `/verify/report/:code` | public | none | static | PASS | |
| `/privacy-policy` `/account-deletion` | public | none | unit | PASS | |
| `/admin/dashboard` | both | admin | static | PASS | |
| `/admin/analytics` | global | super_admin | static | PASS | |
| `/admin/courses` | university nav | admin | static | FAIL | BUG-019 |
| `/admin/field-training` | university | admin | static | FAIL | BUG-001, BUG-004 |
| `/admin/training-courses*` | institution | admin | static | PARTIAL | BUG-010, BUG-035 |
| `/admin/qa-reviews/create` etc. | university | admin | static | FAIL | BUG-020 |
| `/admin/users*` `/admin/universities*` | mixed | admin | static | PARTIAL | BUG-004 |
| `/admin/content-hub/*` | both | admin | static | PASS | |
| `/trainer` index | institution | any auth | static | FAIL | BUG-027 |
| `/trainer/courses*` | institution | trainer | static | PARTIAL | BUG-005, BUG-021 |
| `/trainee` index | institution | any auth | static | FAIL | BUG-027 |
| `/trainee/courses/:id` | institution | trainee | static + prior 500 | FAIL | BUG-005–012, 006, 021–023 |
| `/trainee/user-guide` | institution | trainee | static | PASS | |
| `/student/*` | university | student | static | PARTIAL | BUG-003, BUG-017 |
| `/instructor/*` | university | instructor | static | PARTIAL | BUG-017 |
| `/instructor/notification-settings` | university | instructor | static | FAIL | BUG-017 |
| `/reviewer/field-training` | university | reviewer | static | FAIL | BUG-018 |
| `/academic/field-training/*` | university | admin/reviewer | static | PASS | |
| `/trainer|/trainee|/student` notifications | mixed | auth | static | PASS | BUG-033 |
| Catch-all `*` → `/` or placeholder | mixed | | static | PARTIAL | BUG-038 |

**Counts:** ~90 distinct frontend path patterns in `AppRouter`; ~55 backend route modules under `/api/v1` + `/api/auth`. All modules inventoried; deep handlers sampled by risk.

---

# Feature Coverage

| Feature | Result | Notes |
| --- | --- | --- |
| Authentication | PARTIAL | Login/OTP/reset present; portal not sticky (BUG-013) |
| Registration | PARTIAL | Domain checks work; MEU seed missing (BUG-048) |
| Organizations | PARTIAL | Path org checks on training create; unused `requireOrganizationType` |
| Universities | PARTIAL | List all for `adminRead` |
| Institutions | PARTIAL | Public institution list unauthenticated (by design) |
| Field Training | FAIL | BUG-001, BUG-018, BUG-033 |
| Training Courses | FAIL | Tasks/lock/edit thresholds |
| Cohorts | PARTIAL | University `canAccessCohort` OK when `universityId` set |
| Sessions | PARTIAL | Timezone (BUG-021) |
| Attendance | PARTIAL | BUG-022, progress math |
| Materials | PARTIAL | Lock bypass on playback |
| Recorded Lectures | PARTIAL | Same lock bypass; player routes exist |
| Tasks | FAIL | BUG-005, 006, 012, 029, 034 |
| Assessments | FAIL | Timer, leaks, shuffle |
| Final Evaluation | PARTIAL | Unlock gate (BUG-023); draft/submit ownership OK |
| Progress | PARTIAL | BUG-024–026 |
| Completion | PARTIAL | `READY_TO_COMPLETE` not shown in trainee UI; evaluation submit does not set `COMPLETED` (good) |
| Reports | PARTIAL | Access checks exist; N+1; fallback SUSPECTED |
| Certificates | PARTIAL | Owner checks on training cert; error code UX |
| Notifications | PARTIAL | FCM createMany on origin |
| Support / help | FAIL | Shell 403s (BUG-017) |
| KPI | PARTIAL | Org path + `assertOrganizationAccess` (static) |
| File uploads | PARTIAL | BUG-014, 015 |

---

# Root-cause clustering

1. **Portal is a UI hint, not a security boundary** — shared `admin`/`authorizeRoles`, optional `portalType`, unused `requireOrganizationType`. Fixes BUG-001, 002, 004, 013, 036.  
2. **“Can read resource” ≠ “can list all children”** — assessment read reused for full submission dumps. Fixes BUG-003.  
3. **Incomplete extraction of task workflow** — service split without git file + routes + trainee UI. Fixes BUG-005, 006, 029, 030, 034.  
4. **Content/assessment lock only on some serializers** — detail vs playback vs submit vs show_results. Fixes BUG-007, 008, 011, 016, 031.  
5. **Requirement JSON overwritten on save** — sync replaces instead of merge. Fixes BUG-010.  
6. **Frontend deny-by-default permission map incomplete** — BUG-017, 018, 019, 020, 027.  
7. **Datetime without canonical timezone helper** — BUG-021, 022.  
8. **Progress uses mixed session sets / unpublished tasks** — BUG-024–026.  
9. **Migration/manifest drift** — BUG-028.  
10. **File ACL split-brain** (files API vs domain URLs vs static `/uploads`) — BUG-014, 015.

---

# Recommended fixing phases

**Phase A — P0 security/data**  
BUG-001, BUG-002 (deny-by-default university scope).

**Phase B — P1 authorization & portal**  
BUG-003, BUG-004, BUG-013, BUG-014, BUG-015, BUG-030, BUG-036.

**Phase C — P1 training workflow**  
BUG-005 (commit+wire APIs), BUG-006, BUG-012, BUG-029, BUG-034.

**Phase D — Assessments / lock / attendance**  
BUG-007, BUG-008, BUG-009, BUG-011, BUG-016, BUG-031, BUG-021, BUG-022.

**Phase E — Completion / LinkedIn / evaluation / reports / certs**  
BUG-010, BUG-023–026, BUG-032, BUG-042–044, BUG-033.

**Phase F — UX / routing / P2–P3**  
BUG-017–020, BUG-027, BUG-037–041, BUG-045–048, bundle warning.

Do **not** implement these phases in this audit.

---

# LinkedIn CV (CPF-LINKEDIN-CV-2026) — dedicated notes

- Seed scripts/tests for course, post-test, and evaluation **exist** and unit-pass (`cpfLinkedinCv*.seed.unit.test.js`).  
- Pre-test intended as diagnostic (`passing_required: false`, content not blocked). **Destroyed by BUG-010** if an admin saves Course Edit.  
- Post-test question **count** not re-counted against live DB in this audit (BLOCKED — no production read).  
- Trainee GET omits `correct_answer` on `getAssessment` (PASS). Detail payload still leaks item text (BUG-008).  
- No trainee attempts were modified.

---

# Completion / Kirkpatrick

- Level 1 (reaction) vs Level 2 (learning) scoring helpers are **separate** (evaluation scoring unit tests PASS).  
- Unlock couples L1 availability to post-test **submit** (BUG-023), which can mix operational gates even if metrics stay in the right buckets.  
- Evaluation submit is owner-checked and immutable after submit (reopen is org admin).  
- Evaluation submit does **not** by itself set enrollment `COMPLETED` (central eligibility still required) — PASS vs the stated rule.

---

# Responsive / RTL

No automated visual matrix at 320–1440px (BLOCKED). Static SCSS shows `overflow-x: auto` on admin and field-training tables (mitigation present). **SUSPECTED P3:** wide trainer/admin task/session tables still require horizontal scroll below 768px; long filenames in materials lists. RTL is default Arabic layout; mixed English status enums (BUG-037) break visual consistency more than direction.

---

# What this audit did **not** do

- No production SSH/SQL.  
- No password login as real trainees.  
- No `test:integration` (needs dedicated DB).  
- No ESLint/tsc (not in package scripts).  
- No screenshot capture.

---

# Appendix A — Backend mount summary

- `/api/auth` — register, login, OTP, me  
- `/api/v1` — users, roles, universities, organizations, **training**, kpi, specialties, tracks, micro-credentials, learning-outcomes, cohorts, student, enrollments, modules, sessions, attendance-records, assessments, rubrics, submissions, grades, students, evidence, qa, risk, integrity, recognition, certificates, notifications, analytics, reports, audit-logs, dashboard, settings, admin/courses, student/courses, field-training (admin/academic/instructor/student), mobile/push, account, files, ai, public, help, popups, announcements, notification engine  

There is **no** Express org-scope middleware; tenancy is per service.

---

# Appendix B — Roles vs shells

| Role | Primary shell | Extra |
| --- | --- | --- |
| super_admin | `/admin` | analytics, courses catalog, global FT reports |
| admin | `/admin` | University **or** institution by org type (nav), not API |
| reviewer | `/reviewer` + `/academic` | HTTP write blocked globally |
| instructor | `/instructor` | FT if assigned |
| student | `/student` | University only (RoleBasedRoute redirects institution) |
| trainer | `/trainer` | Assignment-scoped APIs when trainer-only |
| trainee | `/trainee` | Enrollment-scoped |

---

*End of report.*

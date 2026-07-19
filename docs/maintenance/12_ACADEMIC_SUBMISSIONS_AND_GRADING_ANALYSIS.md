# 12 — Academic Submissions and Grading Analysis (ISS-002)

**Date:** 2026-07-18  
**Phase:** Analysis and characterization (historical). **Remediation shipped:** see `13_ACADEMIC_SUBMISSION_AND_GRADING_IMPLEMENTATION.md` — SPA write UI now connected; this document retains the pre-remediation findings for audit.  
**Related:** ISS-002, flow matrix § academic assessment, role matrix academic rows.

---

## Executive conclusion

**Primary classification at analysis time: C — Backend write APIs for academic submissions/grades are implemented; the SPA exposes read-only list/detail UX (plus decorative submit/grade buttons that do not call APIs).**

**Update (remediation):** Classification C for the minimum submit/grade loop is **closed**. Remaining out-of-scope gaps (quiz attempts, returned workflow, binary upload, certificate grade gate) are unchanged.

Supporting classifications:

| Code | Finding |
|------|---------|
| **G** | Academic cohort assessments and **field-training** assessments/submissions are **separate domains**. FT already has SPA write paths. Grouping them as one “incomplete grading” feature overstates SPA incompleteness for FT and understates the academic gap. |
| **D (partial)** | Academic **quiz question / attempt / answer** persistence is **not** implemented (`attempt_status` enum and `submissions.attempt_id` are unused). Simple file/text/repo submission + score/feedback grading **is** Backend-complete. |
| **E** | No in-repo mobile, OpenAPI, Postman, or second frontend consumer found. Endpoints remain callable by any JWT client. |
| **H** | Product-owner must confirm whether academic delivery is intended for this SPA, intentionally read-only, or reserved for a future/external client. |

**Not** classification A/B (not fully accessible for submit/grade), **not** F (not confirmed legacy — APIs are wired, validated, and auth-gated).

---

## 1. Academic domain map (do not merge with field training)

### 1.1 Academic (cohort / micro-credential LMS)

| Concept | Prisma | Status / enum | Create | Read | Update / finalize | Roles | Parent |
|---------|--------|---------------|--------|------|-------------------|-------|--------|
| Assessment | `assessments` | `assessment_status`: draft→published→open→closed→archived; `assessment_type` | `POST /assessments` | `GET /assessments`, `GET /:id` | `PUT /:id`, `PATCH /:id/status` | write: ACADEMIC_WRITE; read: ACADEMIC_READ | `cohorts`, optional `rubrics`, `micro_credentials` |
| Questions / attempts / answers | **None** (quiz fields on assessment only: `max_attempts`, `question_bank_ref`, …) | `attempt_status` enum **unused** | — | — | — | — | — |
| Submission | `submissions` | `submission_status`: draft, submitted, late, resubmitted, graded, returned | `POST /assessments/:id/submissions` | `GET /submissions`, nested list | `PUT /submissions/:id` | student write; academic read | `assessments` |
| Grade + feedback | `grades` (`feedback` string, `is_final`) | no separate grade enum | `POST /assessments/:id/grades` | `GET /grades` | `PUT /grades/:id`, `PATCH /grades/:id/finalize` | ACADEMIC_WRITE | `assessments` + student |
| Rubric | `rubrics`, `rubric_criteria` | string `status` | POST rubric/criteria | GET | PUT/DELETE criteria | ACADEMIC_WRITE | optional link from assessment |
| Certificate eligibility | `certificates` / enrollment flags | **Not** driven by academic grades | certificate issue APIs | verify | revoke | staff | enrollment + MC — **no grade gate** |

### 1.2 Field training (separate)

| Concept | Prisma | SPA writes? |
|---------|--------|-------------|
| Opportunity assessments (pre/post) | `field_training_assessments`, `_questions`, `_attempts` | **Yes** (student submit; admin manage) |
| Task submissions + instructor review | `field_training_task_submissions` | **Yes** (submit, review, AI self-eval) |

### 1.3 Courses (adjacent, not this ISS)

`course_lesson_*` quiz/workflow JSON — separate from `/api/v1/assessments|submissions|grades`.

---

## 2. Backend write endpoint catalog (academic)

Base: `/api/v1`. Auth: JWT + current DB context. Defaults from `env.js`.

| Method | Route | Authz | Service | Writes | FE consumer | Status |
|--------|-------|-------|---------|--------|-------------|--------|
| POST | `/assessments` | ACADEMIC_WRITE | `createAssessment` | assessments row | SPA admin/instructor create | **SPA confirmed** |
| PUT | `/assessments/:id` | ACADEMIC_WRITE | `updateAssessment` | assessments | SPA edit pages | **SPA confirmed** |
| PATCH | `/assessments/:id/status` | ACADEMIC_WRITE | `patchAssessmentStatus` | status (+ optional notification) | SPA view status | **SPA confirmed** |
| POST | `/assessments/:id/submissions` | student | `createForAssessment` | submissions | **None** | **No consumer found** |
| PUT | `/submissions/:id` | student (owner) | `updateSubmission` | submissions | **None** | **No consumer found** |
| POST | `/assessments/:id/grades` | ACADEMIC_WRITE | `createGradeForAssessment` | grades | **None** | **No consumer found** |
| PUT | `/grades/:id` | ACADEMIC_WRITE | `updateGrade` | grades | **None** | **No consumer found** |
| PATCH | `/grades/:id/finalize` | ACADEMIC_WRITE | `finalizeGrade` | `is_final` | **None** | **No consumer found** |
| POST/PUT/DELETE | `/rubrics…`, `/rubric-criteria/:id` | ACADEMIC_WRITE | rubric services | rubrics | Partial SPA (admin rubrics) | SPA for rubric CRUD (separate) |

### Write behavior notes

- Create submission: enrollment required; blocked if final grade exists; auto `late` vs `submitted` from due date.  
- Update submission: owner only; blocked if final grade or status `graded`; forces `resubmitted`.  
- Create grade: requires ≥1 submission; score 0–100; upserts draft/final.  
- Finalize: marks `is_final`, deletes other finals for same assessment+student.  
- No dedicated “publish feedback” or “request revision” endpoints.  
- No AI on academic submissions.  
- File storage: submission accepts **URLs** (`file_url`), not multipart upload on these routes.

### Field-training write APIs (contrast)

Student/instructor/admin FT routers under `/api/v1/.../field-training/...` — SPA **does** POST submit, review, AI self-evaluate. **Not** unused.

---

## 3. Frontend consumer catalog

### Academic writes present

| Consumer | Role | Action | Endpoint |
|----------|------|--------|----------|
| Admin/Instructor assessment create/edit/status pages | SA/UA/AA/INS | CRUD assessment | POST/PUT/PATCH `/assessments` |

### Academic reads present

| Page | Role | Endpoint |
|------|------|----------|
| Admin/Instructor/Student assessments, submissions, grades lists | respective | GET `/assessments`, `/submissions`, `/grades` |
| Dashboards, program detail, schedule | student/instructor | GET lists |
| Evidence / integrity pickers | admin | GET `/assessments` |

### Decorative controls (no API)

| UI | Permission gate | Behavior |
|----|-----------------|----------|
| Student Assessments upload / edit / feedback buttons | `canSubmitAssessments`, `canEditOwnSubmission`, `canViewFeedback` | Buttons render; **no `onClick` handler / navigation / API** |
| Instructor Submissions grade / publish buttons | `canGradeAssessments`, `canPublishFeedback` | Same — **no API** |

### FE services

| File | Methods |
|------|---------|
| `features/submissions/submissions.service.js` | `fetchSubmissionsList`, `fetchSubmissionById` (**GET only**) |
| `features/grades/grades.service.js` | `fetchGradesList`, `fetchMyGrades` (**GET only**) |
| Hooks `useSubmissions` / `useGrades` | Query only — no mutations |

`fetchSubmissionById` has **no page consumer**. Nested `GET /assessments/:id/submissions|grades` unused by SPA (lists use top-level GET).

---

## 4. External / non-SPA consumers

| Candidate | Finding |
|-----------|---------|
| Flutter / mobile app | **Absent** in monorepo |
| Second frontend | **Absent** |
| OpenAPI / Swagger / Postman | **Absent** |
| Webhooks / workers | **Absent** for academic grades |
| Scripts | Seeds may create demo assessments; no dedicated grade writer script found as product client |
| Public docs | Describe RBAC defaults; do not document an external grading client |

**Per write endpoint status:** academic submission/grade writes → **No consumer found** (in-repo). Assessment CRUD → **SPA consumer confirmed**. FT writes → **SPA consumer confirmed**.

Do **not** delete academic write endpoints without PO confirmation — surface remains security-relevant (JWT + role + ownership).

---

## 5. User journeys (current code)

### A. Student (academic)

| Step | Classification |
|------|----------------|
| View assessment list | Fully implemented (SPA GET) |
| Start assessment / quiz attempt | Missing (no attempts model) |
| Save answers | Missing (no answers model) |
| Upload files / submit | **Backend only** (POST exists); SPA button decorative |
| Edit submission | **Backend only** (PUT exists) |
| View submission status | Partially (list status from GET submissions) |
| View grade / feedback | Partially (GET grades; feedback button decorative) |
| Resubmit | **Backend only** (PUT → `resubmitted`) |

### B. Instructor (academic)

| Step | Classification |
|------|----------------|
| Create/edit assessment | Fully implemented |
| View submissions list | Fully implemented (GET) |
| Grade submission | **Backend only**; SPA button decorative |
| Add feedback | **Backend only** (`feedback` on grade body) |
| Finalize / “publish” | **Backend only** (finalize / `is_final`) |
| Request revision / reopen | Missing (no dedicated transition; update blocked after graded/final) |

### C. Academic admin / reviewer

| Step | Classification |
|------|----------------|
| Create assessments, list grades/submissions | Fully implemented (admin SPA) |
| Moderate / dispute / override | Missing as dedicated flow (staff can PUT grades if authorized) |
| Cohort outcomes | Partial via lists/analytics; not grade-workflow specific |

### D. System administrator

| Step | Classification |
|------|----------------|
| Configure assessments | Fully implemented |
| Repair statuses | Backend assessment status + grade PUT; no dedicated repair UI |

### Field training (for contrast)

Student submit tasks / pre-post assessments / AI self-eval and instructor review → **Fully implemented** in SPA + Backend.

---

## 6. Contract comparison (mismatches — not fixed)

| Area | Observation |
|------|-------------|
| FE write types for submissions/grades | **Absent** — no Zod/form schemas for academic submit/grade |
| BE create submission | Requires `submission_type`; optional URL/text fields; **no multipart** |
| BE create grade | `student_id` UUID, `score` 0–100, optional `feedback`, `is_final` |
| SPA list expectations | Expect `{ submissions: [] }` / `{ grades: [] }` — matches BE list unwrap |
| Status UI vs BE | Student page invents display states (`open` vs assessment `status`); may label closed assessment as `graded` without a grade row |
| `attempt_id` / `attempt_status` | Schema only — FE/BE unused |
| Certificate | FE may imply academic completion; BE issue path ignores grades |

---

## 7. State-transition matrices

### Assessment lifecycle

| From | Action | To | Role | Backend | SPA | Reachable |
|------|--------|----|------|---------|-----|-----------|
| (new) | create | draft (typical) | ACADEMIC_WRITE | `createAssessment` | Yes | Yes |
| * | PATCH status | published/open/closed/archived | ACADEMIC_WRITE | `patchAssessmentStatus` | Yes | Yes |
| closed | side effect | may notify ungraded | system | event dispatcher | N/A | Backend |

### Submission lifecycle

| From | Action | To | Role | Backend | SPA | Reachable |
|------|--------|----|------|---------|-----|-----------|
| (none) | POST create | submitted or late | student | `createForAssessment` | **No** | API only |
| submitted/late/draft/resubmitted | PUT update | resubmitted | owner student | `updateSubmission` | **No** | API only |
| * | final grade exists | block create/update | — | service 400 | — | API only |
| graded | PUT | blocked | — | service 400 | — | — |
| returned | — | never set in service paths reviewed | — | — | — | **State never written** (by academic services) |

### Grade lifecycle

| From | Action | To | Role | Backend | SPA | Reachable |
|------|--------|----|------|---------|-----|-----------|
| (none) | POST create | draft (`is_final=false`) or final | ACADEMIC_WRITE | `createGradeForAssessment` | **No** | API only |
| draft | PUT | updated score/feedback/final | ACADEMIC_WRITE | `updateGrade` | **No** | API only |
| draft/any | PATCH finalize | `is_final=true` | ACADEMIC_WRITE | `finalizeGrade` | **No** | API only |

No reopen-after-final path for students.

---

## 8. Security and privacy (code/schema evidence only)

| Topic | Finding |
|-------|---------|
| Student text / URLs | Stored on `submissions` (`text_response`, `file_url`, `repo_url`) |
| Grades / feedback | Stored on `grades` |
| Access | Role allowlists + enrollment/ownership checks in services; uni scope via assessment write helpers |
| Signed URLs | Academic submit takes client-supplied URL strings — not a dedicated upload+sign flow on these routes |
| AI | Academic path: **no** AI provider call. FT self-eval: **yes** (separate) |
| Audit | Generic audit patterns may log staff actions elsewhere; no dedicated “grade published” audit called out in grade finalize |
| Deletion | No academic submission DELETE route |
| Real student content | **Not inspected** this phase |

Write APIs remain a live privileged surface: any authenticated student/staff client can call them even though SPA does not.

---

## 9. Test coverage

| Area | Coverage |
|------|----------|
| Assessment CRUD | Indirect via FE; limited BE unit |
| Submission create/update authz/ownership | **Thin** — `submissions.auth.test.js` only asserts PUT → 401 unauthenticated |
| Grade create/finalize | **No** dedicated unit suite |
| Deadline / duplicate / final-grade lock | Logic in service — **no** characterization unit until ISS-002 suite (validators + route presence + FE GET-only) |
| Cross-university | Via assessment write helpers — not dedicated submission tests |
| Certificate eligibility vs grades | Confirmed uncoupled by service read |
| Field-training | Separate workflow/access/integration tests |
| **New (this phase)** | `authorization.iss002.academicSubmissions.characterization.test.js` (DB-free) |

---

## 10. Confirmed gaps

1. SPA has **no** client methods for academic submission/grade writes.  
2. Student/instructor UI **implies** submit/grade actions without wiring.  
3. Academic quiz attempt/answer model unused.  
4. Submission status `returned` and draft-first create path largely unused by create (create jumps to submitted/late).  
5. Certificate issue does not require grades.  
6. Nested assessment submission/grade GETs unused by SPA.

---

## 11. Unknown requirements (PO)

1. Is academic assessment **delivery** (submit + grade) required for the current SPA release?  
2. Or is the product intentionally **catalog + read-only outcomes**, with FT as the only graded workflow?  
3. Should decorative buttons be hidden until write UI ships?  
4. Is an external client expected to use the write APIs?  
5. Should certificates ever require final academic grades?  
6. Are quiz attempts planned, or should unused schema be documented as reserved?

---

## 12. Recommended next implementation patch (do not implement yet)

**Smallest product-safe options (pick one after PO):**

1. **Enable minimal SPA writes** — wire student submit + instructor grade forms to existing Backend contracts; hide unfinished quiz UX.  
2. **Document intentional read-only academic UX** — remove/hide decorative submit/grade buttons; keep Backend for future/external use.  
3. **Hybrid** — keep APIs; feature-flag write UI; add BE ownership/deadline characterization tests.

**Do not** delete Backend write endpoints in the next patch unless PO + consumer search confirm they will never be used.

---

## Characterization evidence added

- `backend/tests/authorization.iss002.academicSubmissions.characterization.test.js`  
- Wired into `backend/package.json` `test:unit`

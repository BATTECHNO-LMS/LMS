# 13 — Academic Submission and Grading Implementation (ISS-002)

**Date:** 2026-07-18  
**Status:** Implemented (SPA wired to existing Backend write APIs)  
**Related:** ISS-002, `12_ACADEMIC_SUBMISSIONS_AND_GRADING_ANALYSIS.md`

---

## Summary

The academic student submission and instructor grading UIs are connected to the existing Backend APIs. Decorative submit/grade buttons were replaced with routes to working forms. No schema changes, no field-training changes, no quiz attempts, no binary upload storage, no certificate rule changes.

---

## Verified contracts (Phase 1)

Base prefix: `/api/v1`. Auth: JWT + current DB identity.

| Method | Route | Validator | Roles | Notes |
|--------|-------|-----------|-------|-------|
| POST | `/assessments/:id/submissions` | `createSubmissionBodySchema` | `student` | Body: `submission_type` required; optional `file_url`, `repo_url`, `text_response` (strings only). Enrollment required. Status `late` or `submitted` from due date. Blocked if final grade exists. |
| PUT | `/submissions/:id` | `updateSubmissionBodySchema` | `student` (owner) | Same fields optional (≥1). Blocked if final grade or status `graded`. Sets `resubmitted`. |
| POST | `/assessments/:id/grades` | `createGradeBodySchema` | `ACADEMIC_WRITE` | `student_id`, `score` 0–100, optional `feedback` (max 20k), `is_final`. Requires ≥1 submission + enrollment. |
| PUT | `/grades/:id` | `updateGradeBodySchema` | `ACADEMIC_WRITE` | Optional score/feedback/`is_final`. Backend does **not** currently block PUT after finalize. |
| PATCH | `/grades/:id/finalize` | params UUID only | `ACADEMIC_WRITE` | Sets `is_final`; clears other finals for same assessment+student. |

Default `ACADEMIC_WRITE`: `super_admin`, `university_admin`, `academic_admin`, `instructor` (not `student`, `qa_officer`, `university_reviewer`).

University scope: via assessment read/write helpers and cohort scope on lists. Cross-university denied by those helpers. Inactive users denied by central `authenticate`.

---

## Student journey implemented

1. Open `/student/assessments` → Submit / Edit / View feedback links to `/student/assessments/:assessmentId/submit`.
2. Form loads assessment (title, instructions, due date, status) and latest own submission when present.
3. First save → `POST /assessments/:id/submissions` (duplicate POST → 409 `ACADEMIC_SUBMISSION_EXISTS`; see `15_ACADEMIC_SUBMISSION_UNIQUENESS.md`).
4. Edit when Backend allows → `PUT /submissions/:id` (same row; status `resubmitted`).
5. Locked when final grade exists or status is `graded` (read-only; feedback shown if present).
6. Status (`submitted` / `late` / `resubmitted`) comes from Backend response/list.
7. Inputs: submission type, text, file **URL**, repo URL — no binary upload control presented as working.

---

## Instructor journey implemented

1. `/instructor/submissions` → View / Grade / Feedback → `/instructor/submissions/:submissionId/grade`.
2. `/instructor/grades` → Edit / Publish → `/instructor/grades/:gradeId/edit` (same form).
3. Shows submission content when available; score + feedback form.
4. Create → `POST /assessments/:id/grades`; update → `PUT /grades/:id`.
5. Finalize → confirm dialog → `PATCH /grades/:id/finalize`.
6. After finalize, SPA form is read-only; **Backend also rejects ordinary updates with 409 `GRADE_FINALIZED`** (ACADEMIC-GRADE-001 / `14_FINALIZED_GRADE_IMMUTABILITY.md`).

---

## Endpoints connected

- `createAcademicSubmission` → POST assessments/:id/submissions  
- `updateAcademicSubmission` → PUT submissions/:id  
- `createAcademicGrade` → POST assessments/:id/grades  
- `updateAcademicGrade` → PUT grades/:id  
- `finalizeAcademicGrade` → PATCH grades/:id/finalize  

Client: existing `apiClient` (Axios). Errors via `getApiErrorMessage`.

---

## Form fields

**Submission:** `submission_type`, `text_response`, `file_url`, `repo_url`  
**Grade:** `score` (0–100), `feedback`; finalize has no body.

---

## Status and deadline behavior

- Create: Backend sets `submitted` or `late` from `due_date` vs server now.  
- Update: forces `resubmitted`.  
- FE map: `academicStatusMap.js` (academic-only; unknown → safe label, not remapped to another state).  
- No draft-first create; no `returned` workflow wired.

---

## Role behavior

| Role | SPA submit | SPA grade | Backend |
|------|------------|-----------|---------|
| student | Yes (own) | No | POST/PUT submissions only |
| instructor | No | Yes | ACADEMIC_WRITE grades |
| academic_admin / university_admin / super_admin | Admin shell UI may show grade capability | Via write APIs if they use instructor routes / admin tools | ACADEMIC_WRITE |
| qa_officer / university_reviewer | No grade write in default env | No | Not in ACADEMIC_WRITE |

Frontend visibility is not a substitute for Backend authorization.

---

## Frontend files changed (primary)

- `features/submissions/submissions.service.js`, `hooks/useAcademicSubmissionMutations.js`
- `features/grades/grades.service.js`, `hooks/useAcademicGradeMutations.js`
- `features/assessments/academicDeliverySchemas.js`, `academicStatusMap.js`
- `pages/student/StudentAcademicSubmissionPage.jsx`, list pages wired
- `pages/instructor/InstructorAcademicGradePage.jsx`, list pages wired
- `app/router/index.jsx`, `lazyPages.js`
- i18n `assessments.json` / `common.json` (en + ar)
- `tests/academicDelivery.iss002.test.js`

---

## Backend files changed

- Tests only for this remediation:  
  - `tests/authorization.iss002.academicDelivery.remediation.test.js`  
  - Updated characterization expectation (FE now has write clients)  
- **No Backend service/route defects fixed** — existing APIs were usable.

---

## Known unsupported (intentionally out of scope)

- Academic binary/multipart file upload  
- Quiz attempts / answers  
- `returned` / revision workflow  
- Certificate eligibility based on grades  
- Grade moderation / reopen after finalize (SPA)  
- AI grading  
- Field-training changes  

---

## QA data

No production/shared records mutated. Tests are database-free (validators, source contracts, unauthenticated 401). No synthetic persistent QA rows created.

---

## Remaining product questions

1. ~~Should Backend also reject `PUT /grades/:id` after `is_final`?~~ **Done — ACADEMIC-GRADE-001.**
2. ~~Should create-submission reject duplicate rows server-side?~~ **Done — ACADEMIC-SUBMISSION-001** (`assessment_id` + `student_id` unique + 409).
3. Should certificates ever require a final academic grade?
4. Are quiz attempts planned, or remain reserved schema only?
5. Should a separately designed, audited grade-correction operation exist (no ordinary PUT override)?

---

## Rollback

1. Revert FE routes/pages/services/mutations/schemas/status map and list Link wiring.  
2. Revert characterization test FE write assertion if needed.  
3. Remove remediation test file from `test:unit` if rolling back tests.  
No migrations to reverse.

---

## ISS-002 resolution criteria

| Criterion | Met? |
|-----------|------|
| Student academic submission reachable and functional | Yes |
| Instructor academic grading reachable and functional | Yes |
| Decorative submit/grade actions replaced | Yes |
| Role/scope restrictions preserved | Yes (BE unchanged; FE gates aligned) |
| No unsupported workflow falsely presented | Yes (URL field + hints; no quiz/returned/cert gate) |

**ISS-002: Resolved** for the minimal academic submit + grade loop.

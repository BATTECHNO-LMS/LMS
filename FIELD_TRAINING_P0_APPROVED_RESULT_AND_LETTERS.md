# FIELD TRAINING P0 — APPROVED RESULT AND COMPLETION LETTERS

**Product:** BATTECHNO LMS  
**Date:** 2026-09-10  
**Scope:** P0 only. No scoring redesign. No task-workflow rewrite. No destructive migration.

---

## 1. Previous architecture

Official Field Training outputs were assembled from several competing sources:

1. Live `FIXED_COMPONENTS_V1` / legacy qualification (`fieldTraining.qualification`).
2. Persisted `applications.completion_eligibility_status` + `eligibility_reason.details`.
3. Tafila `approvedEvaluationResult` overlay (authoritative for opportunity `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`).
4. Consumer-local overlays (`applyApprovedDisplayToQualification`, card IIFEs, Excel live+overlay).

Completion letters used persisted `completion_eligibility_status` at issue time, but:

- download did not re-check current official eligibility
- eligibility downgrade did not revoke existing issued letters
- `training_status = completed` could coexist with an issued letter for an ineligible student

Known ineligible issued letters (QA BUG-CL-01):

| Student / context | University number | Letter |
|---|---|---|
| ليث محمد أحمد بريوش | 320230601066 | `FT-MTR9S77D` |
| Mutah application `76e405f3-…` | — | `FT-DEMO-99964822` |

---

## 2. Authoritative resolver implemented

New service:

`backend/src/modules/fieldTraining/fieldTraining.officialResult.service.js`

Canonical function:

`resolveFieldTrainingApprovedResult(applicationId)`

Batch:

`resolveFieldTrainingApprovedResults(applicationIds)`

Returned official fields include:

- `applicationId`, `studentId`, `opportunityId`
- `eligibility` (`ELIGIBLE` / `NOT_ELIGIBLE` / existing review-pending outcomes)
- `finalScore`
- `attendancePercentage`, `attendancePoints`
- `postAssessmentScore`, `postPoints`
- `taskPoints`, `behaviorPoints`
- `completedTrainingHours`, `requiredTrainingHours`
- `submittedTaskCount`, `requiredTaskCount` (LMS submission rows only)
- `reasons`, `resultSource`, `approvedAt`

Raw/live values remain on the application and in `calculatedFinalScore` for audit. They are not used as the official result when an approved overlay exists.

---

## 3. Result precedence

1. **Stored `approvedEvaluationResult` overlay** (Tafila primary cohort and any later manual approved result).  
   Official score, eligibility, breakdown, and reasons come from the overlay. Live qualification is not used to replace it.
2. **Opportunities without an overlay** use current Field Training qualification (`calculateForApplication` / persisted qualification).
3. **Task counts** always come from real LMS `field_training_task_submissions` for required tasks. They are never inferred from Excel text, approved score, or activity notes.

The resolver does **not** persist a generic live recalculation of the Tafila cohort.

Second Tafila opportunity `01666ebc-bfc1-4948-87a5-2add3f641c65` is resolved per application and is not merged into the primary cohort.

---

## 4. Consumers migrated to resolver

| Official consumer | File |
|---|---|
| Student / admin detail card | `fieldTraining.service.js` (`listOpportunityEligibility`) |
| Student / admin application progress | `fieldTraining.workflowService.js` |
| Student comprehensive report | `fieldTraining.comprehensiveReport.service.js` |
| Student final report | `fieldTrainingReport.repository.js` (`buildStudentDetailedReport`) |
| University final + comprehensive reports | `fieldTraining.cohortReports.service.js` |
| University applications report | `fieldTrainingReport.repository.js` (`buildUniversityReport`) |
| Excel export | `fieldTrainingStudentsExport.service.js` + `fieldTrainingStudentsExcel.js` |
| Completion-letter issue / classify / download | `fieldTraining.completionLetter.service.js` + `fieldTraining.workflowService.js` |

Existing Tafila `resolveFieldTrainingApprovedResult` now delegates to the official resolver.

---

## 5. Completion-letter gate

Issue (`issueOne`, bulk classify, force regenerate):

- Resolve current official result.
- Allow only `eligibility === ELIGIBLE`.
- Reject `expelled` and `failed` training statuses.
- Keep the existing 140-hour minimum.

Download / preview:

- Resolve current official result **before** serving a PDF.
- If currently not eligible, return `409 COMPLETION_LETTER_NOT_CURRENTLY_VALID`.
- Do not expose storage internals.
- Owner mismatch still returns `403`.

Frontend hiding is not the control. Backend enforcement is mandatory.

---

## 6. Historical-letter invalidation behavior

Schema already had `field_training_completion_letter_status = revoked`. No migration was added.

When eligibility is no longer `ELIGIBLE` (persist qualification, Tafila approved persist, or explicit remediation):

- active `issued` letters are set to `revoked`
- PDF path and letter row are preserved
- `applications.completion_letter_issued_at` is cleared so the letter is no longer the current official artifact
- `training_status` is not changed

---

## 7. Existing affected letters

Before:

| Letter | Application | Eligibility | Training status | Result |
|---|---|---|---|---|
| `FT-MTR9S77D` (Laith) | `c8ca4e24-65f0-4a0e-96e0-6042042c7556` | NOT_ELIGIBLE | completed | revoked |
| `FT-DEMO-99964822` | `76e405f3-a708-411a-9b86-3943434c5f6a` | NOT_ELIGIBLE | post_assessment_pending | revoked |

After: `remainingIssuedForIneligible = 0`.  
PDF files were not deleted.

Artifacts:

- `qa-artifacts/field-training/logs/ineligible-letters-before.json`
- `qa-artifacts/field-training/logs/ineligible-letters-after.json`

---

## 8. Tafila regression

Opportunity: `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`

| Check | Expected | After P0 |
|---|---:|---:|
| Students | 151 | 151 |
| Eligible | 146 | 146 |
| Not eligible | 5 | 5 |
| Eligible below 80 | 0 | 0 |
| Eligible null score | 0 | 0 |
| Score-breakdown mismatches | 0 | 0 |
| Eligibility changes caused by this task | 0 | 0 |

---

## 9. Laith regression

University number `320230601066`

| Field | Expected | After P0 |
|---|---|---|
| Eligibility | NOT_ELIGIBLE | NOT_ELIGIBLE |
| Final score | 59.4 | 59.4 |
| Tasks | 2 / 4 | 2 / 4 |
| Task 1 / Task 2 | 84 / 78 | 84 / 78 (LMS graded rows) |
| Task points | 16.2 / 40 | 16.2 |
| Training status | unchanged | `completed` |
| New completion letter | DENIED | issue gate denies NOT_ELIGIBLE |
| Historical letter | not a current official letter | `revoked`, not downloadable |

---

## 10. Tests

Added:

- `backend/tests/fieldTraining.officialResult.unit.test.js`
- `backend/tests/fieldTraining.completionLetter.eligibilityGate.unit.test.js`

P0 tests: **21 passed**.

Related Field Training unit run: **104 passed / 4 failed**. The 4 failures are pre-existing P3/label-drift cases (cohort source label, students Excel application-status label, Excel column 17, Tafila source enum in an older unit expectation). They are not P0 regressions.

Live browser smoke was not available in this session (no running UI + no browser tool). Backend resolver, cohort report, and letter-row verification were run against the live database.

---

## 11. Remaining P1 / P2 items

**P1**

- Document / reconcile `training_status = completed` with `eligibility = NOT_ELIGIBLE` as a supported state (do not auto-change status).
- Broader scoring-architecture cleanup: stop keeping unused live calculators on official paths (this P0 bounds official output; it does not delete legacy engines).
- Isolated QA database before mutation / stale-recalc browser suites.

**P2**

- Align task “submitted/completed” UI (`taskProgress`) with scoring accepted statuses.
- Super-admin INSTITUTION portal session vs university-only Field Training routes.
- Report terminology polish (Arabic source labels).
- Opportunities API 400 without query params.

---

Suggested commit message:

`fix: unify approved field training result and secure completion letters`

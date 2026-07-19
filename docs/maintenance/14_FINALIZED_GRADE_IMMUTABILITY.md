# 14 — Finalized Academic Grade Immutability (ACADEMIC-GRADE-001)

**Date:** 2026-07-18  
**Status:** Resolved  
**Related:** ISS-002 / `13_ACADEMIC_SUBMISSION_AND_GRADING_IMPLEMENTATION.md`

---

## Previous behavior

After `PATCH /grades/:id/finalize` (or create with `is_final: true`):

- SPA rendered the grade read-only.
- **Backend `PUT /grades/:id` still accepted score/feedback/`is_final` changes** for any `ACADEMIC_WRITE` actor, including `super_admin`.
- **`POST /assessments/:id/grades` with `is_final: true` overwrote an existing finalized grade** (score/feedback) when one already existed.
- Repeated `finalize` could delete the current final row then fail the update (non-idempotent).
- Unused repository helper `setAllNonFinalForPair` could clear `is_final` if called.

## Confirmed gap

Frontend-only immutability was insufficient. Direct API clients could mutate finalized academic grades.

## Finalization field and states

| Item | Value |
|------|--------|
| Field | `grades.is_final` (Boolean) |
| Mutable | `is_final === false` (draft) |
| Immutable | `is_final === true` (finalized) |
| Grade status enum | None — finalization is boolean only |
| Rubric columns on `grades` | None |

## Mutation paths found

| Path | Before | After |
|------|--------|-------|
| `PUT /api/v1/grades/:id` → `updateGrade` | Allowed on finals | **409 `GRADE_FINALIZED`** |
| `POST /api/v1/assessments/:id/grades` overwrite of existing final | Updated final | **409 `GRADE_FINALIZED`** |
| `POST …/grades` create draft / first final | Allowed | Unchanged |
| `PATCH /api/v1/grades/:id/finalize` | Non-idempotent risk | Idempotent return if already final; score validated |
| Analytics/reports Prisma reads | Read-only | Unchanged |
| `grades.repository.setAllNonFinalForPair` | Could clear finals | **Throws 409 `GRADE_FINALIZED`** |
| Field-training evaluation | Separate modules | Unaffected |
| Explicit audited override / moderation API | **None found** | None added |

## Immutability rule

Once `is_final` is true, ordinary academic grade mutation paths must not change score, feedback, final flag, grader metadata via update, or recreate/overwrite content. Guard: `assertGradeMutable` / `assertNoFinalizedGradeOverwrite` in `grades.lifecycle.js`. No role bypass (including `super_admin`) on ordinary endpoints.

## Error contract

```json
{
  "success": false,
  "message": "This grade is finalized and cannot be modified through ordinary update operations",
  "code": "GRADE_FINALIZED"
}
```

HTTP **409 Conflict**.

## Finalization safety

- Missing grade → 404  
- Invalid score → 400 before finalize  
- Already final → return current grade (no write)  
- First finalize → transactional set `is_final` without deleting the row being finalized  
- Scope/auth unchanged (`assertStaffGrader` + assessment write helpers)

## Administrative override

**None exists.** Future corrections require a separately designed, audited operation. Do not use ordinary PUT.

## Frontend

SPA remains read-only for finals. On `409` / `GRADE_FINALIZED`, grade mutations invalidate queries so a stale editable form refreshes to server state. `getApiErrorMessage` surfaces the Backend message.

## Tests

`backend/tests/authorization.academicGrade001.finalizedImmutability.test.js`  
Wired into `backend` `test:unit`. FE delivery suite asserts conflict refresh hook.

## Database impact

None — no migration, no data rewrite, no deletion of historical grades.

## Unsupported

- Unfinalize / reopen  
- Grade moderation  
- Certificate changes  
- Submission uniqueness changes  

## Rollback

1. Revert `grades.lifecycle.js`, service/repository changes, FE mutation `onError` refresh, tests, and this doc set.  
2. No schema rollback needed.

## Resolution

**ACADEMIC-GRADE-001 resolved:** every ordinary academic grade mutation path rejects finalized grades.

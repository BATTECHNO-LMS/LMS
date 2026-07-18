# 15 — Academic Submission Uniqueness (ACADEMIC-SUBMISSION-001)

**Date:** 2026-07-18  
**Status:** Fully resolved  
**Related:** ISS-002 / `13_ACADEMIC_SUBMISSION_AND_GRADING_IMPLEMENTATION.md`

---

## Canonical uniqueness key

**`assessment_id` + `student_id`**

### Why this key

| Alternative | Verdict |
|-------------|---------|
| `assessment_id + student_id` | **Selected.** One assessment is one delivery opportunity for a given student. Enrollment is checked via the assessment’s cohort; submissions have no `enrollment_id` column. Grades also key on `assessment_id + student_id`. |
| `assessment_id + enrollment_id` | Not available — no enrollment FK on `submissions`. |
| `attempt_id` | Optional/unused in academic create path; not the product delivery identity. |

No soft-delete on academic submissions — a full unique index is appropriate.

---

## Read-only duplicate audit (masked aggregates)

Ran against the configured database (read-only aggregates; no PII):

| Metric | Value |
|--------|-------|
| Total academic submissions | **0** |
| Uniqueness groups | **0** |
| Duplicate groups | **0** |
| Rows in duplicate groups | **0** |
| Max rows in one group | **0** |
| Status distribution in duplicates | _(empty)_ |
| Duplicate groups crossing universities | **0** |
| Duplicate groups crossing cohorts | **0** |
| Duplicate groups with any grade | **0** |

**Conclusion:** Safe to add a unique constraint. Historical rows were not deleted or merged (none existed in duplicate form).

Audit script (reusable): `backend/scripts/audit-academic-submission-duplicates.js`

---

## Previous behavior

`POST /assessments/:id/submissions` always inserted a new row. Concurrent or repeated creates could produce multiple submissions for the same student and assessment. SPA reduced double-clicks only.

---

## Application guard

`submissions.lifecycle.js`:

- Before create: `findByAssessmentAndStudent` → `assertNoExistingAcademicSubmission`
- Conflict: **HTTP 409**, code **`ACADEMIC_SUBMISSION_EXISTS`**
- Does not auto-convert create → update
- Does not return submission body content

## Database constraint

- Prisma: `@@unique([assessment_id, student_id], map: "uq_submissions_assessment_student")`
- Migration: `prisma/migrations/20260718120000_academic_submission_uniqueness/migration.sql`
- Index verified present: `uq_submissions_assessment_student`
- Rollback: `DROP INDEX IF EXISTS "uq_submissions_assessment_student";` (documented in migration `ROLLBACK.md`)
- Repository maps Prisma `P2002` → `ACADEMIC_SUBMISSION_EXISTS` (no Prisma details leaked)

## Concurrency

1. App check rejects obvious duplicates.  
2. Unique index rejects races.  
3. Both surface as the same 409 contract.

## Side effects

Create path has no notifications/audit/certificate side effects in the academic submissions service. Rejected creates do not call `repo.create` when the existence check hits.

## Update / resubmission

`PUT /submissions/:id` unchanged: ownership, final-grade lock, `graded` lock, status → `resubmitted` on the **same row**.

## Frontend

On `ACADEMIC_SUBMISSION_EXISTS` only:

- Stop pending (mutation settles)
- Invalidate submission queries
- Safe i18n message
- Form switches to edit when existing row loads
- Form fields preserved until server state refreshes
- No automatic POST retry
- Generic 409 is **not** classified as this conflict

## Tests

- `authorization.academicSubmission001.uniqueness.test.js`
- FE extensions in `academicDelivery.iss002.test.js`

## Historical data

Audit found no duplicates; migration is additive `CREATE UNIQUE INDEX` only. No deletes, merges, or content rewrites.

## Resolution

**ACADEMIC-SUBMISSION-001 fully resolved:** repeated and concurrent creates cannot create duplicate rows; updates continue on the same row; historical data untouched.

## Migration history note (DB-MIGRATION-001)

The unique index was first applied with `prisma db execute` while `migrate deploy` failed with **P3005** (no `_prisma_migrations` baseline). After Strategy C reconciliation (`16_…BASELINE_AUDIT.md`, `17_…RECONCILIATION.md`):

- `20260718120000_academic_submission_uniqueness` is recorded in `_prisma_migrations`.
- Deploy used `CREATE UNIQUE INDEX IF NOT EXISTS` — index was not dropped or rebuilt.
- Future schema changes must go through reviewed `migrate deploy`, not manual `db execute`.

# 49 — Production Migration History Reconciliation (PROD-DRIFT-OPTION-B-001)

**Date:** 2026-07-20  
**Main HEAD (start):** `f48274f`  
**Owner approval:** Explicit Option B; owner later accepted proceeding **without** Neon recovery branch/snapshot  
**Status:** **COMPLETE** — production checksum reconciled; repository and Neon aligned at **28/28**

No credentials or personal data are recorded here.

---

## 1. Approval scope

Approved:

- Canonical replacement `migration.sql` matching live schema  
- Update **only** checksum of existing successful row  
- Do **not** re-run ADD COLUMN on production  
- Do **not** change migration name / timestamps / applied state  
- Do **not** delete data  
- Do **not** create release tag  

**Owner no-backup decision (2026-07-20):** Proceed with checksum-only metadata update without Neon branch/snapshot/PITR, accepting limited rollback risk. Guarded script requires `OWNER_ACCEPTS_NO_RECOVERY_POINT=true` (exact value) in addition to `ALLOW_PRISMA_CHECKSUM_RECONCILE=true`.

---

## 2. Pre-action production snapshot (aggregates)

| Item | Value |
|------|-------|
| Host fingerprint | `82eea2790f` (match) |
| DB-name fingerprint | `693fe5919f` (match) |
| Applied migrations | **28** |
| Target row count | **1** |
| Old checksum (rollback value) | `c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65` |
| finished / not rolled back / steps | yes / yes / 1 |
| Users (pre-write) | **471** |
| Submissions (pre-write) | **0** |
| Field-training opportunities (pre-write) | **3** |
| Opportunities with non-null `required_training_hours` | **0** |
| Column | integer, nullable, no default |

Preconditions: **OK**.

---

## 3. Recovery point

| Item | Result |
|------|--------|
| Neon backup branch | **Not created** — owner explicitly accepted no-recovery path |
| Guard bypass | `OWNER_ACCEPTS_NO_RECOVERY_POINT=true` + `ALLOW_PRISMA_CHECKSUM_RECONCILE=true` |
| Script warning | Printed owner no-recovery acceptance warning |

---

## 4. Canonical migration file

**Path:** `backend/prisma/migrations/20260719120000_field_training_required_hours/migration.sql`

```sql
-- AlterTable
ALTER TABLE "field_training_opportunities"
ADD COLUMN "required_training_hours" INTEGER;
```

| Property | Value |
|----------|-------|
| Encoding | UTF-8, **no BOM** |
| Newlines | **LF only** |
| Final newline | **yes** |
| Bytes | **103** |
| Raw SHA-256 | `411b2fe3ab1cb904fc67e0503d132556a97812bc1705bd6906ec724ac25c91b2` |
| Short | `411b2fe3ab1c` |

ADD COLUMN was **not** executed against production during reconciliation.

---

## 5. Prisma schema (minimal)

Added to `field_training_opportunities` (snake_case convention):

```prisma
required_training_hours Int?
```

No default, index, UI, or validators.

---

## 6. Production checksum update — COMPLETE

**Script:** `backend/scripts/reconcile-field-training-hours-checksum.js`  
**Guards module:** `backend/scripts/lib/reconcileChecksumGuards.js`

| Item | Result |
|------|--------|
| Recovery mode | `owner_no_recovery` |
| Rows updated | **1** (exactly) |
| Old checksum | `c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65` |
| New checksum | `411b2fe3ab1cb904fc67e0503d132556a97812bc1705bd6906ec724ac25c91b2` |
| Only checksum changed | **Yes** — name, timestamps, steps, logs unchanged |
| Migration SQL executed on prod | **No** |
| Schema objects modified | **No** |
| Business data modified | **No** |

---

## 7. Post-write production verification

| Check | Result |
|-------|--------|
| `prisma migrate status` | **28 migrations**, database schema up to date |
| `prisma:check-history` | **28** applied, **0** pending, **0** failed |
| `prisma validate` | **Pass** |
| Repo migration folders | **28** |
| Checksum matches local file | **Yes** |
| Column | integer, nullable, no default, no index |
| Users / submissions / FT opps (post-write) | **471** / **0** / **3** (unchanged) |

---

## 8. Empty-database proof (disposable local Postgres)

| Step | Result |
|------|--------|
| Baseline v1 validate | **ok** — 27 represented; cutoff `20260718120000_academic_submission_uniqueness` |
| Pending after cutoff | `20260719120000_field_training_required_hours` |
| `db:init-empty` + deploy | **28/28**, up to date |
| `required_training_hours` | integer, nullable, no default |
| `uq_submissions_assessment_student` | present |
| Integration | **8 pass / 0 fail** |

Baseline v1 was **not** regenerated; cutoff **not** moved.

---

## 9. Automated tests

| Suite | Result |
|-------|--------|
| Backend unit (incl. guard tests) | **333 pass** |
| Frontend unit | **42 pass** |
| Frontend build | **Pass** |
| Prisma validate | **Pass** |
| Baseline validate | **Pass** |
| Integration (local disposable Postgres) | **8 pass** |
| Test database guard | **Pass** (included in unit suite) |

---

## 10. Application feature gap (follow-up)

Schema now knows the field. Still absent (by design for this task):

- Opportunity create/update validators  
- Service/repository write paths  
- Admin/instructor FE forms  
- Student detail display  
- Reports / completion calculations  

---

## 11. Rollback procedure

If checksum must be reverted to the pre-reconciliation value:

1. Set environment (owner operation, production host only):

```powershell
cd backend
$env:ALLOW_PRISMA_CHECKSUM_RECONCILE="true"
$env:OWNER_ACCEPTS_NO_RECOVERY_POINT="true"
```

2. Temporarily swap `OLD` / expected-new constants in the script to reverse direction, **or** run an equivalent guarded transaction requiring:
   - `migration_name = '20260719120000_field_training_required_hours'`
   - current checksum = `411b2fe3ab1cb904fc67e0503d132556a97812bc1705bd6906ec724ac25c91b2`
   - set checksum back to `c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65`
   - exactly **1** row updated; all other fields unchanged.

3. Do **not** drop the column or re-run migration SQL unless a separate approved migration is planned.

---

## 12. Remaining release blockers (outside Option B)

- JWT sync (`eec7827fb0` fingerprint)  
- FE live bundle ≠ `main` rebuild  
- Academic production write smoke (0 assessments)  
- QA-AUTH-001 / QA-AUTH-003 (accepted temporarily)

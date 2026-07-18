# 42 — Production Database Verification (PROD-ENV-ACTIVATION-001)

**Date:** 2026-07-18  
**Mode:** Read-only verification against owner-approved Neon `DATABASE_URL`  
**No migrate deploy / db push / reset / seeds against Neon in this task.**

Secrets, hostnames, and personal data are omitted. Fingerprints only.

---

## Connectivity

| Check | Result |
|-------|--------|
| PostgreSQL connect | **Success** |
| Provider | Neon (remote, pooled-likely) |
| Host fingerprint | `82eea2790f` |
| Database-name fingerprint | `693fe5919f` |
| Same fingerprints as ENV-PREFLIGHT-001 | **Yes** (approved URL unchanged since preflight) |
| Local Backend `/health/ready` | `db: true` |

---

## Migration history

| Metric | Value |
|--------|------:|
| Repo migrations | 27 |
| History table | Present |
| Applied (finished, not rolled back) | **26** |
| Pending | **1** |
| Failed | **0** |

### Pending migration (not applied this task)

| Name | Review |
|------|--------|
| `20260718120000_academic_submission_uniqueness` | **Expected** · additive · `CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_assessment_student ON submissions (assessment_id, student_id)` · no row deletes |

`npm run prisma:check-history` exits with pending warning (by design) until deploy.

**Do not** mark this database 27/27 until after a reviewed `prisma migrate deploy`.

---

## Schema (read-only)

| Check | Result |
|-------|--------|
| Public tables | 61 |
| Enums (public) | 53 |
| Core tables present | users, roles, universities, specialties, cohorts, assessments, submissions, grades, FT tables, OTP tables, files, audit_logs |
| `grades.is_final` / score / feedback | Present |
| `uq_submissions_assessment_student` | **Absent** (created by pending migration) |
| Prisma validate | Pass |

### Aggregate counts (no PII)

| Entity | Count |
|--------|------:|
| users | 423 |
| roles | 8 |
| universities | 6 |
| cohorts | 0 |
| assessments | 0 |
| submissions | 0 |
| grades | 0 |
| field_training_opportunities | 1 |

**Classification:** Populated production-like database (not empty). Academic submission uniqueness index not yet on this DB.

---

## Alignment vs previous Neon session

Earlier maintenance work verified a **different** Neon host fingerprint (`490f81350f`) at 27/27.  
This approved database is **distinct** (`82eea2790f`) and currently **26/27** with the uniqueness migration pending.

---

## Required next DB step (manual / separate task)

1. Confirm Neon backup / restore point.  
2. Re-read pending SQL (above).  
3. `cd backend && npx prisma migrate deploy`  
4. Re-run `npm run prisma:check-history` → expect 27/27, 0 pending.  
5. Confirm index `uq_submissions_assessment_student` exists (`npm run db:verify-schema`).

# 42 — Production Database Verification (PROD-ENV-ACTIVATION-001)

**Date:** 2026-07-18 (updated PROD-PREDEPLOY-001)  
**Mode:** Initially read-only; **pending uniqueness migration applied** in PROD-PREDEPLOY-001 via `prisma migrate deploy` only.  
**No migrate reset / db push / seeds against Neon.**

Secrets, hostnames, and personal data are omitted. Fingerprints only.

---

## Connectivity

| Check | Result |
|-------|--------|
| PostgreSQL connect | **Success** |
| Provider | Neon (remote, pooled-likely) |
| Host fingerprint | `82eea2790f` |
| Database-name fingerprint | `693fe5919f` |
| Production API `/health/ready` | 200 after migration |

---

## Migration history

| Metric | Activation (before predeploy) | After PROD-PREDEPLOY-001 |
|--------|------------------------------:|-------------------------:|
| Repo migrations | 27 | 27 |
| Applied | **26** | **27** |
| Pending | **1** | **0** |
| Failed | 0 | 0 |

### Applied in predeploy

| Name | Result |
|------|--------|
| `20260718120000_academic_submission_uniqueness` | Applied successfully |

Pre-migration duplicate groups: **0**. Users preserved: **423**. Submissions: **0**.

---

## Schema

| Check | Result |
|-------|--------|
| `uq_submissions_assessment_student` | **Present**, UNIQUE, columns `(assessment_id, student_id)` |
| `grades.is_final` / score / feedback | Present |
| Core tables | Present (see activation report) |

---

## Next DB notes

No further pending migrations. Future schema changes require normal reviewed `migrate deploy` only.

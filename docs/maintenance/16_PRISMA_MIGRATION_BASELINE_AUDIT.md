# 16 — Prisma Migration Baseline Audit (DB-MIGRATION-001)

**Date:** 2026-07-18  
**Database classification:** Shared Neon (`neondb`) — treated as production-like; **no reset / no data deletion**  
**Related:** P3005 on `prisma migrate deploy`; ACADEMIC-SUBMISSION-001 manual index apply

---

## 1. P3005 root cause

| Finding | Value |
|---------|--------|
| `_prisma_migrations` exists? | **No** |
| History row count | **0** |
| Public tables present | **48** |
| Repo migrations | **27** |
| Prisma considered applied | **none** |
| Prisma considered pending | **all 27** |
| Failed migration rows | **n/a** (table absent) |
| Checksum mismatches | **n/a** |

**Exact reason:** The live database already contains a full application schema, but has **never been baselined** into Prisma migration history (`_prisma_migrations` missing). `prisma migrate deploy` therefore refuses to start applying the migration directory against a non-empty database (P3005 / “schema is not empty”), rather than replaying CREATE statements that would collide with existing objects.

**How the DB likely got here:** Core schema predates (or was applied outside) this migration directory — consistent with `db push` / manual SQL / imported baseline. The repo migrations are mostly **incremental** (first folder is `attendance_records`, not a full init). The academic uniqueness index was later applied via `prisma db execute` without recording history.

---

## 2. Academic uniqueness verification

| Check | Result |
|-------|--------|
| Index name | `uq_submissions_assessment_student` |
| Unique | **yes** |
| Columns (order) | `assessment_id`, `student_id` |
| Matches migration + `schema.prisma` | **yes** |
| Competing duplicate unique index | none observed |

---

## 3. Migration-to-schema evidence summary

Scripts: `scripts/audit-prisma-migration-history.js`, `scripts/audit-migration-schema-matrix.js`, `scripts/audit-suspect-schema-objects.js`

### Fully represented in live schema (safe to mark applied)

| Migration | Confidence |
|-----------|------------|
| `20260413120000_attendance_records` | high |
| `20260413140000_assessments_table` | high |
| `20260413180000_certificates_audit_logs` | high |
| `20260414120000_notifications_user_created_index` | high |
| `20260416140000_user_activation_pending_flow` | high |
| `20260416160000_notification_type_action_required` | high |
| `20260416170000_assessment_quiz_delivery_fields` | high |
| `20260504150000_enrollment_status_rejected` | high |
| `20260505120000_enrollment_workflow_and_notifications` | high |
| `20260521120000_lesson_training_workflow` | high |
| `20260718120000_academic_submission_uniqueness` | high (index live) |

### Not fully represented (must NOT mark applied until SQL is executed)

Live Neon is **missing** substantial objects that later migrations introduce, including for example:

- Tables: `specialties`, `university_specialties`, `email_verification_otps`, `password_reset_otps`, `files`, `field_training_opportunity_eligibility`, `field_training_sessions`, `field_training_attendance`, `field_training_assessments`, `field_training_assessment_questions`, `field_training_assessment_attempts`, `field_training_completion_letters`
- Columns such as: `field_training_opportunities.university_id`, `users.email_verified_at`, FT AI/instruction columns, etc.
- Related indexes / FKs / enums from those migrations

| Migration | Gap class |
|-----------|-----------|
| `20260630120000_field_training_university` | missing column + index + FK |
| `20260705120000_specialties_field_training` | missing table + columns + indexes |
| `20260705150000_specialties_global` | depends on specialties |
| `20260705180000_email_verification_otp` | missing table + column |
| `20260706140000_field_training_app_opportunity_index` | missing index |
| `20260706160000_field_training_workflow_phase1` | missing 6 tables + enums + indexes |
| `20260706180000_field_training_workflow_phase2` | missing columns |
| `20260707120000_files_storage` | missing `files` table |
| `20260707130000_password_reset_otps` | missing table |
| `20260709120000_university_specific_specialties` | missing table + column |
| `20260709140000_field_training_opportunity_eligibility` | missing table |
| `20260709150000_field_training_eligibility_safe_backfill` | DML only — **must run after** eligibility table exists (do not mark applied early) |
| `20260709160000_performance_indexes_and_query_cleanup` | missing indexes |
| `20260709170000_field_training_task_instruction_files_ai_audit` | missing columns |
| `20260711140000_field_training_assessment_question_builder` | missing columns |
| `20260711180000_field_training_ai_content_sources` | missing column (+ nullability ALTERs) |

---

## 4. Drift categories

| Code | Finding |
|------|---------|
| **B** | Live matches early migration effects, but history table missing |
| **D** | Migrations (Jun–Jul FT/auth/files/specialties) expect objects **absent** from live Neon |
| **A** | Academic uniqueness index matches Prisma + migration |
| **C** | Not the primary issue (no large “extra” unmanaged surface beyond normal) |
| **F** | `specialties_global` contains DELETE/DROP COLUMN — safe only when run in order on empty/new `specialties` (not on unknown populated specialties). Live has **no** `specialties` table today. |
| **G** | Empty-DB reproducibility of full schema from this migration directory alone (no init migration for `users`/core) |

**Critical product implication:** Shared Neon is **behind** `schema.prisma` for field-training phase-2+, specialties, OTP, and files. Marking those migrations applied without executing SQL would **falsely** claim schema readiness.

---

## 5. Strategy selection (see doc 17)

**Strategy C — Mixed reconciliation** (selected).

Rejected:

- **A alone** — would hide missing FT/auth schema.
- **B new baseline squash** — unnecessary given incremental migrations are still valid; squash would obscure history.

---

## 6. Data preservation

- Audit was read-only.
- No TRUNCATE / DROP DATABASE / migrate reset.
- No deletion of academic submission rows (count unchanged by audit).
- Upcoming deploy must remain additive; `specialties_global` DELETE only affects rows in `specialties` after that table is created by the prior migration (expected empty at first create on this DB).

---

## 7. Post-repair update (same day)

Reconciliation completed per `17_PRISMA_MIGRATION_RECONCILIATION.md`:

- 10 early migrations → `migrate resolve --applied`
- 17 later migrations → `migrate deploy` (including academic uniqueness `IF NOT EXISTS`)
- `prisma migrate status` → **Database schema is up to date!**
- Row counts unchanged (users 170, FT opportunities 4, submissions 0)
- Unique index still present

### Residual drift after deploy (Category E — naming only)

`prisma migrate diff` (live DB → `schema.prisma`, review file `docs/maintenance/_migrate_diff_live_to_schema.sql`) proposes only two `RENAME CONSTRAINT` statements on `field_training_opportunity_eligibility` FK names (Postgres 63-char truncation vs Prisma preferred names). **Not executed.** No table/column/index/data mismatch for product behavior.

### Empty-DB replay

Local Docker/Postgres was unavailable during DB-MIGRATION-001; **DB-MIGRATION-002** closed the gap with `prisma/baselines/empty_init.sql` + `npm run db:init-empty` (see `18_EMPTY_DATABASE_REPRODUCIBILITY.md`). Incremental migrations alone still fail on empty DBs by design; bootstrap is required first. Neon remains untouched by the baseline path.

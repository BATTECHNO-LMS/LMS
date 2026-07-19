# 17 — Prisma Migration History Reconciliation (DB-MIGRATION-001)

**Date:** 2026-07-18  
**Operator:** maintenance agent (Cursor)  
**Database classification:** Shared Neon (`neondb`) — production-like  
**Related audit:** `16_PRISMA_MIGRATION_BASELINE_AUDIT.md`

---

## Strategy selected: C — Mixed reconciliation

### Why safest

1. Early migrations’ effects were already present → safe to record via `migrate resolve --applied` (no SQL re-run).
2. Later FT/auth/files/specialties migrations’ effects were **missing** → must **execute** SQL via `migrate deploy`, not fake-apply.
3. Academic uniqueness index already existed → deploy used `CREATE UNIQUE INDEX IF NOT EXISTS` (no drop/recreate).
4. Avoids squash/baseline rewrite of the migration directory.

### Rejected alternatives

| Strategy | Why rejected |
|----------|----------------|
| **A** — Mark all 27 applied | Would claim FT/OTP/files schema exists when it did not |
| **B** — New baseline squash | History still usable; squash hides incremental review trail |
| Blind `db push` / reset | Forbidden; data risk |

### Risks accepted

- `specialties_global` contains DELETE of duplicate specialty codes + DROP COLUMN `university_id`. On this DB, `specialties` was created empty in the same deploy chain → DELETE affected **0** rows.
- Nullability `DROP NOT NULL` on FT submission file columns (additive nullability, not row delete).
- Empty-database reproducibility of **core** tables remains a separate gap (migrations are incremental; no full init migration).

### Rollback limitations

- `_prisma_migrations` rows were **added**, not deleted.
- Applied DDL (new tables/columns/indexes) is not auto-reversed.
- To undo schema additions would require reviewed reverse SQL per object — **not** `migrate reset`.
- Academic unique index was already live; deploy did not change it.

---

## Before repair

| Item | Value |
|------|--------|
| `_prisma_migrations` | **absent** |
| History rows | **0** |
| Pending (Prisma view) | all **27** |
| `prisma migrate deploy` | **P3005** (non-empty DB, no baseline) |
| Users / FT opportunities / submissions | 170 / 4 / 0 |
| Unique index | present (`uq_submissions_assessment_student`) |

---

## Commands executed

### Phase A — Mark fully present historical migrations applied (chronological)

Logged in `docs/maintenance/_resolve_log.txt` (timestamps local).

```
npx prisma migrate resolve --applied 20260413120000_attendance_records
npx prisma migrate resolve --applied 20260413140000_assessments_table
npx prisma migrate resolve --applied 20260413180000_certificates_audit_logs
npx prisma migrate resolve --applied 20260414120000_notifications_user_created_index
npx prisma migrate resolve --applied 20260416140000_user_activation_pending_flow
npx prisma migrate resolve --applied 20260416160000_notification_type_action_required
npx prisma migrate resolve --applied 20260416170000_assessment_quiz_delivery_fields
npx prisma migrate resolve --applied 20260504150000_enrollment_status_rejected
npx prisma migrate resolve --applied 20260505120000_enrollment_workflow_and_notifications
npx prisma migrate resolve --applied 20260521120000_lesson_training_workflow
```

**Result:** all 10 succeeded. Status then showed **17** pending (Jun–Jul + academic uniqueness).

### Phase B — Reviewed `prisma migrate deploy`

Pending set inspected (additive CREATE/ALTER; specialties DELETE only on empty new table). Then:

```
npx prisma migrate deploy
```

**Result:** 17 migrations applied successfully, including `20260718120000_academic_submission_uniqueness` via `IF NOT EXISTS`.

### Repository file change

- Added missing `backend/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).

---

## After repair

| Item | Value |
|------|--------|
| History rows | **27** |
| Failed rows | **none** |
| `prisma migrate status` | **Database schema is up to date!** |
| Users / FT opportunities / submissions | **170 / 4 / 0** (unchanged) |
| Unique index | **still present**, same definition |
| Tables deleted | **none** |

### Migrations marked applied only (no SQL)

10 early migrations listed above.

### Migrations genuinely executed

17 migrations from `20260630120000_field_training_university` through `20260718120000_academic_submission_uniqueness`.

### Academic uniqueness history

- Recorded in `_prisma_migrations` as applied by deploy.
- Index not dropped or rebuilt; `IF NOT EXISTS` no-oped.

---

## Future production deployment procedure

1. Confirm backup / Neon restore point.
2. `npx prisma migrate status`
3. Review **every** pending migration name + SQL (no blind deploy).
4. `npx prisma migrate deploy`
5. Post-deploy: status clean; spot-check critical indexes/tables; app smoke test.
6. **Never** fall back to `prisma db push`, casual `db execute`, `migrate reset`, or destructive seeds on shared/prod.

If `_prisma_migrations` is missing or history is inconsistent, stop and run the audit scripts — do **not** auto-resolve unknown migrations.

Helper: `npm run prisma:check-history` (`scripts/check-migration-history.js`).

---

## Empty-database replay

- **DB-MIGRATION-001:** Local Docker unavailable; risk documented.
- **DB-MIGRATION-002:** Resolved via external baseline (`prisma/baselines/empty_init.sql`) + guarded `db:init-empty`. See `18_EMPTY_DATABASE_REPRODUCIBILITY.md`.
- Bare `migrate deploy` on empty still fails at migration 1 (expected); init then deploy succeeds.
- Neon history was **not** modified for empty-DB support.

## Residual naming drift (not applied)

Review SQL at `docs/maintenance/_migrate_diff_live_to_schema.sql` — two FK renames only. Left unapplied intentionally (Category E).

---

## Data-preservation confirmation

- No `migrate reset`, `db push`, DROP DATABASE/SCHEMA, TRUNCATE.
- No deletion of user/submission/grade rows observed (counts stable).
- No rewriting of academic submission content.

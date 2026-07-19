# 18 — Empty Database Reproducibility (DB-MIGRATION-002)

**Date:** 2026-07-18  
**Status:** Resolved (hardened by **DB-MIGRATION-003** — see `19_VERSIONED_EMPTY_DATABASE_BASELINE.md`)  
**Related:** `16_PRISMA_MIGRATION_BASELINE_AUDIT.md`, `17_PRISMA_MIGRATION_RECONCILIATION.md`

---

## Why the migration directory was incomplete

Repository migrations begin at `20260413120000_attendance_records` and are **incremental overlays**. No migration creates core tables such as `users`, `sessions`, `cohorts`, `universities`, or most domain enums (e.g. `attendance_status`).

**Proven empty-DB failure:**

```
prisma migrate deploy  →  P3018 / SQLSTATE 42704
type "attendance_status" does not exist
(on migration 20260413120000_attendance_records)
```

Git history contains no earlier init migration. Neon was originally built outside this migration directory (likely `db push` / manual SQL), then reconciled in DB-MIGRATION-001.

---

## Strategy selected: C — Reviewed bootstrap baseline + incremental history

| Path | Behavior |
|------|----------|
| **Existing Neon** | Unchanged. Baseline SQL is **not** in `prisma/migrations/`. No `_prisma_migrations` writes. No deploy of bootstrap. |
| **New empty DB** | `npm run db:init-empty` applies `empty_init_v1.sql`, then marks **only** migrations listed in `empty_init_v1.manifest.json` as applied. Post-cutoff migrations stay pending for `migrate deploy`. |
| **Future migrations** | Normal `prisma migrate deploy` on both Neon and empty-built DBs. |

### How Prisma distinguishes environments

- Neon: already has `_prisma_migrations` with 27 applied rows → `db:init-empty` **refuses**.
- Empty: no public tables, no history → init allowed with `ALLOW_EMPTY_DB_INIT=true`.
- Baseline is **outside** `prisma/migrations/`, so Neon never sees a pending “init” migration.

### Rejected alternatives

| Strategy | Why rejected |
|----------|----------------|
| A — Restore original migrations | Not present in Git |
| B — Add baseline **inside** `prisma/migrations/` | Would show pending on Neon; forbidden without Neon history changes |
| Full-schema migration squash replacing history | Breaks Neon checksum/history compatibility |

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run db:validate-baseline` | Fail-closed manifest/SQL/migration checksum check |
| `npm run db:generate-baseline` | Explicit regeneration (`ALLOW_BASELINE_REGENERATION=true` + version + cutoff) |
| `npm run db:init-empty` | Guarded empty-DB bootstrap + resolve **manifest** migrations only |
| `npm run db:verify-schema` | Key tables/enums/unique index check |
| `npm run db:prove-empty-migrate-fails` | Assert bare `migrate deploy` fails without baseline |
| `npm run db:prove-baseline-cutoff` | Synthetic post-cutoff migration proof |
| `npm run prisma:status` | `prisma migrate status` |
| `npm run prisma:check-history` | History consistency |
| `npm run prisma:deploy` | Apply **new** pending migrations only |
| `npm run seed:catalog` | Idempotent roles/universities/specialties (no demo users) |

### `db:init-empty` guards

- Requires `ALLOW_EMPTY_DB_INIT=true`
- Refuses Neon hosts (`*.neon.tech`, etc.) always
- Refuses other remotes unless `ALLOW_EMPTY_DB_INIT_REMOTE=true`
- Refuses any public application tables
- Refuses existing `_prisma_migrations`
- Prints host classification **without** credentials
- Never drops/resets a database

---

## Disposable replay (verified locally)

| Step | Result |
|------|--------|
| Empty DB `lms_empty_replay` | 0 public tables |
| Bare `migrate deploy` | Fail — missing `attendance_status` |
| `db:init-empty` | Exit 0 |
| `prisma:deploy` | No pending migrations |
| `prisma:status` | Database schema is up to date! |
| `db:verify-schema` | ok; `uq_submissions_assessment_student` present |
| Diff vs `schema.prisma` | Empty migration (functionally identical) — `_empty_db_schema_equivalence.sql` |
| Integration tests on disposable Postgres | 8 pass / 0 fail |

Neon was **not** used for init/replay and was **not** modified.

---

## Schema equivalence

| Compare | Class |
|---------|-------|
| Empty-built ↔ `schema.prisma` | **A** Functionally identical |
| Empty-built ↔ Neon | **A** functional; known Neon **B** FK name truncations remain cosmetic (unchanged; not “fixed” on Neon) |

---

## Seed policy

| Seed | Use on empty init? |
|------|---------------------|
| `seed:catalog` / `seed:real-baseline` | Optional catalog only (roles, universities, specialties) |
| `seed` (Prisma default) | Same catalog path |
| `seed:test-accounts` | CI/test only — known test users |
| `seed:demo` / `seed:analytics-demo` | **Never** automatic; never on Neon/prod |
| `cleanup:demo` | Destructive — test only |

`db:init-empty` does **not** seed.

---

## CI

Job `backend-empty-db-reproducibility`:

1. Ephemeral Postgres  
2. Prove bare migrate fails  
3. `db:init-empty` on disposable DBs  
4. `migrate deploy` + `status` + `db:verify-schema`  
5. Catalog + test-account seeds on TEST DB  
6. Integration tests with isolated `TEST_DATABASE_URL`  

No Neon secrets. Unit tests remain a separate job.

---

## Disaster recovery

1. Create a **new empty** PostgreSQL database (provider console).  
2. `ALLOW_EMPTY_DB_INIT=true DATABASE_URL=<new> npm run db:init-empty`  
3. `npm run prisma:deploy` (applies any migrations newer than the baseline snapshot).  
4. Restore **data** from provider backup / sanitized dump **after** schema init (schema-first).  
5. `npm run db:verify-schema` + app smoke tests.  
6. Switch traffic only after validation.

Do **not** restore a backup onto a DB and then re-run `db:init-empty` (init refuses non-empty).

---

## Rollback limitations

- Bootstrap SQL is additive for empty DBs only; it cannot “undo” Neon.  
- Regenerating `empty_init.sql` does not change Neon.  
- Do not copy baseline SQL into `prisma/migrations/` without a Neon compatibility plan.  
- After new product migrations: run migrate on Neon, then `db:generate-baseline` so empty init stays current.

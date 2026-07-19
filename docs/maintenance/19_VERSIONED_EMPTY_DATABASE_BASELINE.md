# 19 — Versioned Empty-Database Baseline (DB-MIGRATION-003)

**Date:** 2026-07-18  
**Status:** Resolved  
**Related:** `18_EMPTY_DATABASE_REPRODUCIBILITY.md`

---

## Problem

DB-MIGRATION-002’s `db:init-empty` selected migrations by **scanning every directory** under `prisma/migrations/` and marking all as applied. A future migration added after the baseline SQL was generated could be recorded as applied **without executing its SQL**.

## Current baseline

| Field | Value |
|-------|--------|
| Version | **v1** |
| SQL | `prisma/baselines/empty_init_v1.sql` |
| Manifest | `prisma/baselines/empty_init_v1.manifest.json` |
| First migration | `20260413120000_attendance_records` |
| Cutoff (last) | `20260718120000_academic_submission_uniqueness` |
| Represented | **27** migrations |
| Neon impact | **None** (baseline outside `prisma/migrations/`) |

## Why only manifest migrations are resolved

The manifest is an immutable allow-list with SHA-256 checksums for:

- Baseline SQL
- Each represented `migration.sql`
- `schema.prisma` at generation time (warn on init if drifted; optional strict fail)

`db:init-empty` calls `migrationsToResolveFromManifest()` only. It never builds a resolve list from `readdir` of the migrations folder.

## How later migrations deploy

1. Empty DB → `db:init-empty` (resolves 1…cutoff).  
2. `prisma migrate deploy` (inside init, and/or explicitly) executes **only pending** migrations after the cutoff.  
3. No baseline regeneration required for ordinary incremental migrations.

## Checksum policy

| Check | On `db:validate-baseline` / `db:init-empty` |
|-------|-----------------------------------------------|
| SQL checksum | **Fail** |
| Represented migration checksums | **Fail** |
| Order / duplicates / missing / unknown-before-cutoff | **Fail** |
| Schema checksum | **Warn** by default (schema may advance with pending migrations). Set `BASELINE_REQUIRE_SCHEMA_MATCH=true` to fail. |

Changed historical migration files require human review — scripts never auto-update checksums.

## Regeneration policy

```bash
ALLOW_BASELINE_REGENERATION=true \
BASELINE_VERSION=v2 \
BASELINE_CUTOFF=<migration_folder_name> \
npm run db:generate-baseline
```

- Refuses without `ALLOW_BASELINE_REGENERATION=true`
- Refuses overwrite of an existing version unless `FORCE_BASELINE_OVERWRITE=true`
- Writes `empty_init_<version>.sql` + `.manifest.json`
- Does not modify Neon

Activate with `EMPTY_DB_BASELINE_VERSION=v2`.

## Procedures

### Existing Neon / populated DB

1. `npm run prisma:check-history`  
2. `npm run prisma:status`  
3. Review pending SQL  
4. `npm run prisma:deploy`  

Never `db:init-empty`.

### Brand-new empty database

1. `npm run db:validate-baseline`  
2. `ALLOW_EMPTY_DB_INIT=true DATABASE_URL=<empty> npm run db:init-empty`  
3. `npm run prisma:deploy` (usually already run inside init)  
4. `npm run db:verify-schema`  
5. Optional: `npm run seed:catalog`

### CI protection

Job `backend-empty-db-reproducibility`:

- Manifest validation  
- Empty init + exact **27** applied count  
- Synthetic post-cutoff fixture (`db:prove-baseline-cutoff`)  
- Integration tests  

Fails on stale SQL, changed represented migrations, inconsistent manifest, or falsely resolving post-cutoff migrations.

## Failure recovery

| Symptom | Action |
|---------|--------|
| SQL/migration checksum mismatch | Restore files from VCS or regenerate a **new** baseline version after review |
| Unknown migration before cutoff | Add it to a new baseline version or remove accidental folder |
| Init refused (non-empty / Neon) | Use a new empty disposable database |
| Pending after init | Expected for post-cutoff migrations — run `prisma migrate deploy` |

## Rollback limitations

- Manifest/SQL changes do not roll back Neon.  
- Deleting v1 without a replacement breaks empty init.  
- Do not rewrite applied historical migration SQL to “fix” checksums without review.  
- Synthetic cutoff fixture must never remain in `prisma/migrations/`.

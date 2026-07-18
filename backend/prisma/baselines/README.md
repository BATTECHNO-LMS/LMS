# Empty-database baselines (DB-MIGRATION-002 / 003)

## Active baseline

| Field | Value |
|-------|--------|
| Version | **v1** |
| SQL | `empty_init_v1.sql` |
| Manifest | `empty_init_v1.manifest.json` |
| Cutoff | `20260718120000_academic_submission_uniqueness` |
| Represented migrations | **27** |

Activate via `EMPTY_DB_BASELINE_VERSION=v1` (default).

## Rules

- Apply **only** via `npm run db:init-empty` (guards refuse Neon and non-empty databases).
- Resolve **only** migrations listed in the manifest — never every directory under `prisma/migrations/`.
- Migrations after the cutoff stay pending for `prisma migrate deploy`.
- Do **not** place baseline SQL into `prisma/migrations/`.
- Never includes application data, users, passwords, or production dumps.

## Commands

```bash
npm run db:validate-baseline
ALLOW_EMPTY_DB_INIT=true DATABASE_URL=<empty> npm run db:init-empty
```

## Regeneration (reviewed, explicit)

```bash
ALLOW_BASELINE_REGENERATION=true \
BASELINE_VERSION=v2 \
BASELINE_CUTOFF=<last_migration_name> \
npm run db:generate-baseline
```

Overwriting an existing version also requires `FORCE_BASELINE_OVERWRITE=true`.
Does not modify Neon.

See `docs/maintenance/19_VERSIONED_EMPTY_DATABASE_BASELINE.md`.

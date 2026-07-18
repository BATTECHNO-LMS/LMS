# 01 — Test & Command Safety Matrix

**Updated:** ISS-011 (database-test / CI safety hardening)

## Policy

- Classify **before** execute.
- Neon/cloud `DATABASE_URL` ⇒ never use for writes; integration tests must use `TEST_DATABASE_URL`.
- Integration tests are **fail-closed** via `tests/helpers/testDatabaseGuard.js`.
- No external provider calls in unit tests.
- Do not install dependencies until lifecycle scripts inspected (`postinstall` = `prisma generate` only — codegen, no DB).

---

## Backend test commands (after ISS-011)

| Script | Before | After | Safe without isolated TEST DB? |
|--------|--------|-------|--------------------------------|
| `test` | `node --test tests/*.test.js` (all files, including DB writers) | `npm run test:unit` | **Yes** |
| `test:unit` | — | Explicit unit file list (includes `testDatabaseGuard.test.js` + `analytics.trends.test.js`) | **Yes** |
| `test:integration` | — | `--require ./tests/helpers/requireIntegrationDb.js` + FT integration + landingStats | **No** — fails closed without guard env |
| `test:all` | — | `test:unit` then `test:integration` | Unit yes; integration needs guard |

### Required env for `test:integration`

| Variable | Requirement |
|----------|-------------|
| `NODE_ENV` | Exactly `test` |
| `TEST_DATABASE_URL` | Explicit postgres URL, **≠** `DATABASE_URL` after normalization |
| `ALLOW_TEST_DB_WRITES` | Exactly `true` |
| `ALLOW_REMOTE_TEST_DATABASE` | Required **only** if TEST host is not localhost/127.0.0.1/::1 |
| `DATABASE_URL` | App URL (distinct); preload then points Prisma at `TEST_DATABASE_URL` |

Do **not** set `ALLOW_REMOTE_TEST_DATABASE` for shared Neon used as the app database.

### Local integration setup

1. Create a **local** Postgres database dedicated to tests (e.g. `lms_test`).
2. Keep app `DATABASE_URL` pointing at a **different** database (even if same host).
3. Export:
   - `NODE_ENV=test`
   - `TEST_DATABASE_URL=postgresql://.../lms_test`
   - `ALLOW_TEST_DB_WRITES=true`
4. `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`
5. Optionally seed on test DB only: `DATABASE_URL="$TEST_DATABASE_URL" npm run seed:real-baseline` and `seed:test-accounts`
6. `npm run test:integration`

### CI integration setup

See `.github/workflows/ci.yml` job `backend-integration`: ephemeral Postgres service, two local DBs (`lms_ci_app` vs `lms_ci_test`), migrate/seed against `TEST_DATABASE_URL` only, then `npm run test:integration`. No production Neon secrets.

### Remote test database policy

Remote TEST hosts are **rejected by default**. Only with `ALLOW_REMOTE_TEST_DATABASE=true` **and** isolation from `DATABASE_URL` **and** `ALLOW_TEST_DB_WRITES=true`. Never use the application Neon URL as `TEST_DATABASE_URL`.

---

## Backend `package.json` other scripts

| Script | Classification | Safe to run (shared Neon)? |
|--------|----------------|----------------------------|
| `postinstall` / `prisma:generate` | Static / codegen | Yes |
| `prisma:validate` | Static | Yes |
| `start` / `dev` | Runtime | N/A for tests |
| `prisma:migrate` / `deploy` / `studio` | Migration / write UI | **No** on shared Neon for experiments |
| `seed*` / `cleanup:demo` / `merge:specialties` | Seed / destructive | **No** on shared Neon |
| `r2:*` | External | **No** unless intentional |

## Frontend scripts

| Script | Safe? |
|--------|-------|
| `build` | Yes |
| `dev` / `preview` | Dev only |

---

## Backend tests — per file

| File | Category | Writes DB? | Guard? | In `test:unit`? | In `test:integration`? |
|------|----------|------------|--------|-----------------|------------------------|
| `testDatabaseGuard.test.js` | Pure unit | No | N/A (tests the guard) | Yes | No |
| `emailOtp`, `passwordResetToken`, `universityScope`, `universityEmailLink`, `youtubePlaylist`, `fieldTraining.workflow`, `fieldTraining.access`, `specialties.service` | Pure unit | No | — | Yes | No |
| `analytics.trends.test.js` | Pure unit (broken helper) | No | — | Yes (**2 known failures**, ISS-004) | No |
| `health`, `fieldTraining.auth`, `submissions.auth` | HTTP 401 / health | No queries | — | Yes | No |
| `landingStats.test.js` | Integration | Yes (visit counter) | **Yes** (first-line require) | No | Yes |
| `fieldTraining.integration.test.js` | Integration | Yes (create/delete) | **Yes** | No | Yes |
| `helpers/fieldTrainingIntegration.js` | Helper | Yes if used | Requires guard flag | — | Used by integration |

### Known unrelated failure

`analytics.trends.test.js`: `repo.computePreviousPeriodFilters is not a function` — **ISS-004**, not fixed in ISS-011. Still run in `test:unit` so failures remain visible.

### Commands intentionally not executed on shared Neon

- `npm run test:integration`
- `npm run test:all` (when integration would hit Neon)
- Full historical `node --test tests/*.test.js` without guard

---

## Guard proof points

- Guard module has **no** `@prisma/client` / `config/db` imports.
- Unit tests use **synthetic** URLs only.
- Integration preload sets `DATABASE_URL` to approved `TEST_DATABASE_URL` only after checks.
- Helper throws if imported without guard.

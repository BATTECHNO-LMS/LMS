# 01 — Test & Command Safety Matrix

## Policy

- Classify **before** execute.
- Neon/cloud `DATABASE_URL` ⇒ no write/read-integration tests.
- No external provider calls.
- Do not install dependencies until lifecycle scripts inspected (`postinstall` = `prisma generate` only — codegen, no DB).

---

## Backend `package.json` scripts

| Script | Classification | Safe to run (this env)? | Notes |
|--------|----------------|-------------------------|-------|
| `postinstall` / `prisma:generate` | Static / codegen | Yes | No DB connection |
| `prisma:validate` (via `npx prisma validate`) | Static and safe | **Yes — ran** | Schema only |
| `start` / `dev` | Runtime (uses live DB/env) | Not for verification writes | Serves API against configured DB |
| `prisma:migrate` | Migration | **No** | Writes schema to target DB |
| `prisma:deploy` | Migration | **No** | Applies migrations |
| `prisma:studio` | Database write (interactive) | **No** | UI can mutate data |
| `seed` / `seed:real-baseline` | Seed | **No** | Upserts catalog/roles |
| `seed:demo` / `seed:analytics-demo` / `seed:auth` / `seed:test-accounts` | Seed | **No** | Demo/test users; some refuse `NODE_ENV=production` |
| `cleanup:demo` | Cleanup / destructive (if confirmed) | **No** | Dry-run reads; `--confirm-clean-demo` deletes |
| `merge:specialties` | Database write | **No** | Reassigns specialty refs |
| `test` | Mixed (includes DB write) | **No (full suite)** | See per-file table |
| `r2:health` | External network | **No** | Hits R2 if configured |
| `r2:setup-cors` | External network + write | **No** | Mutates bucket CORS |

## Frontend `package.json` scripts

| Script | Classification | Safe? | Notes |
|--------|----------------|-------|-------|
| `build` | Build-only and safe | **Yes — ran** | No DB |
| `dev` | Runtime | N/A for baseline | Dev server |
| `preview` | Build preview | Safe after build | Serves `dist` |

---

## Backend tests — per file

| File | Feature | Pure / integration | Imports `app`? | Needs DB? | Reads DB? | Writes DB? | External? | Safe on Neon? | Ran? |
|------|---------|--------------------|----------------|-----------|-----------|------------|-----------|---------------|------|
| `emailOtp.test.js` | Email OTP utils | Pure unit | No | No | No | No | No | **Yes** | Yes — pass |
| `passwordResetToken.test.js` | Reset token utils | Pure unit | No | No | No | No | No | **Yes** | Yes — pass |
| `universityScope.test.js` | University scope helpers | Pure unit | No | No | No | No | No | **Yes** | Yes — pass |
| `universityEmailLink.test.js` | Email domain utils | Pure unit | No | No | No | No | No | **Yes** | Yes — pass |
| `youtubePlaylist.test.js` | Playlist ID parse | Pure unit | No | No | No | No | No (parse only) | **Yes** | Yes — pass |
| `fieldTraining.workflow.test.js` | FT workflow pure logic | Pure unit | No | No | No | No | No | **Yes** | Yes — pass |
| `fieldTraining.access.test.js` | FT access/mapping | Pure unit | No | Client may load; **no queries** | No | No | No | **Yes** | Yes — pass |
| `specialties.service.test.js` | Specialty assert | Pure unit | No | Early throw; no query | No | No | No | **Yes** | Yes — pass |
| `analytics.trends.test.js` | Analytics period helpers | Pure unit (intended) | No | No queries | No | No | No | **Yes** | Yes — **2 fail** |
| `health.test.js` | `/`, `/health`, CORS | HTTP (no DB routes) | Yes | No for tested paths | No | No | No | **Yes** | Yes — pass |
| `fieldTraining.auth.test.js` | FT routes 401 | HTTP auth | Yes | No on 401 | No | No | No | **Yes** | Yes — pass |
| `submissions.auth.test.js` | submissions/dashboard/roles/analytics 401 | HTTP auth | Yes | No on 401 | No | No | No | **Yes** | Yes — pass |
| `landingStats.test.js` | Public landing stats | Integration | Yes | **Yes** | **Yes** | **Yes** (visit counter upsert) | No | **No** | **Skipped** |
| `fieldTraining.integration.test.js` | Full FT workflow | Integration | Yes | **Yes** | **Yes** | **Yes** (create/delete fixtures) | AI mocked | **No** | **Skipped** |
| `helpers/fieldTrainingIntegration.js` | Fixtures/helpers | Helper (not a test entry) | — | Yes | Yes | Yes | — | **No if executed** | Not run |

### Existing failure (safe suite)

| Test | Error | Classification |
|------|-------|----------------|
| `analytics.trends.test.js` → `computePreviousPeriodFilters` | `repo.computePreviousPeriodFilters is not a function` | Test/implementation drift — **not repaired this phase** |

### Safe command used

```text
node --test tests/emailOtp.test.js tests/passwordResetToken.test.js tests/universityScope.test.js tests/universityEmailLink.test.js tests/youtubePlaylist.test.js tests/fieldTraining.workflow.test.js tests/fieldTraining.access.test.js tests/specialties.service.test.js tests/analytics.trends.test.js tests/health.test.js tests/fieldTraining.auth.test.js tests/submissions.auth.test.js
```

| Result | Exit |
|--------|------|
| 55 tests, 53 pass, 2 fail | `1` |

Reproducible: yes (failure is deterministic missing export).

---

## Required mocks / isolated DB (when later allowed)

| Suite | Requirement |
|-------|-------------|
| Pure unit / 401 HTTP | None |
| `landingStats.test.js` | Isolated test database (writes `system_settings`) |
| `fieldTraining.integration.test.js` | Isolated test DB + migrated schema; AI already mocked |

---

## Commands classified as Unknown / High risk (not run)

| Command | Risk |
|---------|------|
| Full `npm test` | Runs DB writers against whatever `DATABASE_URL` is |
| Any seed/cleanup/migrate | Database write |
| R2 scripts | External mutation/network |

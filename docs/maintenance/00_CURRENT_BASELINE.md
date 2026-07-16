# 00 — Current Baseline

**Phase:** maintenance baseline & verification (read-only for application code)  
**Date:** 2026-07-16  
**Source map:** `docs/project-analysis/` (verified, not trusted blindly)

## Git

| Item | Value |
|------|-------|
| Branch | `main` (tracks `origin/main`) |
| Commit | `e8048c6e0b8025c0f3bbf6d6865f51d5b227bd88` |
| Working tree | **Not clean** |
| Dirty / untracked (non-secret) | `M backend/package-lock.json`, `M frontend/package-lock.json`, `?? docs/project-analysis/`, `?? docs/project-analysis.zip` |

No secret values recorded from `.env`.

## Runtime tooling

| Tool | Version observed |
|------|------------------|
| Node | `v22.20.0` (local) |
| npm | `10.9.3` |
| CI Node (workflow) | `20` |

**Note:** Local Node 22 vs CI Node 20 — potential environment drift (Weak inference for build differences).

## Packages

| Package | Name | package.json version | Notes |
|---------|------|---------------------|-------|
| Backend | `battechno-lms-api` | `0.1.0` | |
| Frontend | `battechno-lms-web` | `0.1.0` | |
| Express | dependency | `^4.22.1` | |
| `@prisma/client` / `prisma` (declared) | | `^6.0.0` | |
| Prisma installed (node_modules) | | `6.19.3` | |
| React | | `^18.3.1` | |
| Vite | | `^5.4.21` | |

## Lockfiles

| Path | Present |
|------|---------|
| `backend/package-lock.json` | Yes (modified vs HEAD) |
| `frontend/package-lock.json` | Yes (modified vs HEAD) |

## Entry points

| Layer | Entry |
|-------|--------|
| Backend process | `backend/src/server.js` (`npm start` / `npm run dev`) |
| Express app | `backend/src/app.js` |
| Frontend SPA | `frontend/src/main.jsx` → `App.jsx` → `AppRouter` |
| Auth API mount | `/api/auth` |
| Versioned API | `/api/v1` (default `API_VERSION`) |

## Available npm scripts (summary)

See [01_TEST_SAFETY_MATRIX.md](./01_TEST_SAFETY_MATRIX.md) for full risk classification.

**Backend:** `postinstall`, `start`, `dev`, `prisma:*`, `seed*`, `cleanup:demo`, `merge:specialties`, `test`, `r2:*`  
**Frontend:** `dev`, `build`, `preview`

## CI checks (`.github/workflows/ci.yml`)

| Job | Steps |
|-----|--------|
| `backend` | `npm ci` → `npm test` → `npx prisma validate` |
| `frontend` | `npm ci` → `npm run build` |

Triggers: push/PR to `main`, `master`, `develop`.

**CI risk note:** `npm test` runs **all** `tests/*.test.js`, including DB-writing suites. Against a cloud `DATABASE_URL` this is unsafe. CI typically uses ephemeral secrets; local Neon must not be assumed “test”.

## Database target classification (no secrets)

| Check | Result |
|-------|--------|
| `DATABASE_URL` set in `backend/.env` | Yes |
| Host class (hostname pattern only) | **neon-cloud** |
| Treated as | **Potentially production / shared cloud — immutable for this phase** |
| DB-dependent tests | **Not executed** |

`NODE_ENV` key is present; its value is not recorded. **`NODE_ENV=test` alone does not make Neon safe.**

## Safe checks completed this phase

| Command | Exit | Result |
|---------|-----:|--------|
| `npx prisma validate` (cwd `backend`) | 0 | Schema valid; Prisma update notice 6.19.3 → 7.x (warning only) |
| Selective `node --test` (12 safe files; see matrix) | 1 | **53 pass, 2 fail** (`analytics.trends.test.js`) |
| `npm run build` (cwd `frontend`) | 0 | Build succeeded; chunk size warnings (>500 kB) |

## Explicitly not run

- `npm test` (full suite)
- Any `prisma migrate` / `deploy` / `studio`
- Any `seed*` / `cleanup:demo` / `merge:specialties`
- `r2:health` / `r2:setup-cors`
- `npm ci` / `npm install`
- Live calls to Resend, R2, AI, YouTube APIs

## Documentation produced this phase

All under `docs/maintenance/` (this file + 01–06).

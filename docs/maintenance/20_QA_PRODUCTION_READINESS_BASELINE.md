# 20 — QA Production-Readiness Baseline (QA-001)

**Date:** 2026-07-18  
**Phase:** Verification / documentation (no redesign)  
**Branch:** `maintenance/test-safety-baseline`  
**Pre-hygiene commit:** `0505b7783ffc6049d17d39596bc009aea1d5387f`  
**Working tree:** **Clean** after QA-REL-001 (see `30_RELEASE_CANDIDATE_HYGIENE.md`).

---

## Environment

| Item | Value |
|------|--------|
| Node | v22.20.0 |
| npm | 10.9.3 |
| Prisma CLI / Client | 6.19.3 |
| OS | Windows 10 |
| App DATABASE_URL (Neon) | Shared / production-like — **read-only for QA history checks** |
| Disposable QA Postgres | Local PostgreSQL 16 (`lms_qa_*`) — additive/integration only |

---

## Migration / baseline

| Check | Result |
|-------|--------|
| `prisma validate` | Pass |
| `prisma:check-history` (Neon) | 27/27 applied, 0 pending, 0 failed |
| `db:validate-baseline` | v1 OK; cutoff `20260718120000_academic_submission_uniqueness`; 27 represented |
| Empty-DB init (local) | Used for integration prep (see Phase 14) |

---

## Automated test totals (this run)

| Suite | Result |
|-------|--------|
| Backend unit (`npm run test:unit`) | **312 pass / 0 fail** |
| Test DB guard | **16 pass** (included in unit suite) |
| Frontend unit (`npm run test:unit`) | **42 pass / 0 fail** |
| Frontend production build | **Pass** (chunk-size warnings) |
| Backend integration | See final report (local ephemeral Postgres) |

### Build warnings (not hidden)

- Vite: several chunks > 500 kB (`index`, `recharts`, analytics route).
- No TypeScript compile errors observed in build.

---

## Active roles (runtime)

`super_admin`, `university_admin`, `academic_admin`, `qa_officer`, `instructor`, `student`, `university_reviewer`

**Deprecated:** `program_admin` — not assignable; no runtime access; historical rows preserved.

---

## Security baseline (already shipped)

- Non-global cannot assign/control `super_admin`
- Protected requests rebuild auth from current DB
- Inactive users rejected centrally
- Stale JWT role / university / `isGlobal` do not authorize
- `program_admin` grants no runtime access

---

## Academic / FT / DB baseline (already shipped)

- Academic submit/grade SPA wired (ISS-002)
- Finalized grades immutable (ACADEMIC-GRADE-001)
- One submission per assessment+student (ACADEMIC-SUBMISSION-001)
- Field training is a separate workflow
- Neon migrations reconciled; empty DB uses baseline v1

---

## Inventory summary

| Area | Approx. count / note |
|------|----------------------|
| SPA route shells | `/admin`, `/instructor`, `/student`, `/academic`, `/reviewer` + auth/public |
| BE mount prefixes | `/api/auth` + ~40 `/api/v1/*` routers |
| FE API service modules | ~36 `*.service.js` |
| Prisma models | Full LMS + FT + courses (see `schema.prisma`) |

Detailed matrices: `21_MASTER_QA_MATRIX.md` onward.

---

## Test environment classification

| Class | Use in QA-001 |
|-------|----------------|
| Ephemeral / local Postgres | Integration, empty init, synthetic FT |
| `TEST_DATABASE_URL` isolation | Required for integration guard |
| Shared Neon | History/status **read-only**; no truncate/reset/destructive seeds |
| External services | Mocked / unset (`AI_PROVIDER`, `RESEND_API_KEY` empty in tests) |

---

## Explicit gaps in this baseline document

- Full browser E2E across all roles was **not** executed in a staging SPA session in this phase.
- Manual matrix cells marked **Pending staging** require human click-through with synthetic accounts.
- Working tree is dirty; pin a release commit before production cutover.

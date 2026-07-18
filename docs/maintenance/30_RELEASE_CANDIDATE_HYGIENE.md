# 30 — Release Candidate Hygiene (QA-REL-001)

**Date:** 2026-07-18  
**Branch:** `maintenance/test-safety-baseline`  
**Status:** **Resolved** — intended maintenance work committed; working tree clean for staging smoke.

---

## Objective

Produce a clean, reviewable release-candidate branch after completed security, database, academic workflow, migration, and QA work. No production tag. No push unless explicitly requested.

---

## Initial working-tree state (before hygiene)

| Item | Value |
|------|--------|
| HEAD (pre-hygiene) | `0505b7783ffc6049d17d39596bc009aea1d5387f` |
| Dirty tracked files | ~85 modified |
| Untracked intended | Baselines, migrations, auth/academic/DB scripts, tests, docs 07–29 |
| Verdict blocker | **QA-REL-001** — uncommitted release hygiene |

### Excluded (not committed)

| Path | Reason |
|------|--------|
| `docs/project-analysis.zip` | Generated archive |
| `docs/maintenance/_empty_db_schema_equivalence.sql` | Temporary SQL diff |
| `docs/maintenance/_migrate_diff_live_to_schema.sql` | Temporary SQL diff |
| `docs/maintenance/_tmp_migrate_diff_live_to_schema.sql` | Temporary SQL diff |
| `docs/maintenance/_resolve_log.txt` | Local ops log |
| `backend/.env` / `frontend/.env` | Secrets / environment-specific (gitignored) |

Local exclude entries added under `.git/info/exclude` for the zip and `_*.sql` / `_resolve_log.txt` artifacts.

---

## Secret scan

| Category | Result |
|----------|--------|
| Live credentials / API keys / private keys | **None found** in staged/committed paths |
| Env *names* / schema column names (`password_hash`, OTP tables) | Present in docs/SQL schema — structure only |
| Baseline SQL | Schema-only; no data rows, no credentials, no environment grants |
| `.env` files | Not staged |

---

## Lockfile decision

| Lockfile | Decision |
|----------|----------|
| `backend/package-lock.json` | **No intentional change** — not modified for this RC |
| `frontend/package-lock.json` | **No intentional change** — not modified for this RC |
| `backend/package.json` / `frontend/package.json` | Script-only changes (test splits, Prisma/DB tooling) — **kept**; no dependency adds/upgrades |

---

## Commit plan used

1. **Auth / identity / program_admin retirement** — privileged identity lifecycle, runtime role freeze, related tests and docs 07–10  
2. **Academic delivery + integrity** — SPA submit/grade wiring, finalized-grade immutability, submission uniqueness migration/schema, related tests and docs 12–15  
3. **Database governance** — empty baseline v1, migration history guards, CI, ops docs 16–19 + DATABASE/DEPLOYMENT  
4. **QA / release hygiene** — production-readiness docs 20–30, backlog/report updates marking QA-REL-001 resolved  

---

## Release candidate identity

| Field | Value |
|-------|--------|
| Branch | `maintenance/test-safety-baseline` |
| Pre-hygiene HEAD | `0505b7783ffc6049d17d39596bc009aea1d5387f` |
| `fix(auth): …` | `b26953abd97590092dbba8ab74683a74d3df2c34` |
| `feat(academic): …` | `acecb63a178352debbda1164ac534083479100e6` |
| `fix(db): …` | `774bbdae3bcdcfbcbe1a8757f62718a398d3b281` |
| `test(qa): …` | `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3` |
| Final HEAD (RC) | `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3` |
| Baseline version | `empty_init_v1` |
| Manifest cutoff | `20260718120000_academic_submission_uniqueness` |
| Migrations represented | **27** |
| Neon history (read-only) | **27/27** applied, 0 pending, 0 failed |
| Production tag | **Not created** |
| Push | **Not performed** |

---

## Validation summary (post-commit)

| Check | Expected / recorded |
|-------|---------------------|
| Backend `npm run test:unit` | Pass |
| Frontend `npm run test:unit` | Pass |
| Frontend `npm run build` | Pass |
| `npm run db:validate-baseline` | Pass (v1) |
| `npm run prisma:check-history` (Neon, read-only) | 27/27 |
| `npx prisma validate` | Pass |
| Integration (disposable Postgres) | Run if local Postgres available; otherwise rely on CI |

---

## Remaining staging blockers (not QA-REL-001)

1. **QA-STG-001** — Provision isolated staging FE/API/DB + `$STAGING_*` credentials (see `31_STAGING_SMOKE_REPORT.md`).  
2. Re-run seven-role browser smoke (docs 32–34).  
3. Product decisions on JWT revoke at logout / password reset (**QA-AUTH-001/003**) after staging evidence.  
4. Explicit GO only after staging smoke passes.

---

## Staging smoke inputs (next task — no deploy yet)

### URLs (placeholders)

| Item | Placeholder / env |
|------|-------------------|
| Staging frontend URL | `$STAGING_FRONTEND_URL` |
| Staging API URL | `$STAGING_API_URL` |

### Synthetic accounts (roles only — no passwords in docs)

| Role | Account plan |
|------|----------------|
| super_admin | Staging seed / `seed:test-accounts` catalog entry |
| university_admin | Same catalog, QA university scope |
| academic_admin | Same |
| qa_officer | Same |
| instructor | Same |
| student | Same |
| university_reviewer | Same |

Credentials: store only in staging secret store / `$STAGING_*_PASSWORD` env vars — **never commit**.

### QA identifiers

| Item | Placeholder |
|------|-------------|
| QA university id | `$STAGING_QA_UNIVERSITY_ID` |
| QA cohort / specialty ids | `$STAGING_QA_COHORT_ID` / specialty from seed catalog |

### Feature flags / integrations

| Item | Expectation |
|------|-------------|
| External email (Resend) | Sandbox / disabled — no real student mail |
| AI (OpenAI/Gemini) | Mock or unset |
| R2 / file storage | Staging bucket or local stub |
| Rate limits | Staging-safe values documented in env |

### Browser / viewport matrix

| Desktop | Mobile |
|---------|--------|
| Chromium latest | 390×844 |
| Firefox latest | 360×800 |
| Safari / WebKit if available | 414×896 |

### Migration / health

| Step | Command / check |
|------|-----------------|
| Expected migrate | `npm run prisma:deploy` against **staging** DB only |
| History check | `npm run prisma:check-history` (read-only) |
| Health | `GET $STAGING_API_URL/health` (and any existing readiness route) |
| Rollback commit | Previous RC HEAD (record at deploy time) |

### Recommended next task

**QA-STAGING-SMOKE-001** — Attempted 2026-07-18: **NO-GO / staging pending**. Preflight passed on exact RC `1cfe2f4`; deploy and browser smoke **blocked** by missing `$STAGING_*` URLs and credentials (see `31_STAGING_SMOKE_REPORT.md`). Provision isolated staging, then re-run smoke.

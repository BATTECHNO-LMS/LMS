# 31 — Staging Smoke Report (QA-STAGING-SMOKE-001)

**Date / time (local):** 2026-07-18 ~16:00 UTC+3  
**Branch:** `maintenance/test-safety-baseline`  
**Required RC commit:** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3`  
**Verified local HEAD:** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3` (**match**)  
**Working tree at preflight:** Clean  

**Final verdict for this task:** **NO-GO** (staging smoke **not executed** — missing isolated staging environment inputs)

---

## Executive summary

Phases 1–2 preflight completed successfully against the exact release candidate. **Phases 3–15 browser/deploy smoke did not run** because no staging frontend URL, staging API URL, staging credentials, or deploy permissions were available in the environment or repository secret store.

Documented production hostnames (`lms.battechno.com`, Render API) were **not** used. Local `DATABASE_URL` resolves to a **Neon shared/prod-like** host and is **not** classified as isolated staging. Deploying or writing smoke data there would violate hard safety rules.

Automated readiness from QA-001 / QA-REL-001 remains unchanged; it does **not** substitute for browser staging smoke.

---

## 1. Staging deployment result

| Item | Result |
|------|--------|
| Staging deploy attempted | **No** |
| Reason | Missing `$STAGING_FRONTEND_URL`, `$STAGING_API_URL`, deploy CLI/permissions, and synthetic account secrets |
| Production deploy | **Not performed** |
| Production tag | **Not created** |
| Merge to `main` | **Not performed** |

## 2. Exact deployed commit

| Context | Commit |
|---------|--------|
| Required | `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3` |
| Local HEAD verified | Same |
| Deployed to staging | **N/A — not deployed** |

## 3. Frontend and API URLs tested

| URL | Value |
|-----|-------|
| Staging frontend | **Missing** — expected `$STAGING_FRONTEND_URL` |
| Staging API | **Missing** — expected `$STAGING_API_URL` |
| Browser sessions | **None** |

## 4. Database migration result (staging)

**Not run.** No staging database connection was provided. Neon was only considered for read-only history checks historically; during this preflight Neon connectivity failed once (`Can't reach database server`). No migrate deploy was attempted against Neon or any other shared DB.

## 5–7. Seven-role / academic / FT smoke

| Suite | Result |
|-------|--------|
| Seven-role browser matrix | **Skipped** — no staging |
| Academic happy path (browser) | **Skipped** |
| Field-training happy path (browser) | **Skipped** |

Automated evidence only (not staging): BE unit 312, FE unit 42, integration 8 on disposable local Postgres.

## 8. Browser and viewport coverage

| Item | Result |
|------|--------|
| Chromium / Firefox / WebKit | **Not run** |
| Viewports 360–1440 | **Not run** |
| Playwright / Cypress in repo | **Absent** — no E2E framework installed; none added (lockfile policy) |

## 9. Console / network / server findings

None from staging (no session). Preflight local tooling only.

## 10. P0 findings (this task)

| ID | Summary |
|----|---------|
| **QA-STG-001** | No isolated staging frontend/API/database/credentials — blocks all browser smoke and any safe deploy |

## 11. P1 findings

| ID | Summary | Notes |
|----|---------|-------|
| **QA-AUTH-001** | Logout does not revoke JWT | Still open; JWT risk decision **not** accepted via staging evidence |
| **QA-AUTH-003** | Password reset leaves access JWTs valid | Still open |
| **QA-STG-002** | Neon shared DB unreachable during this preflight history check | Ops/network; does not unblock staging |

## 12. P2/P3 summary

Prior QA pack items unchanged (QA-ROLE-001, QA-NAV-001, QA-FT-001, etc.). No new P2/P3 from browser smoke.

## 13. JWT logout/reset decision

**No staging verification performed.** Release decision remains:

> **Block production cutover pending** either (a) explicit product acceptance of residual JWT validity after logout/reset **with** signed staging evidence, or (b) implementation of revocation.

Do **not** mark QA-AUTH-001 / QA-AUTH-003 resolved.

## 14. Environment-hardening result

See `35_STAGING_ENVIRONMENT_REVIEW.md`. Staging config **unknown**. Local/.env and documented production URLs are **not** staging.

## 15. Fixes applied

**None.** No application behavior changes. No CSS. No dependency adds.

## 16. Remaining blockers (exact missing inputs)

Provide via secret store / CI vars (values never commit to git):

1. `$STAGING_FRONTEND_URL` — hostname must clearly indicate staging  
2. `$STAGING_API_URL` — hostname must clearly indicate staging  
3. Staging PostgreSQL (isolated) + migrate permissions  
4. `$STAGING_SUPER_ADMIN_EMAIL` / `$STAGING_SUPER_ADMIN_PASSWORD`  
5. `$STAGING_UNIVERSITY_ADMIN_EMAIL` / `$STAGING_UNIVERSITY_ADMIN_PASSWORD`  
6. `$STAGING_ACADEMIC_ADMIN_EMAIL` / `$STAGING_ACADEMIC_ADMIN_PASSWORD`  
7. `$STAGING_QA_OFFICER_EMAIL` / `$STAGING_QA_OFFICER_PASSWORD`  
8. `$STAGING_INSTRUCTOR_EMAIL` / `$STAGING_INSTRUCTOR_PASSWORD`  
9. `$STAGING_STUDENT_EMAIL` / `$STAGING_STUDENT_PASSWORD`  
10. `$STAGING_UNIVERSITY_REVIEWER_EMAIL` / `$STAGING_UNIVERSITY_REVIEWER_PASSWORD`  
11. `$STAGING_QA_UNIVERSITY_ID` / `$STAGING_QA_COHORT_ID` (or seed plan)  
12. Deploy platform access for RC commit only (Render/Vercel/etc. **staging** services)  
13. Confirm email/AI/storage sandboxed on that staging stack  

## 17. Verdict

### **NO-GO**

Criteria failed: staging not deployed; seven-role / academic / FT browser smoke not executed; environment not classified as staging; JWT risks not staging-verified.

Automated RC quality remains strong; it does not clear this gate.

## 18. Recommended next action

1. Provision isolated staging FE + API + DB (not Neon shared prod-like; not `lms.battechno.com`).  
2. Seed seven synthetic accounts; set the env vars above in a secret store.  
3. Redeploy **exactly** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3` (or a later approved RC if hygiene moves).  
4. Re-run **QA-STAGING-SMOKE-001** with browser matrix; then revise this report.

---

## Phase 2 preflight record (completed)

| Check | Command / evidence | Result |
|-------|-------------------|--------|
| Branch | `git branch --show-current` | `maintenance/test-safety-baseline` |
| HEAD | `git rev-parse HEAD` | `1cfe2f4…` exact match |
| Clean tree | `git status --short` | Empty |
| Untracked source/migrations | `git ls-files --others --exclude-standard` | None |
| Staged `.env` | `git diff --cached` | None |
| Lockfile drift | `git diff **/package-lock.json` | None |
| Baseline | `npm run db:validate-baseline` | **v1 OK**, cutoff uniqueness, 27 |
| Prisma validate | `npx prisma validate` | Pass |
| History (Neon) | `npm run prisma:check-history` | **Failed this run** — DB unreachable (no writes attempted) |
| BE unit | `npm run test:unit` | **312 pass** |
| FE unit | `npm run test:unit` | **42 pass** |
| FE build | `npm run build` | Pass |
| Integration | disposable local Postgres | **8 pass** |

Rollback target (if a future staging deploy succeeds): previous RC parent `774bbdae3bcdcfbcbe1a8757f62718a398d3b281` or documented prior staging build — record at deploy time.

Evidence locations: this file + docs 32–35. Screenshots: **none** (no browser session).

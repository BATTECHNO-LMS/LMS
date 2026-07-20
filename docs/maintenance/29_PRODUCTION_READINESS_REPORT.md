# 29 — Production Readiness Report (QA-001)

**Date:** 2026-07-20 (updated — RELEASE-FINAL-001)  
**Branch / main:** `main` @ `f48274f` (PR #2 merged from `maintenance/test-safety-baseline`)  
**Verdict:** **NO-GO** for `v1.0.0` tag — see `47_FINAL_PRODUCTION_GO_DECISION.md`.  
**Operational status:** Production **Live** (health + login). JWT sync, FE deploy identity, and Neon↔repo migration parity remain open.

---

## Executive summary

Automated verification remains strong (**324** BE unit + **42** FE unit + **8** integration on disposable Postgres; baseline v1 valid; empty-DB reproducible at **27** migrations). PR #2 is merged; GitHub CI was green before merge.

Release-final production proof **failed gates**:

1. Render `JWT_SECRET` still does **not** match approved fingerprint `eec7827fb0` (prod token ≠ local verify; local mint ≠ prod `/me`).
2. Live frontend asset hash (`index-Cmf0WSFP.js`) does **not** match a fresh `main` production build (`index-CuYaHmIt.js`).
3. Neon↔repo migration parity: **resolved** — Option B complete; checksum reconciled; **28/28** aligned (see `49`).
4. Academic write smoke could not run (production has **0** assessments).

**QA-AUTH-001** and **QA-AUTH-003** remain open and are **accepted temporarily** for a future v1.0.0 only after other gates clear — **not marked resolved**.

---

## Test results

| Suite | Result |
|-------|--------|
| Backend unit | **324 pass / 0 fail** |
| Frontend unit | **42 pass / 0 fail** |
| Backend integration (disposable Postgres + baseline init) | **8 pass / 0 fail** |
| Frontend production build | **Pass** (large-chunk warnings) |
| Prisma validate | **Pass** |
| `prisma:check-history` (Neon, read-only) | **28** applied / **0** pending / **0** failed — aligned with repo |
| `db:validate-baseline` | **v1 OK** (27 represented; cutoff unchanged) |
| Empty-DB disposable verify | **Pass** (baseline 27 → deploy #28 → **28/28**) |
| Browser E2E framework | **Not present** |
| Seven-role API smoke (prod synthetic accounts) | **Pass** (landing contract + allow/deny); SA deny N/A |
| Academic write smoke (prod) | **Blocked** (empty academic dataset) |
| Field-training smoke (prod) | **Partial pass** (list/application paths 200; cross-scope 403) |

---

## Role coverage

| Role | Automated AuthZ | Production API smoke (RELEASE-FINAL-001) |
|------|-----------------|------------------------------------------|
| super_admin | High | Login + analytics allow |
| university_admin | High | Login + allow/deny |
| academic_admin | High | Login + allow/deny |
| qa_officer | Medium | Login + allow/deny |
| instructor | High | Login + allow/deny |
| student | High | Login + allow/deny |
| university_reviewer | Medium | Login + allow/deny |
| program_admin | Fail-closed | Catalog absent; FE → `/login` |

---

## Academic / field-training workflow

| Area | Status |
|------|--------|
| Submit / duplicate / finalize (automated) | **Pass** |
| Production academic write smoke | **Blocked** (0 assessments) |
| FT integration (disposable DB) | **Pass** |
| FT production list/application paths | **Pass** |
| Unused FT statuses (`task_pending` / etc.) | Known gap **QA-FT-001** |

---

## Findings board

### P0 — Release / tag blockers (RELEASE-FINAL-001)

| ID | Summary | Status |
|----|---------|--------|
| **REL-JWT-001** | Render JWT ≠ approved fingerprint `eec7827fb0` | **Open — blocks GO/tag** |
| **REL-FE-001** | Live FE bundle ≠ `main` rebuild hash | **Open — blocks GO/tag** |
| **REL-MIG-001 / PROD-DRIFT-OPTION-B** | Migration history reconciled — repo and Neon **28/28** | **Resolved** (see `49`) |
| **QA-STG-001** | No isolated staging | Still open (prod smoke used carefully with synthetic accounts) |

### P1

| ID | Summary | Fix now? |
|----|---------|----------|
| **QA-AUTH-001** | Logout does not revoke JWT | Accepted temporarily for eventual v1; **not resolved** |
| **QA-AUTH-003** | Password reset leaves access JWTs valid | Accepted temporarily for eventual v1; **not resolved** |

### P2 / P3 (summary — unchanged)

QA-ROLE-001, QA-SEC-001/002/003/005, QA-NAV-001, QA-API-003/006, QA-PERF-001/002, QA-FT-001 — see docs 21–27.

---

## Production smoke (post-merge)

See **`46_PRODUCTION_FINAL_SMOKE.md`** and **`47_FINAL_PRODUCTION_GO_DECISION.md`**.

---

## Go / No-Go

| Question | Answer |
|----------|--------|
| Is production Live and basically usable? | **Yes** (health, login, role probes) |
| Is final release / `v1.0.0` tag authorized? | **No — NO-GO** |
| Next actions | Sync JWT → redeploy FE from `main` → reconcile migration → re-run RELEASE-FINAL-001 |

---

## Document index (maintenance)

| # | Topic |
|---|--------|
| 30 | Release-candidate hygiene |
| 31–35 | Staging smoke (blocked) |
| 41–45 | Prod env / DB / deploy trail |
| 46 | Production final smoke |
| 47 | Final production GO decision |

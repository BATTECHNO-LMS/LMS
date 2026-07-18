# 29 — Production Readiness Report (QA-001)

**Date:** 2026-07-18  
**Branch:** `maintenance/test-safety-baseline` (QA-REL-001 hygiene complete — clean working tree; see `30_RELEASE_CANDIDATE_HYGIENE.md`)  
**Verdict:** **Conditional Go** — core authz, academic delivery integrity, FT integration, and DB migration governance are in good shape; production cutover still needs staging UI smoke and explicit acceptance of residual session-token risks.

---

## Executive summary

Automated verification shows a **strong unit/integration safety net** (312 BE + 42 FE + 8 integration) and a **reconciled Neon migration history** with **versioned empty-DB baseline v1**. Academic submit/grade uniqueness and finalized-grade immutability are enforced in Backend and covered by tests. Field-training happy path runs under mocked externals.

This is **not** a claim that every role×page×viewport was manually exercised in a browser. Staging smoke remains mandatory. Several **P1** session-lifecycle gaps and **P2** product/ops items remain open by design (no automatic revocation implementation in this phase).

---

## Test results

| Suite | Result |
|-------|--------|
| Backend unit | **312 pass / 0 fail** |
| Frontend unit | **42 pass / 0 fail** |
| Backend integration (local ephemeral Postgres + baseline init) | **8 pass / 0 fail** |
| Frontend production build | **Pass** (large-chunk warnings) |
| Prisma validate | **Pass** |
| `prisma:check-history` (Neon, read-only) | **27/27**, 0 pending/failed |
| `db:validate-baseline` | **v1 OK** |
| Test database guard | **Pass** |
| Browser E2E (Playwright/Cypress full matrix) | **Not run** — Pending staging |
| Full responsive/a11y matrix | **Not run** — Pending staging |

---

## Role coverage

| Role | Automated AuthZ/portal evidence | Staging UI smoke |
|------|----------------------------------|------------------|
| super_admin | High | Pending |
| university_admin | High (scope) | Pending |
| academic_admin | High; FT manage UI drift noted | Pending |
| qa_officer | Medium | Pending |
| instructor | High + FT I | Pending |
| student | High + academic U/FE | Pending |
| university_reviewer | Medium | Pending |
| program_admin | Fail-closed confirmed | Confirm inactive |

---

## Academic workflow

| Step | Status |
|------|--------|
| Submit / duplicate / update same row | **Pass** (automated) |
| Grade / finalize / immutability | **Pass** (automated) |
| Cross-uni / unauthorized | **Pass** characterization; staging probe recommended |
| Quiz attempts / certificate grade gate / binary upload | **Out of scope / deferred** (QA-PROD-001/002) |

## Field-training workflow

| Step | Status |
|------|--------|
| Integration happy path + reports + expel guards | **Pass** (8 tests) |
| Unused statuses `task_pending` / `post_assessment_pending` / `failed` | **Known gap** QA-FT-001 |
| Real AI/email/R2 | **Not exercised** (correctly mocked/unset) |

## API / routes / UI / security / DB / integrations / perf

See docs **23–27**. Highlights: dead `auth/refresh` map; enrollment dual path; JWT logout/reset residual validity (**P1**); sync PDF/Excel risk; no APM.

---

## Findings board

### P0 — Deployment blockers

| ID | Summary | Status |
|----|---------|--------|
| — | None newly confirmed that block *technical* deploy of current build | — |
| — | (QA-REL-001 resolved — tree committed; production tag still deferred) | — |

### P1

| ID | Summary | Fix now? |
|----|---------|----------|
| **QA-AUTH-001** | Logout does not revoke JWT | No — product decision |
| **QA-AUTH-003** | Password reset leaves access JWTs valid | No — product decision |

### P2 / P3 (summary)

| ID | Severity | Topic |
|----|----------|-------|
| QA-ROLE-001 | P2 | FT admin FE vs BE role drift |
| QA-SEC-001 | P2 | Dual AuthZ sources (ISS-001) |
| QA-SEC-002 | P2 | Account enumeration / error wording |
| QA-SEC-003 | P2 | Confirm auth rate-limit production values |
| QA-SEC-005 | P2 | File download ownership staging probe |
| QA-NAV-001 | P2 | Unmounted QA/Risk/Integrity CRUD |
| QA-API-003/006 | P2 | Dual enrollment; pagination caps |
| QA-PERF-001/002 | P2 | Bundle size; sync PDF/Excel |
| QA-OBS-001 | P2 | No error tracking |
| QA-FT-001 | P2 | Unused FT statuses |
| QA-API-001/002/004/005 | P3 | Dead/legacy endpoints |
| QA-UI-001/002 | P3 | Chunks; UI permission matrix vs API |
| QA-PROD-001/002 | P3 | Quiz/certificate product gaps |

---

## Small fixes applied this phase

**None.** No unambiguous, decision-free, schema-free defect was auto-patched; open items require product/ops decisions or staging confirmation.

---

## Product decisions required

1. JWT revocation on logout and/or password reset (QA-AUTH-001/003).  
2. Align FT `academic_admin` manage access FE↔BE (QA-ROLE-001).  
3. AuthZ single source of truth (ISS-001).  
4. Mount or explicitly defer QA/Risk/Integrity CRUD (QA-NAV-001).  
5. Enrollment API unification (QA-API-003).  
6. FT unused enum statuses (ISS-003 / QA-FT-001).  
7. Quiz attempts / certificate gating (QA-PROD-*).  

---

## Deployment blockers

1. ~~Commit hygiene (QA-REL-001)~~ — **done**; production **tag** still deferred until staging smoke.  
2. Staging smoke checklist completed (below).  
3. Explicit acceptance of residual JWT validity after logout/reset **or** ship revocation.  
4. Confirm production env: JWT secret strength, CORS, rate limits, storage/AI/email flags.  
5. Neon backup / migrate status already clean — keep `prisma:check-history` in deploy.

---

## Cleanup candidates

See `28_VERIFIED_CLEANUP_CANDIDATES.md` — **no deletions** until review.

---

## Staging checklist

- [ ] Login each of 7 active roles → correct portal  
- [ ] Student academic submit → duplicate 409 → edit → instructor grade → finalize → 409 on edit  
- [ ] One FT opportunity → apply → approve → task → submit → letter (sandbox keys only)  
- [ ] Cross-university denial spot checks  
- [ ] Certificate public verify  
- [ ] Password reset + confirm whether old session still works (document result)  
- [ ] Mobile 360px: student submit + FT detail  
- [ ] Analytics PDF export timeout behavior  

## Production smoke (post-deploy)

- [ ] `/health` + `/health/ready`  
- [ ] Login SA + student  
- [ ] `prisma migrate status` up to date  
- [ ] Unique index present  
- [ ] No unexpected 5xx spike  

---

## Go / Conditional Go / No-Go

### **Conditional Go**

**Go** for staging deployment and controlled production once release hygiene + staging smoke pass.  
**No-Go** for “declare fully production-hardened” until P1 session lifecycle is decided and staging UI matrix is signed off.

---

## Ordered remediation plan

1. ~~Commit release-candidate hygiene (QA-REL-001)~~ — done; open PR / CI green; tag only after staging.  
2. Staging smoke (auth + academic + FT).  
3. Decide JWT revocation (QA-AUTH-001/003).  
4. Resolve QA-ROLE-001 (product).  
5. Pagination/export timeouts (QA-API-006, QA-PERF-002).  
6. Error tracking (QA-OBS-001).  
7. Reviewed cleanup from doc 28.  
8. ISS-001 AuthZ redesign (larger program).  

---

## Documents in this QA pack

| Doc | Title |
|-----|-------|
| 20 | QA production-readiness baseline |
| 21 | Master QA matrix |
| 22 | Field-training state transition QA |
| 23 | API contract QA |
| 24 | Route and navigation QA |
| 25 | UI/accessibility QA |
| 26 | Security regression QA |
| 27 | Performance and observability QA |
| 28 | Verified cleanup candidates |
| 29 | This report |
| 30 | Release candidate hygiene (QA-REL-001) |

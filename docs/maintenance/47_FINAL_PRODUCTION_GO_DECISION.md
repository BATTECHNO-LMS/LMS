# 47 — Final Production GO Decision (RELEASE-FINAL-001)

**Date:** 2026-07-20  
**Task:** RELEASE-FINAL-001  
**Main merge SHA:** `f48274faff1b71fe418baa2e6d6bb3dc324e8462`  
**PR #2:** Merged into `main` (2026-07-19)  
**Branch tip merged:** `6b14a86` (parents: `e8048c6` + `6b14a86`)  
**Frontend:** https://lms.battechno.com  
**API:** https://lms-7txx.onrender.com  
**Expected JWT fingerprint:** `eec7827fb0`

**Verdict:** **NO-GO** for `v1.0.0` tag / final release sign-off  
**Operational note:** Production remains **Live** (health/auth login work). Do **not** treat this as permission to tag.  
**PROD-DRIFT-001 (2026-07-20):** Authoritative SQL for `20260719120000_field_training_required_hours` was **not** found in Git; checksum `c43e180b…` could not be reconstructed. See `48_PRODUCTION_MIGRATION_DRIFT_RECONCILIATION.md`. No fake migration was added.

No credentials, tokens, or connection strings are recorded here.

---

## 1. Merge and deployment identity

| Item | Result |
|------|--------|
| PR #2 merged | **Yes** (`merged=true`, merge commit `f48274f`) |
| Local `main` == `origin/main` | **Yes** (`f48274f`) |
| Working tree (before docs) | Clean except temporary local smoke scripts (not committed) |
| Merge introduced unexpected executable drift beyond PR branch | **No** — merge is PR #2 content onto prior `main` |
| Render deployed Git SHA | **Not exposed** by `/health` or public API — confirm in Render dashboard |
| Live FE main bundle | `/assets/index-Cmf0WSFP.js` |
| Local rebuild of `main` FE bundle | `/assets/index-CuYaHmIt.js` |
| FE identity vs merged `main` | **Mismatch** — live Hostinger bundle does **not** match a fresh production build of current `main` |
| FE embeds prod API | **Yes** (`lms-7txx.onrender.com`); no localhost API |

---

## 2. Health

| Check | Result |
|-------|--------|
| `GET /health` | **200** |
| `GET /health/ready` | **200** (`db: true`) |
| FE `/` | **200** |
| FE `/login` | **200** |
| Crash loop / Prisma startup / JWT startup errors observed via health | **None** |
| Unexpected 5xx in smoke probes | **None** |

---

## 3. JWT rotation proof

| Check | Result |
|-------|--------|
| Local approved fingerprint | `eec7827fb0` (**match**) |
| Bogus token → `/api/auth/me` | **401** |
| Wrong-secret minted token → `/me` | **401** |
| New login (synthetic catalog) | **200** |
| `/api/auth/me` with new token | **200** |
| Prod-issued token verifies with approved local secret | **Fail** (`JsonWebTokenError: invalid signature`) |
| Local-minted token accepted by Render | **401** |
| Render runtime == approved fingerprint `eec7827fb0` | **Not confirmed — evidence contradicts sync claim** |
| Logout API | **200** |
| Token still valid after logout | **200** on `/me` → **QA-AUTH-001** still open |
| Re-login after logout | **200** |

**Conclusion:** Render is authenticating with a **different** `JWT_SECRET` than the approved local value. Session reset / fingerprint alignment is **not** proven.

---

## 4. Seven-role minimum smoke (API)

Synthetic BATUNI catalog accounts. First full pass (before auth rate-limit noise):

| Role | Login | Landing (expected) | Allowed probe | Denied probe | Logout |
|------|-------|--------------------|---------------|--------------|--------|
| super_admin | 200 | `/admin/dashboard` | analytics overview **200** | settings is SA-allowed (**N/A deny**); global bypass limits role-deny proof | 200 |
| university_admin | 200 | `/admin/dashboard` | users list **200** | settings **403** | 200 |
| academic_admin | 200 | `/admin/dashboard` | assessments **200** | settings **403** | 200 |
| qa_officer | 200 | `/admin/dashboard` | qa-reviews **200** | settings **403** | 200 |
| instructor | 200 | `/instructor/dashboard` | assessments **200** | settings **403** | 200 |
| student | 200 | `/student` | student courses **200** | users **403** | 200 |
| university_reviewer | 200 | `/reviewer/dashboard` | recognition-requests **200** | settings **403** | 200 |
| program_admin | — | `/login` (fail-closed) | Not in seed catalog; FE `getDashboardPathForRole` → `/login`; AuthZ unit coverage retained | — | — |

Browser UI click-through was not instrumented; matrix is **API + landing-path contract**. Re-runs can hit **429** auth rate limits.

---

## 5. Core workflow smoke

### Academic

| Step | Result |
|------|--------|
| Student enrollments / courses | **200** |
| Instructor assessments list | **200**, **0** assessments |
| Student create/edit submission | **Blocked** — no synthetic assessment rows in production |
| Duplicate create rejection | **Not executed** (no base submission) |
| Instructor grade / finalize / immutability | **Not executed** (no submission) |
| Automated uniqueness / finalize immutability unit coverage | **Pass** (local) |

### Field training

| Step | Result |
|------|--------|
| Student eligible list | **200** |
| Application path (`my-applications`) | **200** |
| Instructor assigned workflow list | **200** |
| Reviewer academic FT route | **404** (route/shape); mutate admin create **404/deny** — treated as non-mutating |
| Cross-scope (uni admin → SA analytics) | **403** |

No historical records deleted.

---

## 6. Database (read-only)

| Check | Result |
|-------|--------|
| `prisma migrate status` | Schema up to date vs **repo 27** folders |
| `prisma:check-history` | **0 pending**, **0 failed** |
| Applied rows in `_prisma_migrations` | **28** |
| Repo migration folders on `main` | **27** |
| Extra DB-only migration | `20260719120000_field_training_required_hours` (finished 2026-07-19) — **not present on `main`** |
| Related column observed | `field_training_opportunities.required_training_hours` |
| `uq_submissions_assessment_student` | **Present** |
| Users | **468** (prior smoke 424 — **increase**, not reduction) |
| Submissions | **0** |
| Assessments | **0** |
| Grades | **0** |

**Drift:** Production history is **not** cleanly “27/27 matching `main`”. Extra applied migration without matching repo folder is a release blocker for tag/sign-off.

---

## 7. Automated validation (local)

| Suite | Result |
|-------|--------|
| Backend unit | **324 pass / 0 fail** |
| Frontend unit | **42 pass / 0 fail** |
| Frontend production build | **Pass** |
| Prisma validate | **Pass** |
| Baseline validate v1 | **OK** — 27 represented; cutoff `20260718120000_academic_submission_uniqueness` |
| Empty-DB init (disposable Postgres) | **Pass** — 27 applied; unique index ok |
| Integration (isolated TEST DB) | **8 pass / 0 fail** |
| Secret scan | No tracked `.env`; placeholder `JWT_SECRET=` only in examples |
| Production URL scan | Docs/deploy references only; live FE points at prod API |

---

## 8. Known auth risks (unchanged status)

| ID | Decision for v1.0.0 |
|----|---------------------|
| **QA-AUTH-001** | **Accepted temporarily** — logout does not revoke server JWT; **not resolved**; schedule immediate post-release remediation |
| **QA-AUTH-003** | **Accepted temporarily** — password reset does not invalidate access JWTs; **not resolved**; schedule immediate post-release remediation |

---

## 9. Remaining blockers (must clear before GO / tag)

1. **Align Render `JWT_SECRET`** to approved fingerprint `eec7827fb0` and re-prove bidirectional verify (prod token ↔ local secret; local mint ↔ Render `/me`).
2. **Redeploy frontend** from merged `main` and confirm live asset hash matches the release build.
3. **Record Render deploy SHA** from dashboard (or expose a safe build identity header).
4. **PROD-DRIFT-OPTION-B-001:** **Resolved** — migration history reconciled; repo and Neon **28/28** (see `49`). Application feature gap for required hours remains.
5. Optional: seed minimal synthetic academic assessment for production QA write smoke (or accept automated-only academic proof).

---

## 10. Final decision

### **NO-GO**

Production is up and basic auth/health/role probes largely succeed, but **release-final gates failed**:

- Claimed JWT sync is **disproven**
- FE live build **does not match** merged `main` rebuild
- Neon has an **extra migration** not on `main`
- Academic write path **not exercised** (empty academic dataset)

### May `v1.0.0` tag be created now?

**No.** Do not create or push `v1.0.0` until blockers above are cleared and this document is upgraded to **GO**.

---

## Related documents

- `46_PRODUCTION_FINAL_SMOKE.md` — updated smoke evidence  
- `29_PRODUCTION_READINESS_REPORT.md` — readiness verdict rolled forward  
- `41`–`45` — prior activation/deploy trail

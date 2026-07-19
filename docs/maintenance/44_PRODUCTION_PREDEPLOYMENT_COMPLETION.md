# 44 — Production Pre-Deployment Completion (PROD-PREDEPLOY-001)

**Date:** 2026-07-18  
**Application commit (not redeployed):** `e3cadb1`  
**API (unchanged deploy):** `https://lms-7txx.onrender.com`  
**Frontend:** `https://lms.battechno.com`  
**Verdict:** **MANUAL ACTION REQUIRED** (migration complete; Render JWT sync still pending)

No JWT value, DATABASE_URL, provider keys, or personal data are recorded here.

---

## 1. Pre-action identity verification

| Check | Result |
|-------|--------|
| Working tree | Clean (no staged `.env`) |
| HEAD | `e3cadb1` |
| `.env` ignored | Yes |
| Local JWT present | Yes |
| Local JWT fingerprint | `eec7827fb0` (**match**) |
| Neon host fingerprint | `82eea2790f` (**match**) |
| DB name fingerprint | `693fe5919f` |
| API host | `lms-7txx.onrender.com` live `/health` |
| Migration before | 26 applied / 1 pending / 0 failed |

---

## 2. Restore point

| Item | Result |
|------|--------|
| Restore point available | **Yes** — Neon managed PITR / console branch restore |
| Explicit API branch snapshot created | **No** (no `NEON_API_KEY` / neonctl in environment) |
| Reference timestamp (UTC) | `2026-07-18T13:37:07Z` (pre-`migrate deploy`) |
| Provider reference id | N/A — use Neon Console → project → restore/branch from timestamp above |

---

## 3. Duplicate audit (read-only, aggregate)

| Metric | Before | After |
|--------|-------:|------:|
| Total submissions | 0 | 0 |
| Duplicate groups | **0** | **0** |
| Rows in duplicate groups | 0 | 0 |
| Users | 423 | 423 |

**Gate:** Duplicate groups = 0 → migration permitted.

---

## 4. JWT synchronization to Render

| Item | Result |
|------|--------|
| Render CLI / `RENDER_API_KEY` | **Unavailable** |
| JWT updated on Render | **No — not performed** |
| Local fingerprint retained | `eec7827fb0` |

### Exact manual Render dashboard steps

1. Open [Render Dashboard](https://dashboard.render.com) and select the **Backend** service that serves `https://lms-7txx.onrender.com` (confirm URL in service settings).  
2. Open **Environment**.  
3. Set **`JWT_SECRET`** to the **exact** value currently in the local ignored `backend/.env` (fingerprint must remain `eec7827fb0` — do not generate a second secret).  
4. Do **not** change unrelated variables.  
5. Save → allow Render to **restart the same deployed image/commit** (env-only restart).  
6. Confirm service is Live; check logs for absence of JWT / missing-env / Prisma crash messages (do not paste secrets).  
7. Verify `GET https://lms-7txx.onrender.com/health` and `/health/ready` return 200.  

**Planned session reset:** After sync, all previously issued access tokens become invalid. Users must log in again. Accounts, passwords, and OTP rows are unchanged. This does **not** resolve QA-AUTH-001 / QA-AUTH-003.

---

## 5. Render restart / session smoke

| Item | Result |
|------|--------|
| Env-only restart after JWT sync | **Not run** (sync pending) |
| Production session reset smoke | **Deferred** until JWT sync |
| Current API health (pre-JWT-sync) | `/health` 200 · `/health/ready` 200 · FE 200 |

---

## 6–7. Migration before / execution / after

| State | Applied | Pending | Failed |
|-------|--------:|--------:|-------:|
| Before | 26 | 1 (`20260718120000_academic_submission_uniqueness`) | 0 |
| Command | `npx prisma migrate deploy` only | | |
| After | **27** | **0** | **0** |

Migration SQL reviewed: additive `CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assessment_student" ON "submissions" ("assessment_id", "student_id")` only.

History row for `20260718120000_academic_submission_uniqueness` present.

---

## 8. Unique-index verification

| Check | Result |
|-------|--------|
| Index name | `uq_submissions_assessment_student` |
| UNIQUE | Yes |
| Columns (order) | `assessment_id`, `student_id` |
| Duplicate equivalent indexes | Only this one |

---

## 9. Data preservation

| Metric | Unchanged |
|--------|-----------|
| Users | 423 → 423 |
| Submissions | 0 → 0 |
| No truncates / drops | Confirmed by command scope |

---

## 10. Production health (post-migration)

| Check | Result |
|-------|--------|
| API `/health` | 200 |
| API `/health/ready` | 200 |
| Frontend `https://lms.battechno.com` | 200 |
| CORS `Origin: https://lms.battechno.com` | Reflects production origin |
| Auth login route availability | OPTIONS 204 |
| Localhost CORS | Still accepted by **hardcoded** allowlist in deployed `app.js` (pre-existing; **not** changed this task) |
| Wildcard CORS | Not observed |

---

## 11. R2 public URL decision

`R2_PUBLIC_BASE_URL` remains empty.

**Decision:** **Intentionally optional.**  
`resolvePublicUrl` uses `R2_PUBLIC_BASE_URL` only when set; otherwise falls back to `PUBLIC_BASE_URL` / relative upload paths. Private R2 + signed URLs remain viable. No invented CDN URL. Does not block predeploy.

If public anonymous object URLs are required later: configure Cloudflare R2 custom domain / public bucket URL in dashboard, then set `R2_PUBLIC_BASE_URL` (and on Render) to that HTTPS origin.

---

## 12. Safe validation re-run

| Suite | Result |
|-------|--------|
| Backend unit | 318 pass |
| Frontend unit | 42 pass |
| Frontend build | Pass · prod API present · 0 localhost · 0 secretish |
| Prisma validate | Pass |
| `prisma:check-history` | 27/27 · 0 pending · 0 failed |
| Baseline validate | v1 OK |

No production integration writes. No Gemini/Resend/R2 upload/YouTube calls.

---

## 13. Remaining risks / open items

- **JWT not on Render** — blocks READY TO DEPLOY  
- **QA-AUTH-001 / QA-AUTH-003** — still open  
- Deployed API still allows localhost origins via source allowlist (separate hardening)  
- Application code deploy of `e3cadb1` **not** performed (per scope)

---

## 14. Remaining manual actions

1. Sync `JWT_SECRET` on Render Backend for `lms-7txx` (steps above).  
2. Confirm restart + health + login with a synthetic/approved test account.  
3. Confirm an old token fails after rotation.  
4. Then proceed to application deploy task (separate) if desired.

---

## 15. Verdict

### **MANUAL ACTION REQUIRED** (predeploy) → superseded for app ship by **PROD-DEPLOY-001**

Database predeploy migration objectives are **complete** (27/27 + unique index).  
Render JWT synchronization remains owner-deferred.  
Application code deployment: see **`45_PRODUCTION_APPLICATION_DEPLOYMENT.md`** — **MANUAL DEPLOYMENT REQUIRED** (no Render/Hostinger access in agent).

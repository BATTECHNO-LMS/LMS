# 43 — Production Deployment Readiness (PROD-ENV-ACTIVATION-001)

**Date:** 2026-07-18  
**Application RC:** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3`  
**Verdict:** **READY WITH MANUAL ACTIONS**

---

## Decision summary

Local activation of the owner-approved production `.env` succeeded for JWT, HTTPS URLs, CORS, provider configuration, Backend startup, builds, and automated tests.  
Production **cutover/deploy is not authorized yet** until the pending Neon migration is applied and the hosting JWT secret is synchronized.

---

## Gate checklist

| Gate | Status |
|------|--------|
| JWT_SECRET fixed locally | Pass |
| Production FE/API URLs consistent HTTPS | Pass |
| Neon connectivity | Pass |
| Migration history trustworthy | Pass (history present, 0 failed) |
| No unexpected pending migration | **Fail** — expected uniqueness migration still pending |
| Backend starts | Pass |
| Frontend builds with prod API | Pass |
| Providers configured | Pass (R2 health OK; Resend/Gemini keys present) |
| Secrets not in Git / FE build | Pass |
| Automated tests | Pass (318 / 42 / 8) |

---

## Remaining manual actions (blocking deploy)

1. Sync `JWT_SECRET` to Render (or host) secrets — local fingerprint `eec7827fb0`.  
2. On approved Neon only: reviewed `npx prisma migrate deploy` for `20260718120000_academic_submission_uniqueness`.  
3. Re-verify `prisma:check-history` → 27/27 and unique index present.  
4. Deploy FE `dist/` + API from RC (separate task) — **do not** use localhost env.  
5. Optional: set `R2_PUBLIC_BASE_URL` if public object URLs are required.

---

## Known release risks (accepted documentation — not fixed here)

- **QA-AUTH-001** — Logout clears client token only; server JWT remains valid until expiry.  
- **QA-AUTH-003** — Password reset does not invalidate existing access JWTs.  

Product must explicitly accept these for cutover or schedule revocation work.

---

## Rollback (secret-free)

| Layer | Action |
|-------|--------|
| Env | Restore previous ignored `.env` backup from operator vault (not in Git) |
| JWT | Rotate hosting + local secrets together if leaked |
| DB | Neon restore point taken **before** migrate deploy |
| App | Redeploy prior known-good Render/static build; RC parent `e35757e` docs / `1cfe2f4` app |

---

## What this task did **not** do

- Production deploy  
- Production tag  
- `migrate deploy` on Neon  
- Seeds / QA writes on Neon  
- Live Resend/AI content sends  
- Merge to `main`

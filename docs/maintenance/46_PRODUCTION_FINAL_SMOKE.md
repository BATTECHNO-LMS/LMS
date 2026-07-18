# 46 — Production Final Smoke (PROD-FINAL-SMOKE-001)

**Date:** 2026-07-18  
**Frontend:** https://lms.battechno.com  
**API:** https://lms-7txx.onrender.com  
**Approved app baseline:** `e3cadb1`  
**Expected JWT fingerprint:** `eec7827fb0`  
**Verdict:** **CONDITIONAL GO**

No credentials, tokens, or connection strings are recorded here.

---

## Deployed identity

| Item | Result |
|------|--------|
| Backend deployed Git SHA | **Not exposed by Render health API** — service Live (`x-render-origin-server=Render`); confirm SHA in Render dashboard |
| Frontend build marker | Live main bundle `/assets/index-Cmf0WSFP.js` (differs from local rebuild name — confirms hosted FE asset set) |
| App baseline reference | `e3cadb1` (docs tip may be later; app-equivalent) |

---

## Health / frontend / CORS

| Check | Result |
|-------|--------|
| `/health` | **200** |
| `/health/ready` | **200** (`db: true`) |
| FE `/` | **200** |
| FE `/login` | **200** |
| FE embeds production API | **Yes** (`lms-7txx.onrender.com` in live JS) |
| Localhost/staging in FE index/JS | **None found** |
| CORS `Origin: https://lms.battechno.com` | Reflects `https://lms.battechno.com` |

---

## Auth / session smoke

| Check | Result |
|-------|--------|
| Bogus / wrong-secret token → `/api/auth/me` | **401 rejected** |
| New login (synthetic catalog student) | **200** + token issued |
| `/api/auth/me` with new token | **200**; roles include `student` |
| Dashboard expectation | **`/student`** |
| Logout endpoint | **200** |
| Client session clear | Required in SPA (logout API success); browser storage not instrumented here |
| Post-logout server token | Still **200** on `/me` — confirms **QA-AUTH-001** remains open |

### JWT rotation fingerprint check

| Check | Result |
|-------|--------|
| Local `.env` JWT fingerprint | `eec7827fb0` (match expected) |
| Production-issued token verifies with local secret | **No** (`JsonWebTokenError`) |
| Conclusion | Render is **Live and authenticating**, but its `JWT_SECRET` does **not** match the approved local fingerprint `eec7827fb0` |

**Owner action:** Confirm Render Environment `JWT_SECRET` was set to the exact approved local value (fingerprint `eec7827fb0`), then restart and re-check. Until then, local/prod secrets are divergent.

---

## Database

| Check | Result |
|-------|--------|
| Migrations | **27/27**, 0 pending, 0 failed |
| `uq_submissions_assessment_student` | Present |
| Users | **424** (was 423 — **increase**, not reduction) |
| Submissions | **0** (unchanged) |

---

## Automated tests (local)

| Suite | Result |
|-------|--------|
| Backend unit | **318 pass** |
| Frontend unit | **42 pass** |
| Frontend production build | **Pass** |

---

## Open issues (unchanged)

- **QA-AUTH-001** — Logout does not revoke server-side JWT (confirmed again in this smoke).  
- **QA-AUTH-003** — Password reset does not invalidate existing JWTs.

---

## Remaining blockers / follow-ups

1. Align Render `JWT_SECRET` with approved fingerprint `eec7827fb0` (if that was the intent of “JWT rotation”).  
2. Record exact Render deploy commit SHA from dashboard into this doc.  
3. Optional: full seven-role UI smoke.  
4. Production release tag — only after verdict upgraded to **GO**.

---

## Verdict

### **CONDITIONAL GO**

Production is healthy, FE points at prod API, auth works, DB 27/27 preserved.  
Not full **GO** until Render JWT fingerprint is confirmed equal to `eec7827fb0` (or the mismatch is explicitly accepted as intentional and documented).

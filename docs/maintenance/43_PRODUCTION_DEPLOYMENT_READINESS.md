# 43 — Production Deployment Readiness (updated PROD-PREDEPLOY-001)

**Date:** 2026-07-18  
**Application RC / tip:** `e3cadb1` (not redeployed in predeploy)  
**Verdict:** **MANUAL ACTION REQUIRED**

---

## Decision summary

- Production Neon is **27/27** with academic submission unique index verified.  
- Local production JWT (`eec7827fb0`) is **not** yet on Render.  
- Do **not** declare READY TO DEPLOY until Render `JWT_SECRET` is synchronized and session-reset smoke passes.  
- Do **not** create a production tag in this phase.

See `44_PRODUCTION_PREDEPLOYMENT_COMPLETION.md` for full evidence.

---

## Gate checklist

| Gate | Status |
|------|--------|
| JWT_SECRET fixed locally | Pass |
| JWT_SECRET on Render | **Fail — manual** |
| Production FE/API URLs | Pass |
| Neon connectivity | Pass |
| Migration 27/27 | **Pass** |
| Unique index present | **Pass** |
| Data-count regression | None observed |
| Backend health (API) | Pass |
| Frontend available | Pass |
| New login after JWT rotation | **Pending Render sync** |
| Secrets not in Git / FE build | Pass |
| Automated tests | Pass (318 / 42) |

---

## Remaining manual actions (blocking READY TO DEPLOY)

1. Set Render Backend `JWT_SECRET` to local approved secret (fp `eec7827fb0`).  
2. Restart same service version; verify health.  
3. Session reset smoke: old token fails; new login + `/me` OK.  
4. Optional later: deploy application code / tag (separate tasks).

---

## Known release risks

- **QA-AUTH-001** / **QA-AUTH-003** still open.  
- Deployed CORS allowlist still includes localhost origins in source (pre-existing).

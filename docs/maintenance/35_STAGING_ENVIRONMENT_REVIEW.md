# 35 — Staging Environment Review (QA-STAGING-SMOKE-001)

**Date:** 2026-07-18  
**Purpose:** Classify targets and record hardening requirements **without exposing secret values**.

---

## Classification outcome

| Target | Classification | Action |
|--------|----------------|--------|
| `$STAGING_FRONTEND_URL` / `$STAGING_API_URL` | **Unavailable** | Stop — no deploy |
| Documented `https://lms.battechno.com` | **Production frontend** | **Do not use** for smoke |
| Documented Render API (`*.onrender.com`) | **Production-like API** | **Do not use** for smoke |
| Local `backend/.env` `DATABASE_URL` | **Neon shared/prod-like** (hostname family) | **Not staging**; no QA writes; no migrate deploy for smoke |
| Local disposable Postgres (`lms_*`) | Isolated QA for **automated** integration only | Not a browser staging stack |
| Deploy CLIs (Render/Vercel/gh/fly) | **Not available** in this agent environment | Cannot deploy |

**Stop rule applied:** target cannot be classified as staging → **no deployment**, **no browser smoke**, **no pretend**.

---

## Required staging configuration (checklist — verify when provisioned)

| Control | Staging expectation | Status |
|---------|---------------------|--------|
| Frontend hostname contains staging marker | Explicit staging | Unknown / missing |
| API hostname contains staging marker | Explicit staging | Unknown / missing |
| Database isolated from Neon prod-like | Staging or dedicated QA | Missing |
| Storage | Staging bucket or `STORAGE_BACKEND=local` | Unknown |
| Email (Resend) | Disabled / sandbox / redirected | Unknown |
| AI providers | Unset or mock | Unknown |
| Payments / transactional third parties | Disabled | Unknown |
| Debug / stack traces public | Disabled | Unknown |
| CORS | Staging origins only | Unknown |
| Cookies / auth transport | Matches deploy architecture | Unknown |
| `program_admin` in active role env lists | Absent / stripped | Code strips at runtime; staging env must not re-enable |
| JWT secret | Present, non-default, ≥ min length | Unknown on staging |
| Token TTL | Documented | Unknown |
| Upload size limits | Enforced | Unknown |
| `ALLOW_EMPTY_DB_INIT` / `ALLOW_TEST_DB_WRITES` | **Absent** on staging/prod | Must verify |
| `db:init-empty` against Neon | **Refused** by guards | Keep |

---

## Health endpoints (when staging API exists)

| Endpoint | Expectation |
|----------|-------------|
| `GET $STAGING_API_URL/health` | 200 liveness |
| `GET $STAGING_API_URL/health/ready` | 200 when DB reachable |

Not called this run (no staging API URL).

---

## JWT session risk (release decision entry)

| ID | Staging verified? | Decision |
|----|-------------------|----------|
| QA-AUTH-001 logout | No | **Do not accept** via this task |
| QA-AUTH-003 password reset | No | **Do not accept** via this task |
| Role/status revalidation on next request | Code+unit only | Staging still required |

---

## Future E2E automation recommendation

No Playwright/Cypress present. **Do not add** during smoke without an explicit dependency PR.

When staging exists, prefer a follow-up task:

1. Add Playwright (or Cypress) in a dedicated PR with lockfile review.  
2. Smoke specs driven by `$STAGING_*` env vars.  
3. Staging-only project; refuse to run if URL host lacks `staging` marker.  
4. Synthetic QA markers `[QA-STAGING]` / `qa_staging_*`.

Until then: manual browser matrix in docs 32–34.

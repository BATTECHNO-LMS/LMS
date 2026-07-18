# 39 — Environment Preflight Review (ENV-PREFLIGHT-001)

**Date:** 2026-07-18  
**Mode:** Static plain-text inspection only — **no process start, no DB connection, no provider calls, no `.env` modification**  
**Final classification (at preflight time):** **D. Mixed configuration — unsafe** (also failed staging confirmation criteria)

### Superseding note (PROD-ENV-ACTIVATION-001)

The project owner subsequently **approved** this active `.env` as the authoritative production environment. Follow-up activation is documented in `41_PRODUCTION_ENV_ACTIVATION.md`, `42_PRODUCTION_DATABASE_VERIFICATION.md`, and `43_PRODUCTION_DEPLOYMENT_READINESS.md`. This preflight record is retained historically and is **not** rewritten to hide the original mixed localhost/remote findings.

This document contains **no raw secrets**, connection strings, hostnames, database names, or API key material. Sensitive values are reported as presence/emptiness and SHA-256 fingerprints truncated to 10 hex characters where required.

---

## 1. Environment files inspected

| Path | Present | Notes |
|------|---------|-------|
| `backend/.env` | Yes (~34 lines, 34 keys) | Active Backend env (newly replaced) |
| `frontend/.env` | Yes (~6 lines, 2 keys) | Active Frontend env |
| `backend/.env.example` | Yes | Repository template (tracked) |
| `.env.local` / `.env.production` / `.env.staging` | **Not found** | — |
| `frontend/.env.local` | **Not found** | — |

Parse issues: **none** (no malformed lines, no duplicate keys, no detected quote issues).

---

## 2. Git tracking result

| Check | Result |
|-------|--------|
| Root `.gitignore` | Absent |
| `backend/.gitignore` | Ignores `.env` |
| `frontend/.gitignore` | Ignores `.env`, `.env.local` |
| `git check-ignore` | `backend/.env` and `frontend/.env` **ignored** |
| `git ls-files` env secrets | **Not tracked** (only `backend/.env.example` + unrelated test filename) |
| Staged `.env` | **None** |
| `git status --short` | Clean for tracked files; env files remain ignored |
| Secrets copied into docs/logs/SQL/tests | **No evidence** in this preflight |

**Conclusion:** Active `.env` files are safely ignored by Git. Do not `git add -f` them.

---

## 3. Variable presence matrix

Legend: P = present non-empty · E = present empty · M = missing · Req = Backend · Fe = Frontend

### Backend (observed)

| Variable | State | Category | Referenced | Requirement |
|----------|-------|----------|------------|-------------|
| NODE_ENV | P | Runtime | Yes | Required |
| PORT | P | Runtime | Yes | Optional |
| API_VERSION | P | Runtime | Yes | Optional |
| DATABASE_URL | P | Database | Yes | Required |
| JWT_SECRET | **E** | Authentication | Yes | **Required — INVALID empty** |
| JWT_EXPIRES_IN | P | Authentication | Yes | Optional |
| JWT_SECRET_MIN_LENGTH | P | Authentication | Yes | Optional |
| STUDENT_ROLE_CODE | P | Role allowlist | Yes | Optional |
| SUPER_ADMIN_ROLE_CODE | P | Role allowlist | Yes | Optional |
| CORS_ORIGINS | P | CORS | Yes | Optional |
| TRUST_PROXY | P | Runtime | Yes | Optional |
| RATE_LIMIT_WINDOW_MS | P | Runtime | Yes | Optional |
| RATE_LIMIT_MAX | P | Runtime | Yes | Optional |
| AUTH_RATE_LIMIT_MAX | P | Runtime | Yes | Optional |
| UPLOAD_DIR | P | Upload | Yes | Optional |
| PUBLIC_BASE_URL | **E** | API URL | Yes | Optional (empty) |
| STORAGE_BACKEND | P (`r2`) | Storage | Yes | Optional |
| S3_PUBLIC_BASE_URL | E | Storage | Yes | Optional |
| YOUTUBE_API_KEY | P | Unknown/integration | Yes | Optional |
| RESEND_API_KEY | P | Email | Yes | Optional |
| RESEND_FROM_EMAIL | P | Email | Yes | Optional |
| EMAIL_OTP_* (3 vars) | P | Email | Yes | Optional |
| AI_PROVIDER | P (`gemini`) | AI | Yes | Optional |
| GEMINI_API_KEY | P | AI | Yes | Optional |
| AI_MODEL | P | AI | Yes | Optional |
| R2_ACCOUNT_ID | P | Storage | Yes | Optional |
| R2_ACCESS_KEY_ID | P | Storage | Yes | Optional |
| R2_SECRET_ACCESS_KEY | P | Storage | Yes | Optional |
| R2_BUCKET_NAME | P | Storage | Yes | Optional |
| R2_ENDPOINT | P | Storage | Yes | Optional |
| R2_REGION | P | Storage | Yes | Optional |
| R2_PUBLIC_BASE_URL | E | Storage | Yes | Optional |
| DIRECT_URL | M | Database | Yes (Prisma optional) | Optional |
| TEST_DATABASE_URL | M | Database | Yes (tests) | Optional |
| ALLOW_TEST_DB_WRITES | M | QA/test safety | Yes | Optional |
| ALLOW_REMOTE_TEST_DATABASE | M | QA/test safety | Yes | Optional |
| ALLOW_EMPTY_DB_INIT | M | Migration | Yes | Optional |
| `*_ROLE_CODES` CSVs | M | Role allowlist | Yes (defaults in code) | Optional |

### Frontend (observed)

| Variable | State | Category | Referenced | Requirement |
|----------|-------|----------|------------|-------------|
| VITE_API_BASE_URL | P | API URL | Yes | Required |
| VITE_APP_ORIGINS | P | Frontend URL | Yes | Optional |
| VITE_API_VERSION | M | API URL | Yes (defaults `v1`) | Optional |

No Backend secrets found under `VITE_*` prefixes. No non-`VITE_` keys in Frontend env.

---

## 4. Missing variables (vs `.env.example` / common ops)

Present in example / commonly expected but absent from active Backend `.env`:

- `PASSWORD_RESET_OTP_EXPIRY_MINUTES`
- `PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS`
- `PASSWORD_RESET_OTP_MAX_ATTEMPTS`
- `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES`
- `OPENAI_API_KEY`
- `AI_RATE_LIMIT_MAX` / `AI_RATE_LIMIT_WINDOW_MS`
- `FIELD_TRAINING_AI_RATE_LIMIT_*`
- `FILE_UPLOAD_RATE_LIMIT_*`

Code supplies defaults for most of these when unset — **not blockers for classification**, but password-reset OTP tunables fall back to code defaults.

**Critical missing/invalid:** `JWT_SECRET` key exists but value length **0**.

---

## 5. Unknown / extra variables

Keys present in active Backend env but not listed in `.env.example`:

- `JWT_SECRET_MIN_LENGTH`
- `TRUST_PROXY`
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`
- `YOUTUBE_API_KEY`

All of these **are referenced** by Backend config/code — not obsolete.

No truly unknown unreferenced keys detected in the active files.

---

## 6. Database classification (static)

| Attribute | Result |
|-----------|--------|
| Present | Yes |
| Scheme | PostgreSQL |
| Provider | **Neon** (host pattern) |
| Local/remote | **Remote** |
| Pooled/direct | **Pooled-likely** (pooler marker) |
| SSL | Present or implied by Neon host |
| Host fingerprint (SHA-256→10) | `82eea2790f` |
| Database-name fingerprint | `693fe5919f` |
| `DIRECT_URL` | Missing |
| `TEST_DATABASE_URL` | Missing |
| `DATABASE_URL` == `TEST_DATABASE_URL` | N/A (test URL missing) |
| Naming appearance | **unknown_neon_defaultish** (no staging/prod/dev token in name pattern) |
| Confidence | Medium for Neon/remote; **low for ownership (prod vs staging vs shared)** |

### Dangerous DB-related flags

| Flag | State |
|------|-------|
| ALLOW_TEST_DB_WRITES | Missing (safe default) |
| ALLOW_REMOTE_TEST_DATABASE | Missing (safe default) |
| ALLOW_EMPTY_DB_INIT | Missing (safe default) |

### Immediate flags

- **Remote DATABASE_URL with unknown ownership** — treat as unsafe for writes.
- Host fingerprint **differs** from previously observed Neon host fingerprint in prior session metadata (`490f81350f` ≠ `82eea2790f`) — URL changed; **do not assume** same database as earlier Neon checks.
- No prior documented DB-name fingerprint to compare.

---

## 7. URL / CORS classification

| Item | Classification |
|------|----------------|
| `CORS_ORIGINS` | **Local** (1 origin; no wildcard; no production-like marker) |
| `VITE_API_BASE_URL` | **Local** |
| `VITE_APP_ORIGINS` | **Local** |
| `PUBLIC_BASE_URL` | **Empty / missing** |
| `R2_PUBLIC_BASE_URL` / `S3_PUBLIC_BASE_URL` | Empty |
| `RESEND_FROM_EMAIL` domain class | **Production-like domain** (documented product domain family) |

**Consistency:** Frontend/CORS are **local**, while database is **remote Neon**, and email-from uses a **production-like** domain. This is **mixed**.

No staging-specific URL markers found.

Documented production hosts (`lms.battechno.com`, Render API) are **not** present as active Frontend/CORS targets in this snapshot.

---

## 8. Email / AI / storage classification

| Integration | Classification | Notes |
|-------------|----------------|-------|
| Resend (`RESEND_API_KEY`) | **Production-looking** (non-empty key) | Live email risk if app started |
| `RESEND_FROM_EMAIL` | Production-like domain | — |
| AI (`AI_PROVIDER=gemini` + `GEMINI_API_KEY`) | **Production-looking** | Live AI risk if FT AI invoked |
| OpenAI | Missing key | — |
| Storage (`STORAGE_BACKEND=r2` + R2 credentials) | **Production-looking R2** | Bucket name has **no** staging/qa/dev/test marker |
| YouTube API key | Present (unknown sandbox status) | — |
| Puppeteer / webhooks | Not configured via env in this file | — |

**Flags:** Live email + live AI + live R2 combined with an **unowned remote Neon** and **local** SPA URLs = unsafe for staging QA and unsafe to treat as isolated local.

---

## 9. Authentication and role findings

| Check | Result |
|-------|--------|
| NODE_ENV | `development` |
| JWT_SECRET | **Empty — fail** |
| JWT placeholder detection | N/A (empty) |
| JWT_EXPIRES_IN | Set |
| `program_admin` in any role env CSV | **None** (only `STUDENT_ROLE_CODE` / `SUPER_ADMIN_ROLE_CODE` present) |
| Role CSV overrides | Absent → code defaults apply; runtime strip of deprecated roles still applies in code |
| Debug stack exposure flags | No explicit debug-expose env found |
| Test write flags | Not enabled |
| Cookie/security dedicated env | Not present (app defaults) |

**NODE_ENV inconsistency:** `development` + local CORS/FE URLs, but remote Neon + live Resend/Gemini/R2.

---

## 10. Comparison with repository expectations

| Expectation source | Observation |
|--------------------|-------------|
| `backend/.env.example` | Active file is richer on R2/Resend/AI; thinner on password-reset OTP tunables and AI rate limits |
| `backend/src/config/env.js` | Empty `JWT_SECRET` would fail min-length / auth startup expectations |
| Frontend loaders | Only need `VITE_API_BASE_URL` — present, local |
| `docs/DEPLOYMENT.md` production URLs | Not used as active FE/CORS targets here |
| Doc 30 / 35 staging placeholders | `$STAGING_*` URLs still **not** present — this env is **not** confirmed staging |
| Dangerous code defaults if started | Empty JWT; `STORAGE_BACKEND` default would be local **but** active file forces `r2`; AI enabled via gemini |

---

## 11. Final classification

### **D. Mixed configuration — unsafe**

Not A (production): `NODE_ENV=development`, local CORS/FE, ownership of Neon unknown.  
Not B (isolated staging): no staging URL markers; live integrations; remote DB ownership unproven; empty JWT.  
Not C (local/dev safe): remote Neon + live Resend/Gemini/R2.  
Not pure E: mixing is positively evidenced (local URLs ↔ remote DB ↔ live providers).

**Until human ownership confirmation, treat as unknown-unsafe for any database write.**

---

## 12. Commands allowed next

Static / no-network only:

- Continue editing documentation.
- Inspect source code.
- Run **pure unit tests that do not load `.env` DATABASE_URL** only if explicitly isolated (prefer not running any Backend test entrypoints that import `config/env` until JWT is fixed and DB ownership confirmed).
- `git status` / read-only git inspection.

**Recommended immediate human actions (no DB):**

1. Confirm Neon project ownership (prod vs staging vs shared).  
2. Set a non-empty staging-or-local JWT secret locally (do not commit).  
3. Disable or sandbox Resend / Gemini / R2 for local or staging QA.  
4. Align URLs: either all-local DB or all-staging URLs + isolated staging DB.

---

## 13. Commands still forbidden

Until classification becomes B or confirmed safe C:

- Start Backend or Frontend against this env
- Any Prisma migrate / status / deploy / resolve / db push / db execute / Studio
- `db:init-empty`, baseline init, seeds, cleanup scripts
- Integration tests
- Any PostgreSQL client connection
- Email / AI / R2 / YouTube live calls
- Staging bootstrap / QA data writes (`QA-STAGING-ENV-001` and smoke)
- Production deploy / tag / Neon writes

---

## 14. Required human confirmations

1. Who owns Neon host fingerprint `82eea2790f` / dbname fingerprint `693fe5919f`? (prod / staging / other)  
2. Is R2 bucket intended for production or a dedicated staging/dev bucket?  
3. Should Resend and Gemini be disabled for local/staging QA?  
4. Intended topology: local SPA → local API → local Postgres **or** staging SPA → staging API → staging Postgres?  
5. Provide non-empty `JWT_SECRET` appropriate to that topology.  
6. If staging: provide `$STAGING_FRONTEND_URL` / `$STAGING_API_URL` matching that stack.

---

## 15. Safe rollback procedure

1. Do **not** commit `.env`.  
2. Restore the previous known-local `.env` from the operator’s private backup (outside git) if needed.  
3. Keep fingerprints from this report for change detection.  
4. Re-run **ENV-PREFLIGHT-001** after any env replacement before connecting.  
5. If a wrong remote DB was ever written later, restore from provider backup — **not applicable yet** (no connection this task).

---

## Fingerprint register (this preflight)

| Secret | Backend |
|--------|---------|
| DATABASE_URL | present · fp `7643db74e8` |
| Host | fp `82eea2790f` |
| DB name | fp `693fe5919f` |
| DIRECT_URL | missing |
| TEST_DATABASE_URL | missing |
| JWT_SECRET | **empty** |
| RESEND_API_KEY | present · fp `1439396cc2` |
| GEMINI_API_KEY | present · fp `994d82a47c` |
| OPENAI_API_KEY | missing |
| R2_ACCESS_KEY_ID | present · fp `50a61e2519` |
| R2_SECRET_ACCESS_KEY | present · fp `7508b12117` |
| YOUTUBE_API_KEY | present · fp `c6d0356ef8` |

Prior session Neon host fp (from earlier error hostname only): `490f81350f` — **different** from current.

---

## QA-STAGING-ENV-001 gate

**May NOT begin.** Classification is **D (mixed/unsafe)**. Isolated staging (B) is not established.

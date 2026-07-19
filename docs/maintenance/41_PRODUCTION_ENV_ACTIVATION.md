# 41 — Production Environment Activation (PROD-ENV-ACTIVATION-001)

**Date:** 2026-07-18  
**RC application commit:** `1cfe2f4fb0c8b30fea3df5187a17d5071d562db3`  
**Owner decision:** Active `.env` approved as authoritative production configuration (supersedes ENV-PREFLIGHT-001 “mixed/unsafe” *quarantine* posture; historical preflight retained in doc 39).

**No production deploy. No production tag. No secret values in this document.**

---

## 1. Git / environment safety

| Check | Result |
|-------|--------|
| `backend/.env` ignored | Yes (`backend/.gitignore`) |
| `frontend/.env` ignored | Yes (`frontend/.gitignore`) |
| Tracked secret env files | None (only `backend/.env.example`) |
| Staged `.env` | None |
| Secrets in Git diffs | None intended; env files not commit candidates |
| Secrets in documentation | None |

---

## 2. JWT secret

| Item | Result |
|------|--------|
| Generated | **Yes** (64 cryptographically random bytes, base64url) |
| Environment updated | **Yes** (`backend/.env` only) |
| Hosting secret manager updated | **No** (Render CLI/dashboard not available in this session) |
| Strength | 64-byte random · length ≥ 86 · `JWT_SECRET_MIN_LENGTH=64` |
| Fingerprint (SHA-256→10) | `eec7827fb0` |
| Startup validation | Hardened via `jwtSecretValidation.js` (missing/empty/placeholder/min length) |
| Unit tests | `tests/jwtSecretValidation.test.js` — pass |

**Manual action:** Set the same `JWT_SECRET` on the Render (or host) service secret store before cutover so local activation and hosted API match.

---

## 3. Production URLs (resolved)

| Role | Value used | Source |
|------|------------|--------|
| Frontend | `https://lms.battechno.com` (+ `https://www.lms.battechno.com`) | Documented + hardcoded CORS allowlist |
| API | `https://lms-7txx.onrender.com` | `docs/DEPLOYMENT.md`; **live `/health` 200** (`battechno-lms-api`) |
| Alternate comment host `lms-vnto.onrender.com` | **Not used** | `/health` → **404** |

Active ignored env updates:

- Backend: `NODE_ENV=production`, `PUBLIC_BASE_URL=<API>`, `CORS_ORIGINS=<FE>,<www>`, `TRUST_PROXY=true`
- Frontend: `VITE_API_BASE_URL=<API>`, `VITE_APP_ORIGINS=<FE>,<www>`
- No localhost left in those production URL settings
- No wildcard CORS
- Email OTP templates use OTP codes (no embedded frontend link dependency); SPA routes remain on production FE domain

---

## 4. Runtime / safety flags

| Flag / setting | Status |
|----------------|--------|
| NODE_ENV | `production` |
| TRUST_PROXY | `true` |
| ALLOW_TEST_DB_WRITES | Absent |
| ALLOW_REMOTE_TEST_DATABASE | Absent |
| ALLOW_EMPTY_DB_INIT | Absent (not persisted) |
| program_admin in role env lists | None |
| JWT_EXPIRES_IN | Set (`7d`) |
| Rate limits / OTP limits | Present or code defaults |
| Body limit | 2mb (app) |

Known open risks (unchanged):

- **QA-AUTH-001** — logout does not revoke JWT  
- **QA-AUTH-003** — password reset does not invalidate existing access JWTs  

---

## 5. Variable readiness inventory (secret-free)

| Variable | Required | Present | Corrected | Production-ready |
|----------|---------:|--------:|----------:|-----------------:|
| NODE_ENV | Yes | Yes | Yes → production | Yes |
| DATABASE_URL | Yes | Yes | Owner-approved Neon | Yes (connect OK) |
| DIRECT_URL | No | No | — | N/A |
| JWT_SECRET | Yes | Yes | Generated | Yes locally; **host sync pending** |
| JWT_EXPIRES_IN | Yes | Yes | Verified | Yes |
| JWT_SECRET_MIN_LENGTH | Rec. | Yes | Set 64 | Yes |
| Frontend URL (CORS / VITE_APP_ORIGINS) | Yes | Yes | Prod HTTPS | Yes |
| API URL (PUBLIC_BASE / VITE_API) | Yes | Yes | `lms-7txx` HTTPS | Yes |
| PUBLIC_BASE_URL | Yes | Yes | Was empty → API | Yes |
| CORS_ORIGINS | Yes | Yes | Localhost removed | Yes |
| RESEND_API_KEY | For email | Yes | — | Yes (config) |
| RESEND_FROM_EMAIL | For email | Yes | prod-like domain | Yes |
| AI_PROVIDER / GEMINI_API_KEY | If AI on | Yes | gemini + key | Yes (config) |
| R2 credentials | If r2 | Yes | STORAGE_BACKEND=r2 | Yes; health OK |
| R2_PUBLIC_BASE_URL | Optional CDN | Empty | — | Optional gap |
| YOUTUBE_API_KEY | Optional | Yes | Backend-only | Yes |
| Upload / rate limits | Rec. | Partial / defaults | — | Yes |
| Test/migration danger flags | Must off | Off | — | Yes |
| Role env (no program_admin) | Yes | Clean | — | Yes |

---

## 6. Provider summary

| Provider | Status |
|----------|--------|
| Resend | Key present; from-address domain consistent; no test send |
| Gemini | Provider + key present; Backend-only |
| R2 | Required fields present; `npm run r2:health` **ok** |
| YouTube | Key present; Backend-only |

---

## 7. Validation executed

| Check | Result |
|-------|--------|
| Backend unit | **318 pass** (includes JWT validation) |
| Frontend unit | **42 pass** |
| Frontend build | Pass; prod API embedded; **0** localhost; **0** secretish patterns |
| Integration (disposable local PG only) | **8 pass**; TEST URL ≠ Neon DATABASE_URL |
| Baseline validate | v1 OK |
| Local Backend `/health` + `/health/ready` | 200 / ready db:true (stopped after) |
| Prisma validate | Pass |
| prisma:check-history | History OK; **1 pending** (see doc 42) |

---

## 8. Manual actions remaining

1. **Apply pending migration** on approved Neon: review then `npx prisma migrate deploy` (only `20260718120000_academic_submission_uniqueness`).  
2. **Sync JWT_SECRET** to Render/hosting secrets (fingerprint `eec7827fb0` locally).  
3. Optionally set `R2_PUBLIC_BASE_URL` if a public CDN origin is required.  
4. Redeploy FE+API from RC after migration + secret sync (separate deploy task).

---

## 9. Verdict pointer

See `43_PRODUCTION_DEPLOYMENT_READINESS.md`.

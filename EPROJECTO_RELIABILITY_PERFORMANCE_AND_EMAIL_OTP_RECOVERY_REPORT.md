# EPROJECTO RELIABILITY, PERFORMANCE & EMAIL OTP RECOVERY REPORT

**Date:** 2026-10-28  
**Execution:** LOCAL FIXES + READ-ONLY PRODUCTION DIAGNOSTICS  
**Production modified:** NO  
**Suggested commit:** `fix: improve platform reliability performance and otp delivery`

---

## 1. Executive Summary

Multiple independent root causes explain the reported symptoms:

| Priority | Finding |
|----------|---------|
| **P0** | Backend process **SIGSEGV** crashes (RestartCount=5) → Nginx **502** / client **499** during login, register catalog, lists |
| **P0** | Host **reboot ~20 minutes** before diagnosis → connection resets across apps |
| **P0** | Password-reset / verification email failures previously **threw after OTP persist** → **500** (and broke forgot-password anti-enumeration) |
| **P1** | App in **Paris (Hostinger)** ↔ Neon Postgres **us-east-2** → warm `SELECT 1` ≈ **500 ms** floor on every DB round-trip |
| **P1** | Resend API key is present; sender is `onboarding@resend.dev` (temporary). Provider **accepts** probe sends (HTTP 200). Inbox delivery ≠ API accept |
| **P2** | Users search uses `ILIKE`/`contains` insensitive; lists are paginated (max 100/300) |

Local code fixes address email soft-fail, Resend HTTP timeout, Prisma pool defaults, GET retries, safer logging. **Deploy required** for production effect. SIGSEGV + region mismatch need ops follow-up.

---

## 2–7. Connection Failures / HTTP / Containers / Resources / Nginx / Backend

### Connection failure classification (evidence)

| Code / signal | Count (recent access.log sample) | Meaning |
|---------------|----------------------------------|---------|
| **499** | ~120 API (70× `/api/auth/login`) | Client closed while waiting (slow upstream / user abort) |
| **502** | 47 (20× `/api/v1/users`) | Upstream (frontend→backend) unavailable — aligns with backend crashes/restarts |
| **504** | few | Upstream timed out |
| **upstream timed out** | login, register/universities, landing-stats | Backend too slow or stuck; host nginx → `:8080` |
| **SIGSEGV** | repeated in backend logs | Native crash of Node/`start-production` process |
| **OOM** | false | Not OOMKilled |

### Container stability

| Container | Restarts | OOM | Status |
|-----------|----------|-----|--------|
| battechno-lms-backend | **5** | no | healthy (after restart) |
| battechno-lms-frontend | 0 | no | healthy |

Host uptime at diagnosis: **~20 minutes** (reboot). Memory: 15 GiB, ~1.5 GiB used. CPU load ~0.15. Disk 11%. Backend mem ~85 MiB / 1.5 GiB limit.

### Nginx

- Host `eprojecto.com` → `127.0.0.1:8080` (frontend container), `proxy_read_timeout 300s`
- Frontend nginx `/api/` → `http://backend:4000`, `proxy_read_timeout 300s`
- Timeouts are **not** the primary bug; backend unavailability/slowness is

### Backend

- Node **v20.19.6**, `NODE_ENV=production`
- Prisma migrate on start against Neon direct host (pooler stripped)
- Uncaught exception handler previously `console.error(err)` — hardened to JSON without dumping full objects

---

## 8–12. Database

| Item | Value |
|------|-------|
| Provider | Neon |
| Runtime URL | `*-pooler*.us-east-2.aws.neon.tech` (pooled) |
| App region | Paris / Hostinger (`187.55.228.232`) |
| DB region | **us-east-2** |
| App↔DB concern | **YES** (~transatlantic RTT) |
| SELECT 1 (warm) | **506–509 ms** (5 samples; cold 1266 ms) |
| `/health` | ~2–3 ms (no DB) |
| `/health/ready` | ~480–1100 ms (DB) |
| users.count | 716 @ ~510 ms |
| PrismaClient | Single factory in `config/db.js` (now always global singleton) |
| Pool (runtime before deploy) | connection_limit=25, pool_timeout=20, pgbouncer=true |
| Pool (local fix default) | pooler default **connection_limit=10** |
| Pool timeout errors in logs | Not dominant in 6h sample; SIGSEGV / email failures dominated |

Email is **outside** DB transactions for both verification and password-reset OTP (persist txn → then send).

---

## 13–16. Login / Registration / Search / Fetch

### Login

- Path does bcrypt (cost **10** — normal) + DB lookups; each DB hop pays ~500 ms RTT
- 499 storm on `/api/auth/login` when backend was dead/slow after SIGSEGV
- No unrelated analytics blocking identified in login hot path

### Registration

- Payload: `full_name, email, password, university_id, university_specialty_id, phone?`
- User create commits before OTP email
- Prior local fix: `emailDeliveryFailed` soft-fail (must be **deployed**)
- Production still showed register **409** retries after earlier create/email issues

### Search / lists

- Users list: paginated (`page_size` default 20, max 100 general / 300 admin)
- Search: `full_name` / `email` `contains` insensitive → SQL `ILIKE`
- No new trigram migration in this pass (needs EXPLAIN on prod under load)
- N+1: list path uses repository `findManyForList` with bounded take — not fully profiled for every FT route

### Frontend fetch

- Axios timeout 30s
- **New:** one controlled retry for **GET** on network / 502–504 only; **never** login/register/forgot-password mutations

---

## 17–22. Email provider

| Item | Evidence |
|------|----------|
| Provider | **Resend** |
| Expected env | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Host `.env` path | `/root/BATTECHNO_LMS/backend/.env` (root `.env` absent) |
| Compose | `env_file` → backend `.env` |
| Key in host file | SET len=36 prefix `re_W…` |
| Key in container | SET (matches) |
| `RESEND_KEY` mismatch | absent (good) |
| Sender | `onboarding@resend.dev` (display name eprojecto) |
| Domains API | 401 restricted_api_key (send-only key — expected) |
| Probe send (configured From → `delivered@resend.dev`) | **HTTP 200** + message id |
| Probe send (`onboarding@resend.dev`) | **HTTP 200** |
| Domain verification for custom domain | **REQUIRES_PROVIDER_ACTION** for `eprojecto.com` / remove temporary From |
| Password reset failures logged today | `Failed to send password reset email` → then SIGSEGV |

Inbox arrival was **not** proven (provider accept ≠ inbox). Users should check spam; long-term use verified domain From.

---

## 23–27. OTP flows

| Flow | Persist | Send | Soft-fail (local) |
|------|---------|------|-------------------|
| Registration verification | hash in DB, invalidate prior | Resend | yes (`deliveryFailed`) |
| Resend verification | new OTP | Resend | 503 `EMAIL_DELIVERY_FAILED` if send fails |
| Password reset | hash in DB | Resend | **yes (new)** — forgot-password always generic success |
| Expiry | 10 minutes (env) | | |
| Attempts | max 5 | | |
| Plaintext OTP logged | **NO** | | |
| Purpose binding | separate tables/services | | |

---

## 28a. Follow-up from code audit (same local pass)

Addressed findings from the Prisma/email/search audit that were still open after the first fix wave:

| Finding | Action |
|---------|--------|
| Unbounded `findManyForExport` | Cap **5000** + `EXPORT_TOO_LARGE` 400 if matched rows exceed cap |
| `findUserIdsByRoleCode` double query (orphans) | Single `user_roles` query; orphans harmless in users filter |
| `PRISMA_CONNECTION_LIMIT` default 25 vs pooler guidance | Default **10** in `env.js` + `docker-compose.yml` |
| Password-reset email 500 after persist | Already soft-failed in this branch (audit snapshot was pre-fix) |

---

## 28. Fixes Implemented (local only)

1. **`email.service.js`**: Resend via `fetch` + Abort timeout; error categories; safe probe helper; no OTP in logs  
2. **`passwordReset.service.js`**: soft-fail delivery after persist; preserve anti-enumeration  
3. **`db.js`**: Prisma singleton on `globalThis` in production too  
4. **`prismaPoolUrl.js`**: lower default pooler `connection_limit` (10)  
5. **`pagination.js`**: admin max page size 300 (was 500)  
6. **`server.js`**: structured uncaught/unhandled logs without dumping secrets  
7. **`apiClient.js`**: safe GET retry once  
8. **`apiHelpers.js`**: clearer network vs 5xx messages + requestId  
9. **`scripts/probe-email-delivery.js`**: internal CLI probe  
10. Prior registration OTP soft-fail / RTL / password min=8 retained  

**Not changed in production:** env, containers, Nginx, Neon region.

---

## 29. Before / After Metrics

| Operation | Before (prod measured) | After (local code; prod unchanged until deploy) | Result |
|---|---:|---:|---|
| DB SELECT 1 | 506–509 ms warm | same until DB closer / caching | Region-bound |
| Login | many 499/502 during crashes | needs deploy + crash fix | Partial |
| Registration core | OK until email; 500 on email fail (old image) | soft-fail in repo | Code ready |
| Search users | paginated; ILIKE | same + page cap 300 | Bounded |
| Representative list | 502 spikes when backend down | GET retry helps transient 502 | Code ready |
| OTP provider call | 200 with `onboarding@resend.dev` | + timeout + categories | API OK |

---

## 30. Tests

- `tests/email.delivery.unit.test.js`
- `tests/auth.passwordReset.emailDelivery.unit.test.js`
- `tests/auth.register.emailDelivery.unit.test.js`
- `tests/auth.register.validation.unit.test.js`
- `frontend/tests/apiClient.reliability.test.js`
- Register form presentation tests

All of the above **passed** locally.

---

## 31. Remaining Production Configuration Work

1. **Deploy** backend+frontend images with these fixes  
2. **Investigate SIGSEGV** (likely Chromium/Puppeteer PDF in-process) — isolate PDF worker or disable crashy path until fixed  
3. Verify **DIRECT_URL** for migrate (optional; start script already strips `-pooler`)  
4. Resend: verify **`eprojecto.com`** (or chosen domain), create domain-scoped key, set `RESEND_FROM_EMAIL=no-reply@eprojecto.com`  
5. Consider Neon project in **EU** (or app closer to us-east-2) to cut ~500 ms/query  
6. Add `request_time`/`upstream_response_time` to nginx logs if missing  
7. Controlled inbox test to a designated mailbox after deploy  

---

## 32. Deployment Plan

1. Build/push images from this branch  
2. Backup `backend/.env`  
3. `docker compose up -d --build backend frontend` (or rolling equivalent)  
4. Smoke: `/health`, `/health/ready`, login, register+resend OTP, forgot-password  
5. Watch `docker logs` for SIGSEGV / Resend categories for 30–60 min  

## 33. Rollback Plan

1. Redeploy previous image tags  
2. Restore `.env` from backup if sender/key changed  
3. Confirm containers healthy  

---

## Root-cause table

| Symptom | Root Cause | Evidence | Fix |
|---|---|---|---|
| Slow website | Neon us-east-2 RTT from Paris + multi-query pages | SELECT 1 ~500 ms; ready ~480 ms | Region plan; reduce queries; deploy pool tweak |
| Connection drops | Backend SIGSEGV + host reboot → 502/499 | RestartCount=5; nginx 502; SIGSEGV logs | Stabilize process; deploy; monitor |
| Slow login | DB RTT × queries + crashes | login 499/upstream timeout | Same as above |
| Slow registration | DB RTT + email wait/fail | logs | Soft-fail email; timeout |
| Slow search | ILIKE + remote DB | code + latency | Pagination caps; optional trgm later |
| Registration OTP missing | Email throw/500; domain history; inbox | Resend logs; 409 retries | Soft-fail + verified From + deploy |
| Password reset OTP missing | Send threw → 500 after persist | logs 14:11Z | Soft-fail + anti-enum preserved |

---

## Diagnostic matrix (A–O)

| Area | Status |
|------|--------|
| A Browser/FE | Timeout 30s; GET retry added; mutation no-retry |
| B DNS/TLS/HTTP | Site up; failures are upstream |
| C Host Nginx | 300s timeouts; proxies to :8080 |
| D FE Nginx | Proxies `/api` → backend:4000 |
| E Backend | SIGSEGV instability |
| F Prisma | Singleton + pooler params |
| G Neon | us-east-2 pooler; ~500 ms |
| H Docker | Backend restarts; no OOM |
| I Auth | Login hit by 499/502 |
| J Registration | Soft-fail path in repo |
| K Search | Paginated; ILIKE |
| L Email | Resend; key present; From temporary |
| M OTP persist | Hash; before send |
| N OTP verify | Existing |
| O Password reset | Soft-fail added |

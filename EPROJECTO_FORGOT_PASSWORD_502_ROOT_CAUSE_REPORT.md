# EPROJECTO FORGOT PASSWORD 502 — ROOT CAUSE REPORT

**Date:** 2026-10-28 (UTC)  
**Scope:** Read-only production diagnostics + local code hardening  
**Production modified:** NO (no restart, no env change, no deploy)  
**Suggested commit (not executed):** `fix: stabilize password reset and email otp delivery`

---

## 1. Exact 502 cause

`POST /api/auth/forgot-password` returned **502** because the **backend Node process died with `SIGSEGV`**, so the frontend-container Nginx had no healthy upstream on `http://backend:4000`.

This was **not** primarily:

- a Resend API-key absence (key present and non-empty in runtime)
- a proxy timeout alone (request died while backend was restarting / down)
- a Prisma pool error on the forgot-password path during the 20:38 cluster

Timeline (UTC 2026-10-28):

| Time | Event |
|------|--------|
| ~20:37:55 | Frontend Nginx: `upstream prematurely closed connection` on many APIs |
| ~20:37:56+ | Frontend Nginx: `connect() failed (111: Connection refused)` → backend port dead |
| 20:38:39 | User `POST /api/auth/forgot-password` → **502** (`upstream prematurely closed`) |
| 20:38:42–43 | Retries → **502** (`Connection refused`) |
| 20:42:52 | Backend container `StartedAt` after restart cycle (`RestartCount=3`) |
| After healthy | Safe unknown-email probe → **HTTP 200** ~608 ms |

Earlier same day (pre soft-fail deploy / older path): many forgot-password calls returned **500** (application error from email throw), and some **499** (client abort while waiting). Those are related reliability symptoms but distinct from the 20:38 **502**.

---

## 2. Exact Nginx upstream error

**Frontend container Nginx** (the proxy that talks to Express):

```text
2026/10/28 20:38:39 [error] 23#23: *403 upstream prematurely closed connection while reading response header from upstream, client: 172.19.0.1, server: _, request: "POST /api/auth/forgot-password HTTP/1.1", upstream: "http://172.19.0.2:4000/api/auth/forgot-password", host: "eprojecto.com", referrer: "https://eprojecto.com/forgot-password"
```

Followed by:

```text
2026/10/28 20:38:42 [error] 22#22: *413 connect() failed (111: Connection refused) while connecting to upstream, ... request: "POST /api/auth/forgot-password HTTP/1.1", upstream: "http://172.19.0.2:4000/api/auth/forgot-password"
2026/10/28 20:38:43 [error] 22#22: *415 connect() failed (111: Connection refused) while connecting to upstream, ... request: "POST /api/auth/forgot-password HTTP/1.1", upstream: "http://172.19.0.2:4000/api/auth/forgot-password"
```

Host Nginx access log recorded the same POSTs as **502** at 20:38:39 / 20:38:42 / 20:38:43.

---

## 3. Backend process state

At diagnosis (~20:47 UTC):

| Field | Value |
|-------|--------|
| Container | `battechno-lms-backend` |
| Status | `running` / Health `healthy` |
| RestartCount | **3** |
| OOMKilled | **false** |
| ExitCode | 0 (current) |
| StartedAt | `2026-10-28T20:42:52Z` |
| FinishedAt (prior) | `2026-10-28T20:42:52Z` |

Backend logs repeatedly show:

```text
npm error signal SIGSEGV
```

then process restart and `eprojecto API listening on port 4000`.

---

## 4. Backend exception

**Native crash:** `SIGSEGV` (segfault of the Node/`npm` start process).  
Not a caught Express `ApiError`. Not a logged Prisma `P1001`/`P2024` on the forgot-password 502 window.

Email failures earlier in the day logged as soft/hard delivery failures (`Failed to send password reset email`) — those map to **500** historically, not process death by themselves once soft-fail is present.

---

## 5. Last successful forgot-password stage

During the 20:38 **502**, Express did **not** complete a response for those POSTs (upstream closed / refused).  
After restart, a safe probe logged:

```text
POST /api/auth/forgot-password 200 … 608.607 ms
```

Local code now emits structured stages (pending deploy):

`START` → `USER_LOOKUP_DONE` → `OTP_CREATED` / `ACCOUNT_NOT_FOUND` → `EMAIL_SEND_*` → `RESPONSE_SENT`  
plus outer `FORGOT_PASSWORD_UNEXPECTED` catch that still returns anti-enumeration success.

---

## 6. Database result

| Check | Result |
|-------|--------|
| `/health/ready` | `database: connected` |
| Unknown-email forgot-password | Lookup completes; anti-enumeration 200 |
| Prisma clients | Single factory `config/db.js` (`new PrismaClient` once) |
| Email inside `$transaction` | **NO** — OTP txn commits, then send |

Paris app ↔ Neon `us-east-2` still adds ~500 ms RTT floor (documented in reliability report); not the 502 mechanism.

---

## 7. OTP generation result

| Scenario | Result |
|----------|--------|
| Unknown email | No OTP row; generic success |
| Known email (deployed soft-fail path) | Persist hash → send → soft-fail if provider errors; public still generic success |
| OTP plaintext logged | **NO** (hash only; send payload not logged) |

---

## 8. Email provider

**Resend** via `fetch('https://api.resend.com/emails')` in `backend/src/shared/services/email.service.js`.

Shared by:

- Registration verification OTP  
- Password-reset OTP  
- Resend verification OTP  

---

## 9. Runtime API-key presence

| Check | Result |
|-------|--------|
| Expected variable | `RESEND_API_KEY` |
| Present in backend runtime | **YES** |
| Non-empty | **YES** |
| Sender var | `RESEND_FROM_EMAIL` |
| Runtime From | `onboarding@resend.dev` |

Host file is `backend/.env` (compose `env_file`); no `EMAIL_API_KEY` mismatch.

---

## 10. Sender / domain state

| Item | State |
|------|--------|
| Sender configured | YES (`onboarding@resend.dev`) |
| Custom domain `eprojecto.com` as From | **ACTION_REQUIRED** (verify domain / move off temporary Resend onboarding From for production inbox trust) |
| Prior probe (reliability report) | Provider accepted probe sends with HTTP 200 |

---

## 11. Provider response

When backend is healthy:

- Soft-fail path catches provider errors; does not throw out of `issuePasswordResetOtp`.
- Timeout: `RESEND_HTTP_TIMEOUT_MS` (default **10000**, clamped 3000–20000) via `AbortController`.

502 window had **no provider response** for the failed POSTs — process was already dying / dead.

---

## 12. Fix (local, not deployed in this task)

1. **`passwordReset.service.js`**: stage logs + outer catch → always generic `FORGOT_SUCCESS` (never unexpected 5xx for forgot-password). Soft-fail email already present on prod (`ddc9e40`).
2. **`email.service.js`**: Resend timeout + error classification (already on prod).
3. **`pdfRenderer.js`**: **lazy `require('puppeteer')`** so auth paths never load Chromium at module init (mitigation for native crash risk; deploy required).
4. **`ForgotPasswordPage.jsx`**: map 502/503/504/network to Arabic outage copy; LTR email; no auto-retry.
5. Unit/UX tests for soft-fail + UX mapping.

---

## 13. Regression tests (local)

| Test | Result |
|------|--------|
| `auth.forgotPassword.stability.unit.test.js` (provider 401/timeout/500/domain) | PASS |
| Soft-fail never throws | PASS |
| Finite Resend timeout | PASS |
| `forgotPassword.ux.test.js` | PASS |
| OTP logged | NO |

---

## 14–16. OTP path matrix

| Path | Persist→send (no email in txn) | Soft-fail | Prod note |
|------|--------------------------------|-----------|-----------|
| Registration OTP | YES | YES (`deliveryFailed`) | Deployed soft-fail on `ddc9e40` |
| Forgot-password OTP | YES | YES | Deployed soft-fail; local + stage/catch pending |
| Resend verification OTP | YES | YES (may surface controlled 503 for known user) | Shared Resend client |

Live production writes for real accounts were **not** performed in this task.

---

## 17. Before / after timing

| Measurement | Value |
|-------------|--------|
| Before (502 window) | No valid upstream response (process dead) |
| After healthy unknown-email probe | **~608 ms** total (lookup only) |
| 10 concurrent unknown emails | all **200**, ~0.6–1.1 s; RestartCount unchanged; `/health` ok |

---

## 18. Production actions still required

1. **Deploy** local hardenings (stage logs, outer catch, lazy Puppeteer, FE 502 UX).  
2. **Investigate SIGSEGV** under load (Chromium/Puppeteer PDF path, native deps, Node 20). Consider isolating PDF workers or disabling Chromium in the API process.  
3. **Verify Resend domain** for `eprojecto.com` and set production From (leave temporary `onboarding@resend.dev` only until then).  
4. Optional: reduce Neon RTT (region closer to Paris) — performance, not 502 root.  
5. Do **not** “fix” by raising Nginx timeouts as the primary action.

---

## Acceptance notes

| Criterion | Status |
|-----------|--------|
| Exact 502 root cause known | YES — backend SIGSEGV → upstream closed/refused |
| Nginx error identified | YES — see §2 |
| Provider errors caught (code) | YES (local + deployed soft-fail) |
| Provider timeout | YES (`RESEND_HTTP_TIMEOUT_MS`) |
| DB txn does not hold email | YES |
| Anti-enumeration | YES |
| OTP never logged | YES |
| Local regression / concurrent unknown probes | PASS |
| Production deploy this task | **NO** |
| Recurring SIGSEGV eliminated in prod | **NOT YET** (needs deploy + native crash follow-up) |

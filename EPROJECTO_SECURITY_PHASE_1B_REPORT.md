# EPROJECTO SECURITY PHASE 1B — Server-Side Sessions, 30-Minute Idle Timeout & Secure Logout

**Execution:** LOCAL ONLY. Production was not accessed, and no production database, SSH, Nginx, Docker, or environment was touched.
**Git:** no `git add`, `commit`, `push`, PR, merge, or tag. All changes are uncommitted in the working tree.
**Suggested commit message:** `security: add server sessions and idle timeout enforcement`

---

## 1. Summary

Every successful login now creates a row in `auth_sessions`, and the session id is embedded in the JWT as the `sid` claim. Every protected request requires both a valid JWT (HS256 only, plus issuer and audience when configured) and an open server session. The server alone decides session validity:

- **Idle timeout:** 30 minutes without real human activity ends the session.
- **Background traffic:** it can never extend the session (polling, SSE, presence, heartbeats, notifications, `/auth/me`).
- **Explicit logout:** ends the session immediately, and the old JWT is then rejected with `401 SESSION_ENDED`.
- **Multi-tab:** every open tab of the same browser logs out together.
- **Credential and security changes:** password reset, admin password reset, suspension, role change, university change, and account deletion revoke the user's other sessions.
- **Audit:** the session lifecycle is audited exactly once per transition. Per-request pings are never audited.

---

## 2. Architecture

```
login ──► createSession() ──► auth_sessions row (+ AUTH_SESSION_CREATED audit)
      └─► signToken({ ..., sid })  (HS256, exp ≤ absolute expiry)

protected request
  auth.middleware:
    1. extract Bearer token (query-string tokens only for /uploads + SSE, unchanged from 1A)
    2. verifyToken()  → algorithms:['HS256'] (+ iss/aud if configured)
    3. require payload.sid (legacy tokens without sid → 401 SESSION_NOT_FOUND)
    4. authSession.validateSession({ sid, userId })
         - 10s in-process cache; a cached "expired" verdict is re-read from DB before ending
         - ended / inactive         → 401 SESSION_ENDED | SESSION_IDLE_TIMEOUT | SESSION_ABSOLUTE_EXPIRED
         - now ≥ absolute_expires_at → end ABSOLUTE_EXPIRY (one audit event) → 401
         - now − last_activity_at ≥ idle → end IDLE_TIMEOUT (one audit event) → 401
    5. notePresenceInBackground()  → last_seen_at only, throttled 60s, fire-and-forget
    6. DB-authoritative auth context (role/university/status, 15s cache)

POST /api/auth/session/activity   → recordActivity(): last_activity_at (throttled 30s server-side)
POST /api/auth/session/presence   → recordPresence(): last_seen_at only
GET  /api/auth/session            → session timing for the client (idle/warning minutes, remaining)
POST /api/auth/sessions/current/end and POST /api/auth/logout → endSession(USER_LOGOUT)

sweeper (every 5 min) → closes idle/absolute-expired sessions nobody is calling with (detectedBy: "sweeper")
```

**Key files**

| Area | File |
|---|---|
| Session service | `backend/src/modules/auth/authSession.service.js` |
| Middleware | `backend/src/middlewares/auth.middleware.js` |
| JWT | `backend/src/utils/jwt.js` |
| Config | `backend/src/config/env.js` |
| Error codes and messages | `backend/src/utils/authErrorCatalog.js` |
| Audit registry | `backend/src/shared/audit/auditActions.js` |
| Revocation call sites | `passwordReset.service.js`, `users.service.js`, `accountDeletion.service.js` |
| Student timeline | `backend/src/shared/audit/studentActivityTimeline.service.js` |
| Frontend session | `frontend/src/features/auth/session/{SessionManager.jsx,sessionPolicy.js}` |
| Frontend auth and broadcast | `frontend/src/features/auth/context/AuthContext.jsx` |
| Portal routing | `frontend/src/utils/portal.js`, `frontend/src/pages/auth/LoginPage.jsx` |

---

## 3. Schema

`auth_sessions` was created by the earlier, already committed migration `20261013150000_auth_sessions_and_audit_context`. Its columns:

| Column | Purpose |
|---|---|
| `id` UUID PK | The JWT `sid` |
| `user_id` UUID FK → users (CASCADE) | Session owner |
| `created_at` | Login time |
| `last_seen_at` | Presence: any authenticated traffic or presence ping (throttled) |
| `last_activity_at` | Real human activity only; drives the idle timeout |
| `absolute_expires_at` | Hard cap (default 12h) |
| `ended_at`, `end_reason` | Termination record |
| `is_active` | Open flag |
| `ip_address`, `user_agent` | Login client (via the Phase 1A trusted-proxy client IP) |
| `created_by_login_method`, `portal_type` | Login context |
| **`created_request_id` VARCHAR(128)** | **New in 1B.** Request id of the login request, for correlation with logs |

The table never stores a raw JWT, Authorization header, password, password hash, OTP, or cookie value. This is verified by the smoke test's column check.

**End reasons** (registry `SESSION_END_REASONS`; an unknown reason throws):
`USER_LOGOUT`, `IDLE_TIMEOUT`, `ABSOLUTE_EXPIRY`, `ADMIN_REVOKED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `SECURITY_REVOKED`.

## 4. Migration

- New: `backend/prisma/migrations/20261015140000_auth_sessions_created_request_id/migration.sql`. It is additive only: `ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "created_request_id" VARCHAR(128);`
- Applied locally to `lms_local` and `lms_test`.
- **Fresh-DB reproducibility:** a fresh UTF-8 database (`lms_fresh_1b`) was built with `npm run db:init-empty` (baseline) followed by `prisma migrate deploy`. All 65 migrations applied, and `migrate status` reports up to date.
  - The database must be created with `ENCODING 'UTF8' TEMPLATE template0`, because the local cluster default is WIN1252.
  - A plain `migrate deploy` on an empty DB fails by design; the baseline is required, as before 1B.
- `prisma migrate diff` shows only pre-existing, unrelated drift. Nothing touches `auth_sessions` or `audit_logs`.

## 5. JWT `sid` and hardening

- `signToken` uses `algorithm: 'HS256'` explicitly. `expiresIn` never exceeds the session's absolute expiry. `iss`/`aud` are added only when `JWT_ISSUER`/`JWT_AUDIENCE` are set.
- `verifyToken` pins `algorithms: ['HS256']` and enforces `iss`/`aud` when configured.
- Tests confirm that `alg: none`, HS512-signed tokens, and wrong `iss`/`aud` tokens are rejected.
- **Tokens without `sid`** (issued before 1B) are rejected with `401 SESSION_NOT_FOUND`. **All existing users must log in again after deployment.**
- The frontend reads the `portal_type` claim from the JWT only to choose the correct login page. This is UI routing only and never an authorization decision.

## 6. Server-side validation and the idle algorithm

`evaluateSession(row, now)` is a pure function, and its checks run in this order:

1. no row, or the row belongs to a different user → `SESSION_NOT_FOUND`;
2. `ended_at` set or `is_active = false` → the stored reason's code (`SESSION_ENDED` / `SESSION_IDLE_TIMEOUT` / `SESSION_ABSOLUTE_EXPIRED`);
3. `now ≥ absolute_expires_at` → end `ABSOLUTE_EXPIRY`, `ended_at = absolute_expires_at`;
4. `now − last_activity_at ≥ idleTimeout` → end `IDLE_TIMEOUT`, `ended_at = last_activity_at + idleTimeout`.

Boundary behavior:

- **29m59s** after the last activity → ACTIVE (unit test, plus 29m58s in the smoke test against the real DB).
- **30m00s exactly** → EXPIRED (`≥` comparison).

Concurrency and the cache:

- `endIfOpen` is a conditional UPDATE (`WHERE is_active AND ended_at IS NULL`). Only the first concurrent request records the audit event, so there is exactly one `AUTH_SESSION_IDLE_TIMEOUT` per session.
- If the 10s cache says "expired", the row is re-read from the DB before ending it. This avoids ending a session whose activity was recorded by another process.
- `touchActivity` is a CTE that only updates open, non-expired rows, so an activity ping can **never revive** an idle or ended session.

The idle timeout is configured by `AUTH_IDLE_TIMEOUT_MINUTES` (default **30**, bounds 1–1440). The warning lead time is configured by `AUTH_IDLE_WARNING_MINUTES` (default **5**).

## 7. `last_seen_at` vs `last_activity_at`

| | `last_seen_at` | `last_activity_at` |
|---|---|---|
| Updated by | any authenticated request (middleware), `POST /session/presence` | `POST /session/activity` only |
| Throttle | 60s per session | 30s server-side, 60s client-side |
| Extends idle timeout | **No** | **Yes** |
| Audited | Never | Never per ping. Only the one-time `AUTH_SESSION_ACTIVITY_STARTED` marker, which is hidden from the student timeline |

## 8. Activity detector, throttle, presence (frontend)

- **Human activity events:** `pointerdown`, `keydown`, `touchstart`, `wheel` (a user-initiated scroll; programmatic `scroll` events are ignored), and `popstate` navigation.
  - Only `isTrusted` events count, so synthetic or scripted events never extend the session.
  - A full page load or refresh counts as user navigation.
- The last activity time is shared across tabs in `localStorage` (writes throttled to 5s). Activity in any tab keeps all tabs alive.
- **Activity ping:** at most one `POST /session/activity` per 60s, and only after real activity.
- **Presence ping:** every 60s, only while the tab is visible; it updates `last_seen_at` only.
- The client adopts `idleTimeoutMinutes` and `warningMinutes` from server responses, so the warning and messages match the server configuration. The values are bounded and validated in `resolveIdleConfig`.
- When a tab becomes visible again, the idle state is re-evaluated immediately. Browsers throttle timers in hidden tabs, so this check covers that gap.

## 9. Idle warning UX

- **When:** 25 minutes after the last activity (5 minutes before expiry).
- **Dialog:** a modal titled "تنبيه انتهاء الجلسة" with the text "ستنتهي جلستك خلال 5 دقائق بسبب عدم النشاط." The minutes are rendered with correct Arabic grammar for other configurations.
- **Countdown:** live, `role="timer"`, `aria-live="polite"`.
- **"البقاء مسجلاً"** sends an activity ping and closes the dialog in **all** tabs.
- **"تسجيل الخروج"** performs an explicit logout.
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, focus moved inside and trapped, close button labelled "إغلاق".
- **On expiry:** redirect to the correct portal login page with `reason=SESSION_IDLE_TIMEOUT`. The page shows "انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة. يرجى تسجيل الدخول مرة أخرى." in a `role="status"` banner, and `returnTo` is preserved (safe, internal paths only).

## 10. Logout, multi-tab, error codes

- **Explicit logout:** `endSession(USER_LOGOUT)`, then the server-side cache is invalidated. The old JWT immediately gets `401 SESSION_ENDED`.
- **Multi-tab:**
  - `BroadcastChannel('eprojecto-auth')` carries `{type:'logout', event, reason}` with event `LOGOUT` / `SESSION_EXPIRED` / `SESSION_REVOKED`.
  - A `localStorage` `storage`-event fallback covers browsers without BroadcastChannel.
  - Every tab clears its token and redirects to its own portal's login page.
- **Logout triggers:** the API client logs out only on **401 with a session/token code**. 403 (authorization), 5xx, and business 401s (such as a wrong current password) do **not** log the user out.
- **Error codes:**

| Code | Meaning |
|---|---|
| `SESSION_IDLE_TIMEOUT` | Idle timeout |
| `SESSION_ABSOLUTE_EXPIRED` | Absolute expiry |
| `SESSION_ENDED` | Logout or any revocation |
| `SESSION_NOT_FOUND` | Missing or unknown `sid` |
| `TOKEN_INVALID` / `TOKEN_EXPIRED` | Bad or expired JWT |

- Each code has an Arabic client message. No internal reasons, ids, or stack traces are exposed.

## 11. Revocation on password reset and security changes

| Trigger | End reason | Scope |
|---|---|---|
| Self-service password reset (`resetPasswordWithToken`) | `PASSWORD_RESET` | All of the user's sessions |
| Admin password reset (`adminResetPassword`) | `PASSWORD_RESET` | All of the target user's sessions |
| Status → suspended/inactive (`patchUserStatus`, `updateUser`) | `SECURITY_REVOKED` | All sessions |
| **Role change** (`updateUser`) | `SECURITY_REVOKED` | All sessions (except the requester's own when self-editing) |
| **University (scope) change** (`updateUser`) | `SECURITY_REVOKED` | Same |
| Account deletion approval | `SECURITY_REVOKED` | All sessions |
| Out-of-process admin revoke | `ADMIN_REVOKED` | One session |

**Decisions**

- **Role change:** implemented (PASS).
- **University scope change:** implemented (PASS).
- **Organization-assignment changes (field-training orgs):** revocation is **DEFERRED**. Authorization already reads role, university, and status from the DB-authoritative auth context (15s cache), so stale tokens cannot keep removed permissions for longer than that.
- **`PASSWORD_CHANGED`:** registered, but no self-service "change password" endpoint exists yet. It will be wired when that flow is added.
- **Sessions & Devices management UI:** deferred to Phase 1C.

Revocation goes through `revokeUserSessionsSafely`. A failure there is logged and never blocks the password reset or status change itself.

## 12. Events

| Action | When | Count |
|---|---|---|
| `AUTH_SESSION_CREATED` | Login | 1 per session |
| `AUTH_SESSION_ACTIVITY_STARTED` | First real activity | 1 per session (technical; hidden from the student timeline) |
| `AUTH_SESSION_IDLE_TIMEOUT` | Idle end (request, sweeper, or concurrent) | Exactly 1 |
| `AUTH_SESSION_ABSOLUTE_EXPIRED` | Absolute expiry | Exactly 1 |
| `AUTH_SESSION_ENDED` | Logout or revocation (metadata `endReason`) | Exactly 1 |

- **Metadata:** `endReason`, `endedAt`, `lastActivityAt`, `detectedBy` (`request` / `sweeper` / `server`), and `idleMinutes` for idle events. Columns: `session_id`, `subject_user_id`, `request_id`, `outcome`.
- **Never in audit rows or logs:** JWTs, passwords, OTPs, cookies. Activity and presence pings produce **no** audit rows.

## 13. Student activity report

- **Shown in the timeline:** login, logout, idle timeout ("انتهت الجلسة بسبب عدم النشاط"), absolute expiry ("انتهت المدة القصوى للجلسة"), and security terminations. Terminations use Arabic reason labels: password reset, password changed, admin, security.
- **Hidden:** session creation, activity markers, pings, and security-only technical events (`AUTHORIZATION_DENIED`, `CROSS_SCOPE_ACCESS_DENIED`, `RATE_LIMIT_TRIGGERED`, `LOGIN_BRUTE_FORCE_SUSPECTED`, `OTP_*`).
- **PDF:** prints only time, action label, category, actor, outcome, and details. There is **no IP, user agent, session id, JWT, request id, or machine code**, and a unit test asserts this.

## 14. DB write rate

- **Smoke measurement:** 125 background requests (SSE, attendance status, recorded-lecture heartbeat, notifications, presence, `/me`) over one session produced **1** session write (presence) and **0** `last_activity_at` writes.
- **Per active session:**
  - at most 1 presence write per 60s;
  - at most 1 activity write per 30s server-side (the client sends at most 1 per 60s);
  - 1 write per transition (create or end).
- **Validation reads:** cached for 10s per session per process.
- **Sweeper:** one bounded UPDATE batch (≤ 500 rows) every 5 minutes.

## 15. Tests

### Backend unit (`npm run test:unit`, local test DB)

Result: **1312 tests, 1309 pass, 1 fail, 2 skipped.**

The single failure is pre-existing and unrelated to sessions: `fieldTraining.completionLetters.supervisorExcel.unit.test.js:430`.

New or extended in 1B:

- **`authSession.service.unit.test.js` (20/20):**
  - 29m59s active and 30m expired;
  - exactly one idle event and one absolute-expiry event;
  - multiple devices are independent;
  - `revokeUserSessions`, including `exceptSessionId`, and the Safely variant;
  - unknown end reason rejected;
  - `created_request_id` taken from the request context.
- **`authSession.middleware.unit.test.js` (12/12):**
  - HS256 header and expiry ≤ absolute;
  - `alg:none` and HS512 rejected;
  - `iss`/`aud` enforced;
  - legacy token without `sid` rejected;
  - background-traffic suite: 20 rounds of SSE, attendance, heartbeat, notifications, presence, and `/me` produce 0 activity writes and ≤ 1 presence write.
- **`authSession.revocation.unit.test.js` (new):** a password reset ends all sessions with `PASSWORD_RESET`, and no token or password appears in the audit.
- **`studentActivityTimeline.unit.test.js`:** revoke and absolute-expiry summaries; PDF columns contain no codes or ids; security-only actions are hidden.
- **`auditRegistry.unit.test.js`, `baselineManifest.test.js`:** updated for the new actions and migration.

### Frontend unit (`npm run test:unit`)

Result: **203 tests, 202 pass, 1 fail.**

The single failure is pre-existing and unrelated: `fieldTrainingEvaluation.ui.test.js:133`.

- **`sessionPolicy.unit.test.js` (17/17):**
  - activity events and trusted-only detection;
  - `resolveIdleConfig` bounds;
  - Arabic minute grammar;
  - warning and timeout messages;
  - broadcast event mapping;
  - logout-only-on-401-session-code;
  - portal from token.
- **`auditPresentation.unit.test.js`:** end-reason labels.
- **`vite build`:** OK.

### Local API smoke (real local PostgreSQL `lms_test`, guarded by `assertTestDatabaseWriteSafety`)

Result: **54/54 PASS.** Covered:

- login creates a session with `sid`, HS256, `created_request_id` = `X-Request-Id`, and a 12h absolute expiry; one `AUTH_SESSION_CREATED`;
- two devices are independent;
- background traffic leaves `last_activity_at` unchanged;
- activity ping updates and is throttled;
- 29m58s active, 30m → `401 SESSION_IDLE_TIMEOUT` with the exact Arabic message;
- repeated requests do not revive the session, and there is exactly one idle event;
- logout → the old JWT gets `SESSION_ENDED`;
- absolute expiry produces one event;
- legacy token without `sid` and `alg:none` are rejected;
- sweeper end is recorded with `detectedBy: sweeper`;
- admin password reset revokes all sessions, and re-login works;
- suspension and role change revoke sessions;
- timeline content is correct;
- no token or password columns, and no JWT or password in audit rows or logs.

### Browser E2E (local backend on `lms_test` with a 2-minute idle / 1-minute warning configuration)

- **Warning modal:** appears with countdown, focus inside, both buttons.
- **"البقاء مسجلاً":** closes the modal in both tabs and updates server `last_activity_at`.
- **Full timeout:**
  - both tabs log out;
  - the login page shows the idle message;
  - `returnTo` is restored after re-login;
  - DB `end_reason = IDLE_TIMEOUT` at exactly the configured idle time, with one event.
- **Explicit logout:** the second tab follows via broadcast to its own portal login page, and the old JWT gets 401.
- **Out-of-process `ADMIN_REVOKED`:** the active tab logs out with `reason=SESSION_ENDED`, and the second tab follows.
- **Refresh:** reloading with an active session keeps the user signed in.

### Responsive and accessibility

Checked via CDP device emulation for both the warning dialog and the login page with the timeout message:

| Width | Warning dialog | Login message |
|---|---|---|
| 375px | Full-width bottom sheet; full-width stacked buttons | Visible, inside the form column |
| 768px | Centered 384px dialog, inside the viewport | Visible |
| 1024px | Centered | Visible |
| 1440px | Centered | Visible |

At every width there is no horizontal overflow, focus stays inside the dialog, and the countdown is announced politely.

## 16. Risks and limitations

1. **Forced re-login on deploy:** every pre-1B JWT lacks `sid` and will be rejected. Communicate this to users and deploy outside peak hours.
2. **Cross-instance revocation delay:** revocation done in another process is seen within ≤ 10s (session cache TTL). Revocation in the same process is immediate. Lower `AUTH_SESSION_CACHE_TTL_MS` if needed.
3. **Organization-assignment changes:** these do not revoke sessions (deferred). They are mitigated by the DB-authoritative auth context with a 15s cache.
4. **`PASSWORD_CHANGED`:** has no producer until a self-service change-password flow exists.
5. **Hidden-tab timers:** browsers throttle timers in hidden tabs. The server remains authoritative, so a tab may show the expiry a few seconds late, but the session itself always ends on time. During the browser test, the tab redirected about 8 seconds after the server-side expiry.
6. **Session cleanup:** sessions of users who close the browser are closed by the 5-minute sweeper. Until then they stay `is_active` in the DB but are already unusable.
7. **Pre-existing unrelated issues:** one backend and one frontend test failure, plus pre-existing Prisma schema drift.

## 17. Deployment requirements (for a future, separately approved deployment)

1. Apply migration `20261015140000_auth_sessions_created_request_id` with `prisma migrate deploy`. It is additive. `20261015120000_audit_logs_security_events` from Phase 1A is also pending.
2. **Environment** (all optional; the defaults are shown):
   - `AUTH_IDLE_TIMEOUT_MINUTES=30`
   - `AUTH_IDLE_WARNING_MINUTES=5`
   - `AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS=12`
   - `AUTH_SESSION_CACHE_TTL_MS=10000`
   - `AUTH_SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS=30`
   - `AUTH_SESSION_PRESENCE_WRITE_THROTTLE_SECONDS=60`
   - `AUTH_SESSION_SWEEP_INTERVAL_MS=300000`
3. **Optional `JWT_ISSUER` / `JWT_AUDIENCE`:** setting them later invalidates all tokens issued without them, which forces another re-login.
4. **Deploy order:** backend and frontend together. The old frontend does not send activity pings, so its users would be idled out after 30 minutes even while active.
5. **Post-deploy verification:**
   - login → `auth_sessions` row plus `AUTH_SESSION_CREATED`;
   - logout → old token gets 401 `SESSION_ENDED`;
   - background traffic does not move `last_activity_at`.
6. **Nginx:** no new requirements beyond Phase 1A (`X-Request-Id` forwarding).

## 18. Not done (by design)

- No MFA and no recovery codes. These are planned for Phase 1C.
- No new query-string authentication.
- No changes to field-training scoring, attendance scoring, eligibility, tasks, course completion, or certificate criteria.
- No production deployment.

**Recommended next phase:** EPROJECTO SECURITY PHASE 1C — MFA + RECOVERY CODES + SESSION/DEVICE MANAGEMENT.

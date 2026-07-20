# Phase 24 — Super Admin

Mobile system-oversight experience for `super_admin`. Unlike every prior role, `super_admin` is global by design — the backend is the sole authority on whether that global scope is actually active for the current session, and the entire feature module is gated on that single fact.

## Critical security rule

> **`SuperAdminCapabilities.canAccess(user)` is true if and only if `user.primaryRole == super_admin AND user.isGlobal == true`.**

- `AuthUser.isGlobal` is parsed from `GET /auth/me` and is never inferred, cached indefinitely, or trusted from anywhere else.
- If the role claims `super_admin` but `isGlobal` is `false` (stale token, or a privilege revoked server-side while the app was open), the app **fails closed**: no super_admin screen, tab, or action is ever rendered. `HomeShellScreen.build` short-circuits to a dedicated lost-privilege page (title + message + sign-out button only) *before* computing any nav items or page list, so there is no intermediate state where a 5-tab bar exists with broken/empty tabs behind it.
- `HomeShellScreen.initState` calls `AuthController.refreshCurrentUser()` once whenever a cached `super_admin` user is detected without `isGlobal` — this re-fetches `/auth/me` so a genuinely-reinstated privilege recovers without a full re-login, while a genuinely-revoked one is confirmed and stays fail-closed.
- `program_admin` remains fail-closed exactly as in every prior phase and is **never** included in `SuperAdminCapabilities.assignableRoles`.
- IDENTITY-001: the backend (`assertSuperAdminRoleMutationAllowed` / `superAdminPrivilegeBoundary.js`) is the actual enforcement point for granting or revoking `super_admin`. The mobile app adds a **mandatory** red-accented confirmation dialog (`_confirmSuperAdminChange`) before submitting any role change that adds or removes `super_admin` from another user — this is a UX safeguard, never the security boundary itself.

## Mobile scope classification

### A. Full mobile
- Dashboard stats — `GET /dashboard/admin-stats` (system-wide totals for a global requester)
- Universities list/detail — `GET /universities`, `GET /universities/:id?include_counts=true`
- Users list/detail — `GET /users`, `GET /users/:id`
- Field-training oversight — reuses the Phase 22 admin opportunities/applications/hours screens unmodified (`AdminCapabilities` now also recognizes `super_admin`)
- Reports — university FT report (reused) **and** the global `/admin/field-training/reports/global` summary + per-university comparison
- Notifications (shared inbox + app-bar badge)
- Profile (with an `isGlobal` badge)

### B. Safe quick actions
- `PATCH /users/:id/activate`
- `PATCH /users/:id/status {status: active|inactive|suspended}` (confirm sheet)
- `PUT /universities/:id` with `status: active|inactive|archived` (confirm sheet)
- `PUT /users/:id` with `role_codes` (role-assignment sheet; strong confirm when `super_admin` is added/removed)
- Opportunity publish/archive, application status, hours PATCH — all reused from `AdminRepository` as-is
- QA/recognition/enrollment status writes — reused from `ReviewerRepository`; `ReviewerCapabilities` now accepts an `isGlobal` flag and grants a full bypass when `role == super_admin && isGlobal`

### C. Read-only
- Audit logs — `GET /audit-logs` (safe display fields only: action type, entity type, actor name, timestamp — **never** `old_values`/`new_values`/`ip_address`/raw JSON/tokens; stripped server-response-side in `SuperAdminRepository._stripSensitiveAuditFields` before it ever reaches a widget)
- Certificates — `GET /certificates` (list only; issuing/status changes remain staff-role actions)
- System status — `GET /health` (API-availability probe only; **never** exposes the database URL or any other environment detail)
- Evidence, academic student reports — reused read-only from Phase 22/23

### D. Web-only (not implemented on mobile)
- `GET/PUT /settings`, `/analytics/*`
- Admin course management
- Bulk verify / Excel export
- User creation, full password reset
- University **creation** beyond the minimal form (this phase keeps university create to `name` + optional contact fields only, since the POST endpoint is simple and `super_admin`-only; the full web form covers type/partnership state/notes)
- Assessment/task/session builders, student expulsion, certificate issuance

## Domain model

`lib/features/super_admin/domain/super_admin_models.dart`:

- `SuperAdminCapabilities` — the single access gate (`canAccess`) plus per-action convenience getters that all delegate to it, and `assignableRoles`/`isRoleAssignable` (excludes `program_admin`; includes `super_admin` itself for SA-to-SA grants)
- `SuperAdminStats`, `UniversityItem`, `UserItem` — thin map wrappers, same pattern as `AdminStats`/`ReviewerModels` in prior phases
- `SuperAdminLabels` — Arabic label helpers for university/user status and role codes

Two existing capability classes were extended rather than duplicated:

- `AdminCapabilities.isFieldTrainingAdmin` / `canWriteHours` / `canManageOpportunities` / `canReviewApplications` / `canReadUsers` / `canReadAdminStats` now also return `true` for `LmsRoles.superAdmin`, so the Phase 22 admin screens work unmodified when opened from the super_admin shell.
- `ReviewerCapabilities` gained an optional `isGlobal` constructor parameter; `_isSuperAdmin => role == super_admin && isGlobal` bypasses every QA/recognition/enrollment gate, matching the backend's `QA_OVERSIGHT_ROLE_CODES` / `RISK_INTEGRITY_ROLE_CODES` / `RECOGNITION_*_ROLE_CODES` / `ENROLLMENT_DECISION_ROLE_CODES`, which all include `super_admin` explicitly (`backend/src/config/env.js`).

## Endpoints used

| Feature | Method | Path |
|---------|--------|------|
| Dashboard stats | GET | `/api/v1/dashboard/admin-stats` |
| Universities list/create | GET/POST | `/api/v1/universities` |
| University detail/update | GET/PUT | `/api/v1/universities/:id` |
| Users list | GET | `/api/v1/users` |
| User detail/update | GET/PUT | `/api/v1/users/:id` |
| User activate | PATCH | `/api/v1/users/:id/activate` |
| User status | PATCH | `/api/v1/users/:id/status` |
| Audit logs list | GET | `/api/v1/audit-logs` |
| Global FT report | GET | `/api/v1/admin/field-training/reports/global` |
| Certificates list | GET | `/api/v1/certificates` |
| Health probe | GET | `/health` (root-level, outside `/api/v1`) |
| Field-training / QA / recognition / enrollment | — | reused verbatim from Phase 22/23 (`AdminRepository`, `ReviewerRepository`) |

`AppConfig.healthUrl` was added (`$apiBaseUrl/health`) since `/health` sits outside the versioned `/api/v1` root; `ApiClient.getRawJson` reads it without the `{success,data}` envelope wrapping used everywhere else. `ApiClient.putJson` was added for `PUT /universities/:id` and `PUT /users/:id`.

## Role routing

Bottom navigation — `super_admin` (5 tabs, only rendered when `SuperAdminCapabilities.canAccess(user)` is true):

1. الرئيسية — Home (stats + priority quick actions)
2. الجامعات — Universities
3. المستخدمون — Users
4. التقارير — Reports (global FT report + university comparison)
5. حسابي — Profile (`isGlobal` badge)

Contextual access from the Home dashboard leads into field-training oversight, QA/recognition oversight, audit log, system status, and certificates — none of these are top-level tabs, keeping the tab bar at exactly 5 items as specified.

## Routes

| Route | Screen |
|-------|--------|
| `/super/universities/new` | Minimal university create form |
| `/super/universities/:id/edit` | Minimal university edit form |
| `/super/universities/:id` | University detail + status change + edit + linked users |
| `/super/universities/:id/users` | Users list pre-filtered to that university |
| `/super/users/:id` | User detail + activate + status change + role assignment |
| `/super/field-training` | Field-training oversight (reused `AdminOpportunitiesScreen`) |
| `/super/qa` | QA / recognition oversight (segmented, reused Phase 23 hubs) |
| `/super/audit` | Read-only audit log |
| `/super/system-status` | API health probe |
| `/super/certificates` | Read-only certificate list |
| `/super/settings` | Settings (reused screen) |

`/home/universities`, `/home/users`, `/home/reports`, `/home/profile` remain the 4 non-home tab routes used by `shellNavForRole`/`AppBottomNavigation`, consistent with every other role's shell.

## Role assignment & IDENTITY-001

The role-assignment bottom sheet on the user detail screen (`SuperAdminUserDetailScreen._openRoleSheet`) offers exactly `SuperAdminCapabilities.assignableRoles` as checkboxes — `program_admin` is never offered. If the selection changes whether the target user has `super_admin` (added or removed), a second, visually distinct (red icon/button) confirmation dialog is shown before the `PUT /users/:id` call is made. The backend independently re-validates and enforces the actual rule; this dialog is purely a client-side guard against accidental submission.

## Read-only surfaces (intentional scope limit)

- Audit logs never render `old_values`, `new_values`, `ip_address`, or any raw JSON — the repository strips those fields before a screen ever sees the response.
- The system status screen shows only `{status, service}`-shaped fields from `/health`; it never attempts to surface database connection strings or other environment info, even if the backend response happened to include them.
- Certificates are list-only; no issue/revoke actions are exposed.
- Report exports (PDF/Excel) are messaged as web-only rather than attempted on mobile.

## Offline policy

Read-only cache namespaces (per user), isolated from every other role's namespaces and from each other:

- `sa_dashboard`
- `sa_universities`
- `sa_users`
- `sa_audit`
- `sa_reports`
- `sa_certificates`

Cleared on logout (`OfflineCache.clearUser`). All writes (university/user status, role assignment, activation) are online-only with no offline queue — a fresh reload of the surrounding list/detail screen re-syncs from the network. Any 403 from a specific sub-resource is treated as an empty/soft result (`SuperAdminRepository._isForbidden`), never a crash, matching the pattern established in Phase 22/23 repositories.

## Lost-privilege handling

- `AuthController.refreshCurrentUser()` re-fetches `/auth/me` and updates `AuthState` in place. If the refreshed user is unsupported (`program_admin`) it routes to `unsupportedRole`; if inactive/pending it routes accordingly; on network failure the current session is preserved (fail-open on transient errors, fail-closed on a confirmed backend answer).
- `HomeShellScreen` calls this once on entry whenever the cached user claims `super_admin` without `isGlobal`, then re-evaluates `SuperAdminCapabilities.canAccess` on the refreshed state before ever building the tab bar.

## Notifications

`NotificationNavigator.mobileRouteFromActionUrl` gained Phase 24 mappings:

- `/users/:id` → `/super/users/:id`
- `/universities/:id` → `/super/universities/:id`
- `/audit-logs...` → `/super/audit`
- `/health` or `/system-status` → `/super/system-status`
- `/admin/field-training/...`, QA, and recognition URLs already mapped to admin/reviewer routes in Phase 22/23 continue to resolve correctly for `super_admin` sessions, since those detail screens are reused verbatim.

## Test results

```bash
dart format .
flutter gen-l10n
flutter analyze --no-fatal-infos   # 0 errors, 0 warnings (info hints only, pre-existing)
flutter test                       # 141/141 passed (114 pre-existing/parametrized + 27 new)
```

## Known gaps / next phase (recommended)

1. Backend `action_url` generation for user/university/audit-log events (mobile deep-link mapping is ready and waiting, same pattern as Phase 23's gap)
2. Push notifications (FCM/APNs) for super_admin priority actions (pending users, pending enrollments)
3. Full university create/edit form parity with the web app (type, partnership state, notes) — mobile intentionally keeps this minimal
4. Bulk user operations and Excel/PDF export remain web-only by design

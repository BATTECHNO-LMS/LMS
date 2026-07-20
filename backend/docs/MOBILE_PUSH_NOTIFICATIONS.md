# Mobile Push Notifications (MOBILE-PHASE-25)

Server-side support for delivering mobile push notifications (Android/iOS) via
Firebase Cloud Messaging (FCM), fanned out from the existing in-app
notification pipeline (`createNotificationForUser`).

**Push delivery is disabled by default** and stays disabled until an owner
explicitly configures Firebase credentials on the server. The API, database,
and app remain fully functional with push disabled — only the "ring the
device" step is skipped; in-app notifications are unaffected.

## Data model

`mobile_push_registrations` (migration `20260720180000_mobile_push_registrations`,
additive only):

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `user_id` | Owner (no FK enforced at the DB level, matches other tables in this schema) |
| `registration_token` | FCM device/registration token. **Globally unique** — re-registering the same token under a different account reassigns ownership. |
| `platform` | `android` \| `ios` (DB CHECK constraint) |
| `app_id`, `app_version`, `device_installation_id`, `locale`, `notification_permission_status` | Optional client metadata |
| `disabled_at` | Set when FCM reports the token as permanently invalid, or by the cleanup script |
| `last_delivery_error`, `last_delivery_error_at` | Last transient delivery failure (token stays enabled) |
| `last_seen_at` | Bumped on every successful register — used by the stale-cleanup job |

No token is ever logged.

## Endpoints

All endpoints require a valid `Authorization: Bearer <jwt>` for an **active**
user (`authenticate` middleware — same as the rest of the API). The owning
user is always taken from the server-verified `req.user.userId`, never from
the request body.

### `POST /api/v1/mobile/push/register`

```json
{
  "registration_token": "…",
  "platform": "android",
  "app_version": "1.0.0",
  "locale": "ar",
  "permission_status": "granted",
  "app_id": "com.battechno.battechno_lms_app",
  "device_installation_id": "…"
}
```

Upserts by `registration_token`. If the token was previously registered to a
different user (e.g. shared device, account switch), ownership is reassigned
to the current user and `disabled_at` is cleared.

### `DELETE /api/v1/mobile/push/register`

```json
{ "registration_token": "…" }
```

Removes the registration for the current user only (no-op if the token
belongs to another user or doesn't exist).

### `DELETE /api/v1/mobile/push/register-all`

Removes every registration for the current user (used on logout / account
switch when the specific token isn't known).

## Sending push (`src/services/pushNotification.service.js`)

- `isEnabled()` — true only when `FIREBASE_PUSH_ENABLED=true` **and** valid
  credentials were found. Never throws; safe to call at any time.
- `sendToUser(userId, { notificationId, title, body, actionUrl, type })` —
  fans out to every active registration for the user. Always resolves (never
  rejects) so callers can fire-and-forget.
- `sendToToken(token, payload)` — single-token send (diagnostics/manual tests).
- `disableRegistration(id)` — marks a registration disabled.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `FIREBASE_PUSH_ENABLED` | yes | Must be exactly `true` to enable push. Anything else (including unset) keeps push disabled. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | one of the three | Raw service-account JSON as a single-line string. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | one of the three | Base64-encoded service-account JSON (preferred for most secret managers/Render env vars — avoids escaping issues). |
| `GOOGLE_APPLICATION_CREDENTIALS` | one of the three | Absolute path to a service-account JSON file (rarely used on Render; useful for local testing). |
| `PUSH_GENERIC_LOCK_SCREEN` | no | Set `true` to force a generic, locale-aware lock-screen alert (`لديك إشعار جديد...` / `You have a new notification`) instead of the LMS notification's own title/body. Off by default — existing LMS titles/bodies do not contain PII or secrets. |

If none of the three credential variables are set, or the JSON is malformed,
`isEnabled()` is `false` and a single warning is logged at startup (no crash,
no retry loop). **The service-account JSON/contents are never logged.**

### FCM `data` payload (privacy allowlist)

Only these keys are ever sent in the FCM `data` payload — no free-text
title/body, user PII, or internal identifiers beyond the notification id:

```json
{
  "notification_id": "…",
  "notification_type": "info|enrollment_approved|…",
  "action_url": "/student/programs",
  "event_version": "1"
}
```

The lock-screen `notification.title` / `notification.body` use the LMS
notification's own title/body by default (already privacy-conscious for this
app), or the generic strings above when `PUSH_GENERIC_LOCK_SCREEN=true`.

### Error handling

| FCM error code | Behavior |
| --- | --- |
| `messaging/registration-token-not-registered`, `messaging/invalid-argument`, `messaging/invalid-registration-token` | Registration is disabled (`disabled_at` set) — the app must re-register on next launch. |
| Anything else (network blips, quota, etc.) | Treated as transient — `last_delivery_error` / `last_delivery_error_at` recorded, registration stays enabled. |

## Fanout from in-app notifications

`shared/services/notification.service.js` calls
`pushNotification.service.sendToUser(...)` via `setImmediate(...).catch(() => {})`
immediately after a notification row is created. Push failures (disabled,
network error, bad token) **never** affect the return value of
`createNotificationForUser` / `createNotificationsForUsers`, and never throw
back into the caller.

## Cleanup script

```bash
node scripts/cleanup-stale-push-registrations.js                    # dry run (default)
node scripts/cleanup-stale-push-registrations.js --apply            # disable stale rows (90-day default)
node scripts/cleanup-stale-push-registrations.js --apply --days=60  # custom retention window
```

- Dry-run by default; prints counts only, never prints tokens.
- Refuses to run against `NODE_ENV=production` unless
  `ALLOW_PUSH_CLEANUP_PRODUCTION=true` is also set.

## Owner setup checklist (Firebase Console)

Push stays disabled until an owner completes these steps. **None of this is
done by this change** — no Firebase project, `google-services.json`,
`GoogleService-Info.plist`, or service-account JSON is created or committed.

1. Create (or reuse) a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Add an Android app with package name `com.battechno.battechno_lms_app`;
   download `google-services.json` and add it to
   `mobile/battechno_lms_app/android/app/` (do **not** commit real files —
   keep the repo's `.gitignore` covering it, or manage it via CI secrets).
3. Add an iOS app with bundle id `com.battechno.battechnoLmsApp`; download
   `GoogleService-Info.plist` for `mobile/battechno_lms_app/ios/Runner/`.
4. Enable the Cloud Messaging API for the project.
5. Generate a **service account** key (Project settings → Service accounts →
   Generate new private key). This JSON is the value for
   `FIREBASE_SERVICE_ACCOUNT_BASE64` (base64-encode it) or
   `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit this file.
6. Run `flutterfire configure` (or manually add `firebase_options.dart`) once
   the native config files above exist, and set the app's build-time flag
   `ENABLE_FIREBASE_PUSH=true` (see the Flutter docs,
   `mobile/battechno_lms_app/docs/PHASE_25_PUSH_NOTIFICATIONS.md`).

## Render deployment steps (owner)

1. In the Render service's Environment settings, add:
   - `FIREBASE_PUSH_ENABLED=true`
   - `FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 of the service-account JSON>`
     (or `FIREBASE_SERVICE_ACCOUNT_JSON`)
2. Deploy — `prisma migrate deploy` (already part of the deploy pipeline)
   applies `20260720180000_mobile_push_registrations` automatically.
3. Optionally schedule `node scripts/cleanup-stale-push-registrations.js --apply`
   as a periodic job (e.g. weekly) to disable stale registrations.

## Disabling push again

Unset/remove `FIREBASE_PUSH_ENABLED` (or any of the credential variables) and
redeploy. `isEnabled()` returns `false` again immediately — no data migration
or app update required; registrations remain stored for a future re-enable.

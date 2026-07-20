# Phase 25 — Push Notifications (end to end)

Mobile push notification client for BATTECHNO LMS, fanned out from the existing in-app notification pipeline (`createNotificationForUser` → FCM). Audit classification at the start of this phase was **C — no Firebase configuration present** (no `google-services.json`, no `GoogleService-Info.plist`, no `firebase_options.dart`). This phase adds the full client/server plumbing while **deliberately leaving push disabled** — no owner Firebase project is created or assumed, and no service-account secrets are fabricated or committed.

## Critical rule

> **`PushConfig.isConfigured` is `false` for every build produced from this repository.**

- `lib/core/push/push_config.dart` requires **both** a compile-time build flag (`--dart-define=ENABLE_FIREBASE_PUSH=true`) **and** a hard-coded `_hasFirebaseOptions` constant that stays `false` until an owner generates `firebase_options.dart` via `flutterfire configure` (after adding the native config files) and flips it.
- Every push-facing code path (`PushPermissionController`, `HomeShellScreen._bootstrapPush`, `PushTokenSyncService`) checks `PushConfig.isConfigured` first and is a safe no-op when it's `false` — no permission prompt, no Firebase initialization, no network call.
- `FirebasePushMessagingGateway` (the real FCM implementation) is compiled — it must type-check — but is **never instantiated** in this repo, since `pushMessagingGatewayProvider` only returns it when `PushConfig.isConfigured` is true. `NoOpPushMessagingGateway` is used instead, and every one of its methods is an immediate, harmless no-op.
- The app remains fully buildable and functional with push disabled: `flutter build apk --debug` succeeds without `google-services.json`; in-app notifications (inbox, badge, deep links) are completely unaffected.

## What's new

### Backend (`backend/`)

- `mobile_push_registrations` table (migration `20260720180000_mobile_push_registrations`, additive) — one row per device token, unique on `registration_token`, soft-disabled via `disabled_at` rather than deleted on delivery failure.
- `POST /api/v1/mobile/push/register`, `DELETE /api/v1/mobile/push/register`, `DELETE /api/v1/mobile/push/register-all` — authenticated, active-user only; ownership is always derived from the server-verified session, never from the request body.
- `backend/src/services/pushNotification.service.js` — lazy Firebase Admin init, gated on `FIREBASE_PUSH_ENABLED=true` + one of three credential env vars. `isEnabled()` is `false` (and `require`-ing the module never throws) until an owner sets those on the server.
- Fanout from `createNotificationForUser`/`createNotificationsForUsers` — fire-and-forget, push failures never affect notification creation.
- See `backend/docs/MOBILE_PUSH_NOTIFICATIONS.md` for the full backend contract, env vars, and owner setup checklist.

### Mobile (`lib/`)

`lib/core/push/`:
- `push_config.dart` — the single compile-time gate described above.
- `push_message.dart` — `PushMessage` (privacy-allowlisted `data` payload + lock-screen title/body) and `PushPermissionStatus`.
- `push_messaging_gateway.dart` — abstract interface; `no_op_push_messaging_gateway.dart` (always used here) and `firebase_push_messaging_gateway.dart` (real implementation, compiled but dormant).
- `firebase_messaging_background_handler.dart` — top-level `firebaseMessagingBackgroundHandler`; only ever registered by the real gateway; logs in debug only and never navigates (background isolates have no widget tree).
- `local_notification_service.dart` — `flutter_local_notifications` wrapper for the `battechno_lms_notifications` channel (foreground alerts only — FCM already shows a system notification in background/terminated states).
- `push_providers.dart` — Riverpod wiring (`pushMessagingGatewayProvider`, `localNotificationServiceProvider`).

`lib/features/push/`:
- `data/push_token_sync_service.dart` — `register`/`unregister`/`unregisterAll` against `/mobile/push/register(-all)`; request body building is a pure static method (`buildRegisterBody`) so its shape is unit-testable without a live/mocked Dio instance.
- `providers/push_permission_controller.dart` — loads/records the device-level "already asked" flag (`SharedPreferences`), requests OS permission, and syncs the resulting token. Every method no-ops when `PushConfig.isConfigured` is false.
- `providers/push_route_coordinator.dart` — resolves a push `action_url` via the existing `NotificationNavigator.mobileRouteFromActionUrl` (same allowlist as the in-app inbox — a push payload can never trigger navigation to an arbitrary route) and holds it as "pending" until the app can act on it; `clear()` is called on logout.
- `presentation/push_permission_sheet.dart` — AR/EN educational bottom sheet shown once per device before the OS prompt.
- `presentation/push_permission_settings_tile.dart` — settings-screen row showing the current permission status (or "not available in this build" when push isn't configured).

### Wiring

- `HomeShellScreen._bootstrapPush()` (called once from `initState`'s existing post-frame callback, **not** from the splash screen) — initializes the gateway, wires foreground/background-tap/initial-message listeners, and shows the permission education sheet on first launch if not already granted/asked. Every step is skipped when `PushConfig.isConfigured` is false.
- `HomeShellScreen._logout()` — best-effort `unregisterAllBestEffort()` before the token is cleared, plus `PushRouteCoordinator.clear()` so a previous account's pending deep link can never fire after a new sign-in.
- `SettingsScreen` — added `PushPermissionSettingsTile` (shared across every role, since `SettingsScreen` already is).
- `api_endpoints.dart` — `mobilePushRegister` / `mobilePushRegisterAll`.
- `api_client.dart` — added `deleteJson` (the register endpoint's unregister call is a `DELETE` with a body).

### Native project changes

- **Android** (`android/app/src/main/AndroidManifest.xml`): added `android.permission.POST_NOTIFICATIONS` (required at runtime on API 33+; harmless when the permission is never requested because push stays disabled). **No** `google-services` Gradle plugin or `google-services.json` was added.
- **Android** (`android/app/build.gradle.kts`): enabled core library desugaring (`isCoreLibraryDesugaringEnabled = true` + `desugar_jdk_libs`), required by `flutter_local_notifications` regardless of whether push is enabled.
- **iOS** (`ios/Runner/Info.plist`): added `UIBackgroundModes: [remote-notification]` — a capability declaration only; does not require code signing or an APNs key to build. **No** `GoogleService-Info.plist` was added.

### Localization

Added AR/EN keys (`pushPermissionSheetTitle/Body`, `pushPermissionEnableAction`, `pushPermissionSkipAction`, `pushNotificationChannelName/Description`, `pushPermissionSettingsTitle`, `pushPermissionStatus{Granted,Denied,Provisional,NotDetermined,Unsupported}`, `pushPermissionSettingsAction`, `pushPermissionOpenSystemSettingsHint`) to `app_ar.arb` / `app_en.arb`, regenerated via `flutter gen-l10n`.

## Tests

`test/phase25_push_notifications_test.dart` (18 tests, no live Firebase):

- `PushConfig.isConfigured` is `false` by default.
- `NoOpPushMessagingGateway` — every method is a safe no-op.
- `PushMessage.fromData` — reads only the allowlisted keys, tolerates missing data.
- Permission explanation copy exists and is non-empty in both AR and EN.
- `PushTokenSyncService.buildRegisterBody` — request shape (required fields, optional metadata inclusion/omission, **never** includes a user/account identifier — ownership is server-derived).
- `PushRouteCoordinator` — known `action_url` resolves to the existing mapped route; unknown resolves to `null` (never an arbitrary route); `consumePendingRoute` is single-consume; `clear()` (called on logout) discards pending navigation.
- Regression: `program_admin` remains unsupported; `SuperAdminCapabilities.canAccess` stays `isGlobal`-fail-closed; `NotificationNavigator` mappings from prior phases are unchanged.

## Owner steps remaining (not done by this change)

Push stays fully disabled until an owner:

1. Creates/reuses a Firebase project and adds an Android app (`com.battechno.battechno_lms_app`) + iOS app (`com.battechno.battechnoLmsApp`) in the Firebase Console.
2. Downloads `google-services.json` → `android/app/`, `GoogleService-Info.plist` → `ios/Runner/`. **Do not commit these to a public/shared repo without reviewing the org's secret-handling policy** — treat them the same as other environment-specific config.
3. Runs `flutterfire configure` to generate `lib/app/firebase_options.dart`, then flips `PushConfig._hasFirebaseOptions` to `true` in `lib/core/push/push_config.dart`.
4. Adds the `google-services` Gradle plugin (`android/settings.gradle.kts` + `android/app/build.gradle.kts`) per the FlutterFire docs — not added by this phase.
5. In Xcode, adds the "Push Notifications" + "Background Modes → Remote notifications" capabilities and an APNs key (Apple Developer portal) for the iOS target.
6. Generates a Firebase service-account key and sets `FIREBASE_PUSH_ENABLED=true` + `FIREBASE_SERVICE_ACCOUNT_BASE64=<...>` on the Render backend (see `backend/docs/MOBILE_PUSH_NOTIFICATIONS.md`).
7. Rebuilds and ships with `--dart-define=ENABLE_FIREBASE_PUSH=true`.

## Manual device test matrix (unchecked — requires a configured Firebase project)

- [ ] Foreground push shows a local alert and refreshes the notifications inbox (Android)
- [ ] Foreground push shows a local alert and refreshes the notifications inbox (iOS)
- [ ] Backgrounded app, tap system notification → navigates to the mapped screen (Android)
- [ ] Backgrounded app, tap system notification → navigates to the mapped screen (iOS)
- [ ] Terminated app, tap system notification → app launches and navigates once auth resolves (Android)
- [ ] Terminated app, tap system notification → app launches and navigates once auth resolves (iOS)
- [ ] Permission education sheet appears once per device on first authenticated launch
- [ ] Denying the OS prompt does not re-prompt on next launch; Settings screen still offers a retry
- [ ] Logout unregisters the device token (server-side row's `disabled_at`/removal) and clears any pending push-originated navigation
- [ ] Switching accounts on the same device re-registers the token under the new account (server reassigns ownership by token)
- [ ] Unknown/legacy `action_url` from an older notification never navigates to an unmapped/arbitrary route
- [ ] App remains fully usable (build + run + all existing features) with Firebase **not** configured (regression check)

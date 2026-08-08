# BATTECHNO LMS — Mobile App

Official Flutter mobile client for the BATTECHNO LMS platform.

## Purpose

Native Android/iOS experience for university learning, field training, academic assessments, certificates, and institutional workflows. The app consumes the existing REST API; it does not embed database credentials or provider secrets.

## Architecture

- **Flutter** + **Material 3**
- **Riverpod** — session and feature state
- **Dio** — HTTP client with bearer auth + 401 handling
- **go_router** — auth-aware navigation
- **flutter_secure_storage** — JWT persistence
- **intl / flutter_localizations** — Arabic-first, English-ready

```
lib/
  app/          # App widget, router, theme, config, localization
  core/         # API client, errors, storage, shared widgets, utils
  features/     # splash, auth, dashboard, field_training
```

## Environment configuration

Configure at build/run time using `--dart-define` (no secrets in source):

| Key | Default | Description |
|-----|---------|-------------|
| `API_BASE_URL` | `https://lms-7txx.onrender.com` | Backend host (no trailing slash) |
| `APP_ENV` | `development` | `development` or `production` |
| `ENABLE_DEMO_MODE` | `false` | Reserved for future demo fixtures |

Example:

```bash
flutter run \
  --dart-define=API_BASE_URL=https://lms-7txx.onrender.com \
  --dart-define=APP_ENV=development
```

Auth endpoints: `/api/auth/*`  
Versioned API: `/api/v1/*`

## Authentication flow

1. Splash → secure token bootstrap
2. `POST /api/auth/login` → store JWT in secure storage
3. `GET /api/auth/me` → hydrate roles, university, specialty
4. Role-aware home shell
5. Logout clears secure storage (`POST /api/auth/logout` is best-effort)

**Known limitations (documented, not hidden):**

- **QA-AUTH-001** — Logout does not revoke JWT server-side
- **QA-AUTH-003** — Password reset does not invalidate existing JWTs

`program_admin` is **fail-closed** — unsupported in mobile shell.

## Active roles

- `super_admin`
- `university_admin`
- `academic_admin`
- `qa_officer`
- `instructor`
- `student`
- `university_reviewer`

## Implemented student flows

### Phase 17 — Field training & tasks

- Training opportunity detail, progress, tasks
- Task detail and submission (URL and/or file)
- Navigation from student home

### Phase 18 — Assessments & sessions

- Pre/post assessment hub, overview, paginated attempt, result
- Training sessions list and detail (from list payload)
- Read-only attendance summary
- Journey section on training detail
- Priority next action on student home

See [docs/PHASE_18_ASSESSMENTS_SESSIONS.md](docs/PHASE_18_ASSESSMENTS_SESSIONS.md).

### MOBILE-STUDENT-COURSES-001 — Student LMS courses

- Student bottom nav: Home, Training, **Courses (الكورسات)**, Profile
- Notifications via app-bar bell only (inbox route preserved)
- Course list / detail / lessons against `/api/v1/student/courses*`
- Progress from Backend; simple lesson completion; training quiz web-hint
- Offline read cache for list/detail; cleared on logout
- Home compact “continue learning” summary

See [docs/STUDENT_COURSES_IMPLEMENTATION.md](docs/STUDENT_COURSES_IMPLEMENTATION.md).

### Phase 19 — Student completion

- Real student training list (available, applications, current, completed)
- Application flow with eligibility and duplicate protection
- Notifications inbox with unread badge and deep links
- Certificates hub and completion-letter download
- Student profile (read-only) and account settings
- Secure file download/open service
- Read-only offline cache for training list
- Bottom navigation: Home, Training, Courses (الكورسات), Profile
- Notifications remain available from the app-bar / home-header bell (`/notifications`)

See [docs/PHASE_19_STUDENT_COMPLETION.md](docs/PHASE_19_STUDENT_COMPLETION.md).

### Phase 20 — Instructor field training

- Instructor Home with priority action and summary chips
- Assigned trainings list (active / upcoming / completed)
- Training detail with navigation to students, sessions, submissions, assessments
- Participant list and progress detail
- Session create/edit + batch attendance recording
- Submission review (approve / revision / reject + feedback)
- Read-only assessment results
- Instructor profile/settings; notifications via app bar
- Read-only offline cache; hours display only (no write API)

See [docs/PHASE_20_INSTRUCTOR_FIELD_TRAINING.md](docs/PHASE_20_INSTRUCTOR_FIELD_TRAINING.md).

### Phase 21 — Training hours end-to-end

- Authoritative Model A: required hours on opportunity; completed hours on application
- Instructor/admin PATCH replace-total with optimistic concurrency + audit
- Web opportunity form + participant hours panel
- Flutter instructor write UI; student read-only from progress metrics
- Migration 29 (additive; baseline v1 stays at 27)

See [docs/PHASE_21_TRAINING_HOURS.md](docs/PHASE_21_TRAINING_HOURS.md).

### Phase 22 — University & academic admin

- Home shell: 5 tabs (Home, Opportunities/Training, Trainees, Reports, Profile)
- Field-training opportunity list, detail, create/edit form, publish/archive
- Application review (approve/reject with optional note)
- University-scoped trainee roster and per-student progress/hours (shared write access with instructor)
- University report summary cards; read-only sessions, submissions, and assessment results
- `university_admin`-only extras (dashboard stats, pending users) shown when granted by the backend
- `academic_admin` gets identical field-training admin access per backend RBAC (web UI hides it; mobile trusts the backend)
- `program_admin` remains fail-closed

See [docs/PHASE_22_UNIVERSITY_ACADEMIC_ADMIN.md](docs/PHASE_22_UNIVERSITY_ACADEMIC_ADMIN.md).

### Phase 23 — QA officer & university reviewer

- Home shell: 5 tabs each for `qa_officer` (Home, Reviews, Reports, Notifications, Profile) and `university_reviewer` (Home, Reviews, Trainees, Reports, Profile)
- `qa_officer`: QA reviews / corrective actions / risk cases / integrity cases lists, detail, and status-change writes (backend flow-validated transitions only)
- `university_reviewer`: recognition requests (read + status-only decision) and pending enrollment approve/reject
- Shared read-only surfaces for both roles: evidence list/open-file, academic field-training university report, student roster + read-only student detail (hours/attendance/tasks/assessments)
- No hours/attendance/application writes for either role by design; no review-history timeline API
- `program_admin` remains fail-closed

See [docs/PHASE_23_QA_UNIVERSITY_REVIEWER.md](docs/PHASE_23_QA_UNIVERSITY_REVIEWER.md).

### Phase 24 — Super admin

- Home shell: 5 tabs (Home, Universities, Users, Reports, Profile) — rendered only when the backend confirms `role == super_admin AND isGlobal == true`
- Fail-closed lost-privilege handling: a `super_admin` role without a verified `isGlobal` gets an empty shell with a sign-out-only message, never a partially-working tab bar; `AuthController.refreshCurrentUser()` re-checks `/auth/me` once per shell entry
- Universities and users list/detail/status-change; minimal university create/edit (name + optional contact fields only)
- Role assignment sheet with a mandatory strong confirmation before adding/removing `super_admin` on another user (backend enforces IDENTITY-001; this is a client-side safeguard only) — `program_admin` is never offered as assignable
- Field-training, QA, and recognition/enrollment oversight reused verbatim from Phase 22/23 admin/reviewer screens (`AdminCapabilities`/`ReviewerCapabilities` extended to recognize a global `super_admin`)
- Read-only audit log (safe fields only), certificates list, and API health probe (availability only, no environment details)
- `program_admin` remains fail-closed

See [docs/PHASE_24_SUPER_ADMIN.md](docs/PHASE_24_SUPER_ADMIN.md).

### Phase 25 — Push notifications (disabled by default)

- Full client/server plumbing for FCM push, fanned out from the existing `createNotificationForUser` pipeline — but **push stays disabled in this repo**: no `google-services.json`, no `GoogleService-Info.plist`, no `firebase_options.dart`, no fabricated Firebase project IDs
- `PushConfig.isConfigured` is `false` unless an owner both generates real Firebase config **and** builds with `--dart-define=ENABLE_FIREBASE_PUSH=true`; every push code path is a safe no-op otherwise, and the app builds/runs/tests identically to before this phase
- When enabled by an owner: permission education sheet → OS prompt → token registered with the backend; foreground push refreshes the notifications inbox and shows a local alert; background/terminated taps navigate through the same allowlisted `action_url` mapping already used by the in-app inbox; logout unregisters the token
- Migration 30 (additive; baseline v1 stays at 27) adds `mobile_push_registrations`

**Owner steps to actually enable delivery** (none of these are done by this repo):

1. Create/reuse a Firebase project; add Android app `com.battechno.battechno_lms_app` and iOS app `com.battechno.battechnoLmsApp`
2. Download `google-services.json` → `android/app/`, `GoogleService-Info.plist` → `ios/Runner/`
3. Run `flutterfire configure` (generates `lib/app/firebase_options.dart`), then flip `PushConfig._hasFirebaseOptions` to `true`
4. Add the `google-services` Gradle plugin per FlutterFire docs; add the Xcode "Push Notifications" + "Background Modes" capabilities and an APNs key
5. On Render: set `FIREBASE_PUSH_ENABLED=true` and one of `FIREBASE_SERVICE_ACCOUNT_JSON` / `FIREBASE_SERVICE_ACCOUNT_BASE64` / `GOOGLE_APPLICATION_CREDENTIALS` (names only — see `backend/docs/MOBILE_PUSH_NOTIFICATIONS.md`)
6. Rebuild and ship with `--dart-define=ENABLE_FIREBASE_PUSH=true`

See [docs/PHASE_25_PUSH_NOTIFICATIONS.md](docs/PHASE_25_PUSH_NOTIFICATIONS.md) for the full architecture, backend contract, and manual device test matrix.

### Account deletion (Play compliance)

- In-app request flow: Settings → Account Management → Delete Account
- Public instructions: https://lms.battechno.com/account-deletion
- Privacy policy: https://lms.battechno.com/privacy-policy

See [docs/ACCOUNT_DELETION.md](docs/ACCOUNT_DELETION.md).

## Run commands

```bash
cd mobile/battechno_lms_app
flutter pub get
flutter run
```

## Test commands

```bash
dart format .
flutter analyze
flutter test
```

## Android / iOS prerequisites

- Flutter SDK 3.41+ (stable)
- Android Studio / SDK for Android builds
- Xcode + CocoaPods for iOS builds (macOS only)

**Android application ID:** `com.battechno.battechno_lms_app`  
**iOS bundle identifier:** `com.battechno.battechnoLmsApp`

## Backend contract gaps (follow-up)

- Completion eligibility does not yet gate on completed hours
- No hours ledger / dated hour entries (audit_logs only)
- No assessment retakes or draft-attempt save endpoint
- No PATCH profile or in-app password change
- No notification unread-count endpoint
- No certificate PDF download endpoint
- R2 presigned upload parity with web for task files
- No `action_url` generation for QA reviews, corrective actions, risk cases, integrity cases, or recognition requests (mobile deep-link mapping is ready and waiting; see Phase 23 docs)
- No `action_url` generation for user/university/audit-log events (mobile deep-link mapping is ready and waiting; see Phase 24 docs)

## Next recommended phase

1. Session/attendance and submission-review write access for admin roles (currently read-only on mobile)
2. Optional completion eligibility gate on hours (product decision)
3. Owner Firebase Console + Render setup to actually enable push delivery (client/server plumbing is ready — see Phase 25)
4. Custom app icon / splash using full BATTECHNO logo asset

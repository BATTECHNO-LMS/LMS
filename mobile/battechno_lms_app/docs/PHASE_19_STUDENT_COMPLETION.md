# Phase 19 — Student Completion

Complete practical student mobile experience: training list, notifications, certificates, profile/settings, secure downloads, offline cache, and final bottom navigation.

## Endpoints used

| Feature | Method | Path | Notes |
|---------|--------|------|-------|
| Training opportunities | GET | `/api/v1/student/field-training` | Query: `search`, `training_mode` |
| My applications | GET | `/api/v1/student/field-training/my-applications` | Client-side section grouping |
| Apply | POST | `/api/v1/student/field-training/:id/apply` | Body: optional `student_message` |
| Notifications | GET | `/api/v1/notifications` | Query: `page`, `page_size`, `is_read` |
| Mark read | PATCH | `/api/v1/notifications/:id/read` | |
| Mark all read | PATCH | `/api/v1/notifications/read-all` | |
| Certificates list | GET | `/api/v1/certificates` | |
| Certificate detail | GET | `/api/v1/certificates/:id` | |
| Public verify | GET | `/api/v1/certificates/verify/:code` | Opened in browser |
| Completion letter | GET | `/api/v1/student/field-training/completion-letters/:applicationId/download` | Authenticated download |
| File download URL | GET | `/api/v1/files/:id/download-url` | Signed URL for attachments |
| Current user | GET | `/api/auth/me` | Read-only profile display |

## Routes

| Route | Screen |
|-------|--------|
| Shell tab 0 | Student Home |
| Shell tab 1 | Student Training List |
| Shell tab 2 | Notifications Inbox |
| Shell tab 3 | Student Profile |
| `/student/settings` | Account settings (language, logout, QA notes) |
| `/student/certificates` | Certificates hub |
| `/student/certificates/:id` | Certificate detail |
| Existing Phase 17–18 routes | Training detail, tasks, assessments, sessions |

## Training list behavior

Sections (client-side from API payloads):

- **Available** — no application or eligible to browse
- **My applications** — pending / under review
- **Current** — approved and in training
- **Completed** — finished training

Features: search (when Backend supports `search`), pull-to-refresh, loading skeleton, empty states, retry, offline cached banner with `lastUpdatedAt`, apply flow with confirmation and duplicate protection.

`required_training_hours` is shown only when returned; otherwise localized “not specified”.

## Notifications

- Typed models: `AppNotification`, `NotificationType`, pagination wrapper
- Unread badge from loaded list (no dedicated count endpoint)
- Mark one / mark all read with list refresh
- Deep link mapping from `action_url` to mobile routes; safe fallback for unknown targets
- Grouped by date, read/unread styling, type-based icons

## Certificates and documents

- List and detail from `/api/v1/certificates`
- Verification link via public verify URL + `url_launcher`
- Completion letter download via authenticated GET + `SecureFileService`
- No local certificate fabrication; no PDF download when API omits it

## Profile and settings

- Profile: name, email, phone, university, specialty, account status (read-only)
- Settings: language toggle, forgot-password link, app version, logout
- **QA-AUTH-001**: logout clears local tokens/cache; server-side JWT revocation not implemented
- **QA-AUTH-003**: no in-app password change; use existing reset flow

## File download security

`SecureFileService`:

- HTTPS-only URL validation
- Rejects dangerous schemes (`javascript:`, etc.)
- Authenticated API download or signed URL fetch
- Temporary files in app cache directory
- Progress, open via `open_filex`, share when file is local
- No tokens in logs or persisted private document bytes

## Offline cache policy

`OfflineCache` (SharedPreferences, per user):

- Cached namespaces: `training_list`
- Never stores tokens, passwords, or assessment answers
- Cleared on logout per user ID
- Stale-while-revalidate: network first, fallback to cache with banner

Not cached for offline write: assessments, tasks, applications, profile updates.

## Backend gaps

| Gap | Mobile behavior |
|-----|-----------------|
| No PATCH profile | Read-only profile + notice |
| No password change API | Link to forgot-password |
| No unread count endpoint | Badge from notification list |
| No certificate PDF download | Detail + verify only |
| No server pagination on training list | Full list + client filters |
| `required_training_hours` often absent | “Not specified” label |

## Test results

```bash
dart format .
flutter analyze   # 0 errors (info hints only)
flutter test      # 37/37 passed (Phase 19)
```

Phase 19 tests cover: training grouping, apply eligibility, notification routing, secure URL validation, offline cache isolation, shell navigation labels.

## Next phase (recommended)

1. FCM/APNs push with notification tap routing
2. Profile PATCH when Backend adds student-safe fields
3. Expand offline cache (home summary, notifications, certificates metadata)
4. Instructor/admin mobile surfaces (separate epic)

# Phase 22 — University & Academic Admin

Mobile field-training admin experience for `university_admin` and `academic_admin`.

## Authorization

- Role gate: `university_admin`, `academic_admin`
- Both roles hold `FIELD_TRAINING_ADMIN`/`FIELD_TRAINING_MANAGE` on the backend and get **identical** access to `/admin/field-training/*`, including the hours PATCH — the web UI hides field-training from `academic_admin`, but the mobile app trusts backend permissions instead of mirroring that web-only restriction.
- `university_admin`-only (`ADMIN_READ` scope): `GET /dashboard/admin-stats`, `GET /users`. The repository soft-fails (returns `null`) on a 403 from these two endpoints so a misconfigured grant never crashes the dashboard.
- `academic_admin`-only extras (curriculum writes, enrollment decisions) are out of scope for this mobile phase.
- `program_admin` remains fail-closed (unsupported role, same as every other phase).

## Endpoints used

| Feature | Method | Path |
|---------|--------|------|
| Opportunities list | GET | `/api/v1/admin/field-training` |
| Stats | GET | `/api/v1/admin/field-training/stats` |
| Opportunity detail | GET | `/api/v1/admin/field-training/:id` |
| Create | POST | `/api/v1/admin/field-training` |
| Update | PATCH | `/api/v1/admin/field-training/:id` |
| Publish | POST | `/api/v1/admin/field-training/:id/publish` |
| Archive | POST | `/api/v1/admin/field-training/:id/archive` |
| Instructors picker | GET | `/api/v1/admin/field-training/instructors` |
| Eligibility catalog | GET | `/api/v1/admin/field-training/eligibility-catalog` |
| Applications | GET | `/api/v1/admin/field-training/:id/applications` |
| Review application | PATCH | `/api/v1/admin/field-training/applications/:applicationId/status` |
| Application progress | GET | `/api/v1/admin/field-training/applications/:applicationId/progress` |
| Hours (read/write) | GET/PATCH | `/api/v1/admin/field-training/applications/:applicationId/hours` |
| Sessions (read-only) | GET | `/api/v1/admin/field-training/:id/sessions` |
| Attendance (read-only) | GET | `/api/v1/admin/field-training/sessions/:sessionId/attendance` |
| Submissions (read-only) | GET | `/api/v1/admin/field-training/:id/submissions` |
| Assessments (read-only) | GET | `/api/v1/admin/field-training/:id/assessments` |
| University report | GET | `/api/v1/admin/field-training/reports/university` |
| Students report | GET | `/api/v1/admin/field-training/reports/students` |
| Dashboard stats (UA only) | GET | `/api/v1/dashboard/admin-stats` |
| Users (UA only) | GET | `/api/v1/users` |

## Role routing

Bottom navigation — `university_admin` (5 tabs):

1. الرئيسية — Home
2. الفرص — Opportunities
3. المتدربون — Trainees
4. التقارير — Reports
5. حسابي — Profile

Bottom navigation — `academic_admin` (5 tabs, same pages, tab 2 relabeled):

1. الرئيسية — Home
2. التدريب — Training (same opportunities list)
3. المتدربون — Trainees
4. التقارير — Reports
5. حسابي — Profile

## Routes

| Route | Screen |
|-------|--------|
| `/admin/field-training/new` | Create opportunity |
| `/admin/field-training/:id` | Opportunity detail |
| `/admin/field-training/:id/edit` | Edit opportunity |
| `/admin/field-training/:id/applications` | Review applications |
| `/admin/field-training/:id/sessions` | Sessions (read-only) + attendance drill |
| `/admin/field-training/:id/submissions` | Submissions (read-only) |
| `/admin/field-training/:id/assessments` | Assessment results (read-only) |
| `/admin/applications/:applicationId` | Student progress + hours |
| `/admin/reports/students/:applicationId` | Same student detail (report drill-through) |
| `/admin/settings` | Settings (reused screen) |

## Opportunity create/edit

Sectioned form: title, description, location, `training_mode` (onsite/remote/hybrid), start/end dates, `required_training_hours` (positive integer, optional), `assigned_instructor_id` (picker from `admin/field-training/instructors`).

Creation additionally resolves eligibility: the form loads the eligibility catalog, matches the admin's own university (`AuthUser.universityId`), lets the admin pick one of that university's eligible specialties, and submits `specialty_id` + a single-entry `eligibility` array scoped to that university/specialty pair. Editing an existing opportunity does not touch eligibility.

Online-only — the form does not attempt to submit while offline.

## Application review

Approve/reject with a confirmation sheet; reject supports an optional admin note. Uses the same `reviewApplication` status endpoint as instructors' backend logic, scoped to admin permissions.

## Hours contract (shared write, Model A)

Both `university_admin` and `academic_admin` can PATCH completed hours via `/admin/field-training/applications/:applicationId/hours`, mirroring the instructor "replace-total" UX (`AdminHoursSection`):

- Body: `{ completed_hours, note?, expected_completed_hours? }` (optimistic concurrency)
- `409 HOURS_CONFLICT` → localized conflict message + auto-refresh so the admin retries with the latest value
- `422 HOURS_EXCEED_REQUIRED` → localized validation message
- Completed hours must be `>= 0` and, when a required-hours target exists, `<= required_training_hours`

## Reports

`admin_reports_screen.dart` renders the university report as summary stat cards (eligible opportunities, total applicants, accepted/in-training/completed students, completion letters issued, average attendance) — no wide tables. A shortcut jumps to the trainees tab for the full roster.

`admin_students_hub_screen.dart` aggregates the students report into cards with client-side name/opportunity search; tapping a card opens the shared student detail/hours screen.

## Read-only surfaces (intentional scope limit)

Sessions, attendance, submissions, and assessment results are **read-only** on mobile for admin roles in this phase, even though the backend also allows admin writes on some of these. Session/attendance edits and submission review remain the instructor's mobile responsibility; admin write parity for these surfaces is a follow-up (see README "Next recommended phase").

## Offline policy

Read-only cache namespaces (per user):

- `admin_dashboard`
- `admin_opportunities`
- `admin_students`
- `admin_reports`

Cleared on logout (`OfflineCache.clearUser`). All writes (opportunity create/edit/publish/archive, application review, hours PATCH) are online-only and surface the shared network-error copy when offline.

## Notifications

`NotificationNavigator.mobileRouteFromActionUrl` now maps `/admin/field-training/...` action URLs (previously `null`) to the admin routes above, using the same leaf-segment/`tab` query-param heuristics as the instructor mapping (`manage` → detail, `tasks`/`submissions` → submissions, `sessions`/`attendance` → sessions, `results`/`assessments` → assessments, `applications` → applications). `/admin/applications/:id` maps to the student detail route.

## Test results

```bash
dart format .
flutter gen-l10n
flutter analyze   # 0 errors, 0 warnings (info hints only, pre-existing)
flutter test      # 81/81 passed (59 pre-existing + 22 new)
```

## Next phase (recommended)

1. Admin write parity for sessions/attendance and submission review (backend already supports it)
2. Push notifications (FCM/APNs) for admin priority actions
3. Publish-readiness detail surfacing (`missing` checklist) instead of a generic validation error
4. `academic_admin` curriculum/enrollment mobile surfaces (explicitly out of scope here)

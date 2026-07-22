# Phase 20 — Instructor Field Training

Practical instructor mobile experience for assigned field-training opportunities.

## Authorization

- Role gate: `instructor`
- Scope: opportunities where `assigned_instructor_id === current user`
- Cross-scope access returns **403** (`FIELD_TRAINING_FORBIDDEN`)
- `program_admin` remains unsupported (fail-closed)

## Endpoints used

| Feature | Method | Path |
|---------|--------|------|
| Assigned list | GET | `/api/v1/instructor/field-training` |
| Stats | GET | `/api/v1/instructor/field-training/stats` |
| Detail | GET | `/api/v1/instructor/field-training/:id` |
| Participants | GET | `/api/v1/instructor/field-training/:id/applications` |
| Progress | GET | `/api/v1/instructor/field-training/applications/:applicationId/progress` |
| Sessions | GET/POST | `/api/v1/instructor/field-training/:id/sessions` |
| Session edit | PATCH | `/api/v1/instructor/field-training/sessions/:sessionId` |
| Attendance | GET/POST | `/api/v1/instructor/field-training/sessions/:sessionId/attendance` |
| Submissions | GET | `/api/v1/instructor/field-training/:id/submissions` |
| Review | PATCH | `/api/v1/instructor/field-training/submissions/:submissionId/review` |
| Download URL | GET | `/api/v1/instructor/field-training/submissions/:submissionId/download-url` |
| Assessments | GET | `/api/v1/instructor/field-training/:id/assessments` |
| Notifications | GET/PATCH | `/api/v1/notifications` (shared) |
| Profile | GET | `/api/auth/me` (read-only) |

## Role routing

Bottom navigation (instructor):

1. الرئيسية — Instructor Home
2. تدريباتي — Assigned trainings
3. الطلاب — Students hub
4. حسابي — Profile

Notifications via app-bar → `/notifications` (shared inbox).

## Routes

| Route | Screen |
|-------|--------|
| `/instructor/field-training` | Assigned list |
| `/instructor/field-training/:id` | Training detail |
| `/instructor/field-training/:id/participants` | Participants |
| `/instructor/field-training/:id/participants/:applicationId` | Participant progress |
| `/instructor/field-training/:id/sessions` | Sessions (+ create/edit) |
| `/instructor/field-training/:id/sessions/:sessionId/attendance` | Attendance |
| `/instructor/field-training/:id/submissions` | Submissions list |
| `/instructor/field-training/:id/submissions/:submissionId` | Review |
| `/instructor/field-training/:id/assessments` | Assessment results (read-only) |
| `/instructor/settings` | Settings |
| `/notifications` | Inbox (non-student roles) |

## Sessions

Instructors **can** create and edit sessions (title, date, start/end, zoom link, description, required flag).

Validation: end after start; HTTPS/HTTP meeting URLs; required fields; no offline writes.

## Attendance

Batch POST with `records: [{ applicationId, studentId, status, note? }]`.

Statuses: `present | absent | late | excused`.

Mobile UI: per-student chips, mark-all-present, unsaved-changes warning, confirmation before save. **No offline writes.**

## Hours contract (gap)

**No Backend endpoint exists** to record completed training hours for field training.

Mobile behavior:

- Display `required_training_hours` when returned
- Show localized “hours not specified” when absent
- Read-only notice on detail and participant screens
- Do **not** invent a write API

Follow-up recommendation: add an authorized instructor endpoint (and admin/report surfaces) for completed hours with validation (non-negative, no duplicate session-hour recording, optional note/date).

## Submission review

`review_status`: `approved | rejected | needs_revision`  
Optional `instructor_feedback` (required on mobile for reject/revision).

**No numeric task score** on review body.

## Assessment results

Read-only list of assessments with attempts (student, score, passed). No answer-key exposure; no answer editing.

## Offline policy

Read-only cache namespaces (per user):

- `instructor_dashboard`
- `instructor_trainings`
- `instructor_participants_*`
- `instructor_sessions_*`
- `instructor_submissions_*`

Cleared on logout. No offline writes for attendance, hours, feedback, or sessions.

## Backend gaps

| Gap | Mobile handling |
|-----|-----------------|
| No completed-hours write API | Read-only + notice |
| No numeric task score on review | Status + feedback only |
| No GET session by id | Use list payload |
| No instructor profile PATCH | Read-only profile |
| Approve/reject applications | Not exposed (Backend blocks instructors) |

## Test results

```bash
dart format .
flutter analyze   # 0 errors, 0 warnings (info hints only)
flutter test      # 54/54 passed
```

## Next phase (recommended)

1. FCM/APNs push with instructor deep links
2. Completed-hours API + mobile write UI
3. Assessment attempt grading (manual short-answer) on mobile when needed
4. Instructor analytics / attendance trends

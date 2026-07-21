# Phase 23 — QA Officer & University Reviewer

Mobile review/oversight experience for `qa_officer` and `university_reviewer`. Both roles are university-scoped via JWT and are read-mostly: neither can ever write training hours, attendance, or field-training applications on mobile.

## Authorization

- Role gate: `qa_officer`, `university_reviewer`
- `qa_officer` only: QA reviews, corrective actions, risk cases, integrity cases (status writes); certificate list (backend-scoped)
- `university_reviewer` only: recognition requests (read + status decision, `{status}` only — no notes); enrollment approve/reject
- Both roles: evidence (read-only), academic field-training reports/students (read-only), notifications
- Neither role: FT hours/attendance/tasks write, FT application review, audit logs, admin-stats, certificate write
- `program_admin` remains fail-closed (unsupported role, same as every other phase)
- Any 403 from a sub-resource the current role doesn't hold is treated as an empty/soft result (`ReviewerRepository._isForbidden`), never a crash — this is how the same dashboard/report code paths safely serve both roles despite their disjoint QA vs. recognition/enrollment permissions
- There is no backend review-history timeline API, so detail screens show current state only (no audit trail)

## Endpoints used

| Feature | Method | Path |
|---------|--------|------|
| QA reviews list/detail | GET | `/api/v1/qa-reviews`, `/api/v1/qa-reviews/:id` |
| QA review status | PATCH | `/api/v1/qa-reviews/:id/status` |
| Corrective actions list/detail | GET | `/api/v1/corrective-actions`, `/api/v1/corrective-actions/:id` |
| Corrective action status | PATCH | `/api/v1/corrective-actions/:id/status` |
| Risk cases list/detail | GET | `/api/v1/risk-cases`, `/api/v1/risk-cases/:id` |
| Risk case status | PATCH | `/api/v1/risk-cases/:id/status` |
| Integrity cases list/detail | GET | `/api/v1/integrity-cases`, `/api/v1/integrity-cases/:id` |
| Integrity case status | PATCH | `/api/v1/integrity-cases/:id/status` |
| Evidence list/detail (read-only) | GET | `/api/v1/evidence`, `/api/v1/evidence/:id` |
| Recognition requests list/detail | GET | `/api/v1/recognition-requests`, `/api/v1/recognition-requests/:id` |
| Recognition documents | GET | `/api/v1/recognition-requests/:id/documents` |
| Recognition status decision | PATCH | `/api/v1/recognition-requests/:id/status` |
| Pending enrollments | GET | `/api/v1/enrollments/pending` |
| Enrollment approve/reject | PATCH | `/api/v1/enrollments/:id/approve`, `/api/v1/enrollments/:id/reject` |
| Academic FT university report | GET | `/api/v1/academic/field-training/reports/university` |
| Academic FT students list | GET | `/api/v1/academic/field-training/students` |
| Academic FT student report | GET | `/api/v1/academic/field-training/reports/students/:applicationId` |
| Task instruction file download URL | GET | `/api/v1/academic/field-training/tasks/:taskId/instruction-file/download-url` |

## Role routing

Bottom navigation — `qa_officer` (5 tabs):

1. الرئيسية — Home
2. المراجعات — Reviews (QA reviews / corrective actions / risk / integrity, segmented)
3. التقارير — Reports (academic FT university report)
4. الإشعارات — Notifications
5. حسابي — Profile

Bottom navigation — `university_reviewer` (5 tabs):

1. الرئيسية — Home
2. المراجعات — Reviews (Recognition / Enrollments, segmented)
3. المتدربون — Trainees (academic FT student roster)
4. التقارير — Reports (academic FT university report)
5. حسابي — Profile

## Routes

| Route | Screen |
|-------|--------|
| `/qa/reviews` | QA reviews hub (segmented: reviews/corrective/risk/integrity) |
| `/qa/reviews/:id` | QA review detail + status change |
| `/qa/corrective/:id` | Corrective action detail + status change |
| `/qa/risk/:id` | Risk case detail + status change |
| `/qa/integrity/:id` | Integrity case detail + status change |
| `/reviewer/evidence` | Evidence list (read-only, both roles) |
| `/reviewer/recognition` | Recognition requests list |
| `/reviewer/recognition/:id` | Recognition request detail + documents + decision |
| `/reviewer/enrollments` | Pending enrollments list + approve/reject |
| `/reviewer/reports` | Academic FT university report |
| `/reviewer/students` | Academic FT students hub (search) |
| `/reviewer/students/:applicationId` | Academic FT student report (read-only) |
| `/reviewer/settings` | Settings (reused screen) |

## Status flows

Status transitions are mirrored client-side from each backend service's flow map so the UI only ever offers valid next statuses (`nextQaStatuses`, `nextCorrectiveStatuses`, `nextRiskStatuses`, `nextIntegrityStatuses`, `nextRecognitionStatuses` in `reviewer_models.dart`):

- QA review: `open → {in_progress, resolved, closed}`, `in_progress → {open, resolved, closed}`, `resolved → {closed, in_progress}`, `closed` terminal
- Corrective action: same shape plus `overdue`
- Risk case: same shape plus `escalated`
- Integrity case: `reported → {under_investigation, resolved, closed}`, `under_investigation → {reported, resolved, closed}`, `resolved → {closed, under_investigation}`, `closed` terminal
- Recognition request: full backend flow is modeled (`draft → in_preparation → ready_for_submission → submitted → under_review → {approved|rejected|needs_revision}`), but `university_reviewer` can only ever PATCH from `submitted`/`under_review` in practice (`reviewerActionableRecognitionStatuses`); create/update stays staff-only and out of scope
- Recognition decision PATCH sends `{status}` only — no decision notes, matching the backend contract for this role

## Enrollment decisions

`enrollment_decision_sheet.dart` presents a single confirmation sheet for both actions: approve sends no reason; reject supports an optional free-text reason. The sheet returns `String?` — `null` = cancelled, empty string = approve, non-empty = reject with that reason — which `pending_enrollments_section.dart` maps directly onto `approveEnrollment`/`rejectEnrollment`.

## Read-only surfaces (intentional scope limit)

- Evidence is read-only for both roles (list + open file via `SecureFileService`)
- Academic FT reports/students/student-detail are read-only for both roles — hours, attendance, tasks, and assessments render as informational sections only; the admin `AdminHoursSection` write widget is deliberately not reused here
- There is no review-history timeline API, so detail screens do not attempt to render one

## Offline policy

Read-only cache namespaces (per user):

- `reviewer_dashboard`
- `reviewer_qa_queue`, `reviewer_qa_queue_corrective`, `reviewer_qa_queue_risk`, `reviewer_qa_queue_integrity`
- `reviewer_evidence`
- `reviewer_recognition`
- `reviewer_enrollments`
- `reviewer_reports`
- `reviewer_students`

Cleared on logout (`OfflineCache.clearUser`). All status/decision writes (QA/corrective/risk/integrity status PATCH, recognition status PATCH, enrollment approve/reject) are online-only and surface the shared network-error copy (or a status-conflict refresh on `409`) when offline or stale.

## Notifications

`NotificationNavigator.mobileRouteFromActionUrl` now maps Phase 23 action URLs (previously unhandled, returning `null`):

- `/qa-reviews/:id` or `/admin/qa-reviews/:id` → `/qa/reviews/:id`
- `/corrective-actions/:id` → `/qa/corrective/:id`
- `/risk-cases/:id` → `/qa/risk/:id`
- `/integrity-cases/:id` → `/qa/integrity/:id`
- `/recognition-requests/:id` → `/reviewer/recognition/:id` (bare list URL → `/reviewer/recognition`)
- any `enrollments`/`enrollment-requests` segment → `/reviewer/enrollments`
- `/academic/field-training/reports/student/:id` → `/reviewer/students/:id`
- `/academic/field-training/students` → `/reviewer/students`
- other `/academic/field-training/...` → `/reviewer/reports` (safe fallback)
- unrecognized URLs still return `null` (safe no-op, same as every prior phase)

As of this phase, the backend does not yet emit `action_url` values for QA reviews, corrective actions, risk cases, integrity cases, or recognition requests (no `dispatchAppEvent`/notification-template wiring found in `notification.service.js` for these modules). This mapping is forward-compatible groundwork matching the equivalent web routes (`frontend/src/app/router/index.jsx`) so mobile deep links work automatically once the backend starts sending them — it is a known gap, not a mobile defect.

## Test results

```bash
dart format .
flutter gen-l10n
flutter analyze --no-fatal-infos   # 0 errors, 0 warnings (info hints only, pre-existing)
flutter test                       # 115/115 passed (80 pre-existing + 35 new)
```

## Known gaps / next phase (recommended)

1. Backend `action_url` generation for QA reviews, corrective actions, risk cases, integrity cases, and recognition requests (mobile deep-link mapping is ready and waiting)
2. Push notifications (FCM/APNs) for QA/reviewer priority actions
3. Evidence upload/edit for roles that can write it elsewhere (out of scope — both Phase 23 roles are read-only on evidence)
4. `academic_admin`/instructor hours write parity is a separate phase; Phase 23 roles never write hours by design

# EPROJECTO Analytics & KPIs Command Center

Production-grade analytics for authorized eprojecto administrators. Reads authoritative business data only. Does not change scoring, eligibility, attendance, grading, or issuance logic.

## Architecture discovered

- Existing Super Admin analytics module (`backend/src/modules/analytics`) measured micro-credential cohorts, enrollments, certificates, and related LMS charts. It was **super_admin-only**, used UTC date filters, stubbed KPI trends (`pct: 0`), and did not cover Field Training official results, recorded lectures, live activity, or institution programs.
- KPI snapshot tables already exist (`kpi_definitions`, `kpi_snapshots`, `kpi_alerts`) for institution training-program KPIs. They are **reused as the snapshot abstraction**; this feature does not write a duplicate `analytics_snapshots` table and does not snapshot every live refresh (that would flood `kpi_snapshots`). Previous-period comparison is computed live with equal-duration windows.
- `auth_sessions` does **not** exist. Prisma `sessions` are cohort lecture sessions. Online-now is therefore **not inferred** from `users.last_login_at`.
- SSE did not exist. A single dashboard SSE endpoint was added; TanStack Query polling is the fallback.
- Chart library: **Recharts** (already in the frontend). Icons: **lucide-react**. Timezone: **Asia/Amman**.
- Caching: in-process TTL via `createTtlCache` (no Redis).

## Existing systems reused

- `universityScope` / `organizationScope` / `currentAuthContext` (DB-backed roles)
- `audit_logs` for active users, heatmap, and live activity
- `resolveFieldTrainingApprovedResult` overlay path: stored `eligibility_reason.details.approvedEvaluationResult` then `completion_eligibility_status`
- `field_training_final_evaluations` (`is_current`) for score distribution
- Recorded-lecture `unique_watched_seconds` vs `total_playback_seconds` and `getCompletionThresholdPercent()`
- `translateStudentActivityEvent` for Arabic activity copy
- Admin navigation, Recharts, TanStack Query, existing analytics SCSS tokens (navy / gold / ivory)

## New models / indexes

None. Additive-only. No migrations.

Existing indexes used: `audit_logs(created_at, university_id, organization_id, action_type)`, `field_training_applications(opportunity_id, status, training_status)`, `field_training_final_evaluations(university_id, opportunity_id, is_current)`, `field_training_recorded_lecture_progress(last_watched_at)`.

## API endpoints

| Method | Path | Auth | Freshness |
|---|---|---|---|
| GET | `/api/v1/analytics/command-center` | super_admin, admin | ~20s cache |
| GET | `/api/v1/analytics/command-center/live` | SSE | 8s push |
| GET | `/api/v1/analytics/command-center/live-snapshot` | same | 8s cache |
| GET | `/api/v1/analytics/command-center/filters` | same | 60s |
| GET | `/api/v1/analytics/command-center/drilldown` | same | paginated |
| GET | `/api/v1/analytics/overview` (legacy) | super_admin | unchanged |

Legacy PDF/Excel export endpoints remain for the previous MC dashboard payload. Full command-center export is deferred.

## KPI definitions

See the source table below and `backend/src/modules/analytics/analytics.definitions.js`.

## Authorization

- Super Admin (`isGlobal`): global analytics, all modules, system health.
- University Admin (`admin` + `UNIVERSITY`): own university only. Field Training, courses, micro-credentials.
- Institution Admin (`admin` + `INSTITUTION`): own organization only. No Field Training / recorded lectures. Training programs + content courses.
- Reviewer / student / trainee / trainer / instructor: **denied** (no analytics permission in the catalog).
- Requested `organizationId` / `universityId` are intersected with the authenticated scope. Cross-org → **403**.

## Organization scoping

Never trusts client IDs. University members: `users.primary_university_id` OR `university_users`. Institution members: `user_organization_assignments`.

## Real-time architecture

- Live: SSE `GET /command-center/live` (one connection) every 8s: live activity + currently watching. Online users remain unavailable until `auth_sessions`.
- Fallback: TanStack Query `live-snapshot` every 30s if SSE errors.
- Overview refetch 30s. Historical sections share the overview cache (20s).
- Analytics GETs do **not** write `audit_logs`, `last_login_at`, or presence. Heartbeats are excluded from activity SQL.

## SSE

Authenticated (`authenticate` + role). Scope is re-validated on each snapshot. `auth` event closes the stream. Client backoff on error. `visibilitychange` pauses the stream. Query `access_token` is supported because `EventSource` cannot set `Authorization`.

## Snapshot strategy

`kpi_snapshots` not written on dashboard load. Previous period = equal duration immediately before `periodStart`. Semester filter deferred (no `academic_terms` table).

## Cache strategy

In-memory TTL keyed by `isGlobal|orgType|orgId|uniId|opportunity|role|period|bounds`. Live 8s, near 20s, historical 120s. Keys include scope so org A cannot read org B cache.

## Frontend

Route: `/admin/analytics`  
Nav label: التحليلات والمؤشرات  
URL filters: `period`, `organizationType`, `organizationId`, `opportunityId`, `role`, `dateFrom`, `dateTo`, `orgMetric`  
Chart library: Recharts  
Components: `AnalyticsCommandCenterPage`, KPI variants, CommandCenter charts, live feed, drill-down drawer.

## Drill-down

| Control | Destination |
|---|---|
| Role slice | `/admin/users?role=` |
| Students KPI | `/admin/users?role=student` |
| Certificates | `/admin/certificates` |
| Eligible | paginated drawer (`type=eligible`) |
| Score bucket | paginated drawer (`type=score_bucket`) |
| Organization bar | reapplies `organizationId` filter |

No emails or IPs on aggregate cards.

## Performance / query counts

Overview fans out **one parallel round** of aggregate SQL (users, FT, lectures, courses, MC, certificates, heatmap, orgs, activity, watching, health). No per-row score resolver. No per-organization loop.

Representative overview query count: **~22–28** statements (including nested Promise.all), **N+1: NONE**.

Largest endpoint: `GET /command-center` (overview). Drilldown is 2 queries (page + count).

## Tests

- `backend/tests/analytics.commandCenter.unit.test.js` — percent safety, period bounds, super/uni/institution scope, cross-org 403, unauthorized roles, funnel denominator.
- Existing `analytics.trends.test.js` still covers legacy overview stub.
- `frontend/tests/productScope.nav.test.js` — `/admin/analytics` reachable for uni, institution, and super admin.

## Known limitations

- Online users: `auth_sessions` missing → `SOURCE_NOT_AVAILABLE`.
- Semester (`هذا الفصل`) hidden; no academic term model.
- Institution micro-credentials marked university-scoped.
- Content `courses` have no organization_id; enrollments scoped by student membership.
- SSE uses GET `access_token` for EventSource (existing auth middleware contract).
- Legacy `/overview` PDF/Excel is not the command-center payload.
- System health omits API latency / 5xx (no store).

## Future improvements

- `auth_sessions` + lastSeen heartbeat (never from analytics polling)
- Snapshot job for expensive org rankings
- Command-center PDF/Excel
- Academic term calendar
- Redis shared cache
- Dedicated recorded-lecture and course list routes instead of drawers

## KPI source table

| KPI | Definition | Authoritative source | Filters | Freshness | Drill-down |
|---|---|---|---|---|---|
| Online users | Valid presence within 120s | `auth_sessions` (missing) | org/role | 5–10s | n/a |
| Active users | Distinct users with meaningful `audit_logs` in period | `audit_logs` (heartbeats/polls excluded) | org/role/period | 15–30s | trend |
| New users | `users.created_at` in period | `users` | org/role/period | 15–30s | — |
| Total students | Distinct student/trainee role holders | `user_roles` + `roles` | org | near | `/admin/users?role=student` |
| Training opportunities | Published / in-progress opportunities | `field_training_opportunities` | uni/opportunity | near | `/admin/field-training` |
| Recorded lectures published | `status=published` | `field_training_recorded_lectures` | uni/opportunity | near | lecture list |
| Certificates issued | MC `certificates.status=issued` + training `ISSUED` | those tables | org/period | near | `/admin/certificates` |
| Completion letters | Issued letters (not certificates) | `field_training_completion_letters` | uni/opportunity/period | near | — |
| FT funnel | Current cohort state, not created_at-sliced | `field_training_applications` | uni/opportunity | historical | eligible drawer |
| Eligible | Stored official overlay / `completion_eligibility_status` | same | uni/opportunity | historical | drawer |
| Score distribution | Current official evaluation snapshots | `field_training_final_evaluations.is_current` | uni/opportunity | historical | score drawer |
| Attendance rate | present+late+excused / all recorded rows; unconfirmed ≠ absent | `field_training_attendance` | uni/opportunity | near | — |
| PRE vs POST | Submitted attempts; PRE not in final /100 | `field_training_assessment_attempts` | uni/opportunity/period | near | — |
| Lecture unique hours | Sum of `unique_watched_seconds` | lecture progress | uni/opportunity | near | top 5 |
| Lecture completion | `completed_at` vs canonical threshold | progress + env threshold | uni/opportunity | near | — |
| Currently watching | `last_watched_at` within 120s, not completed | lecture progress | uni/opportunity | live | — |
| Heatmap | Meaningful audit events by Amman DOW × 2h | `audit_logs` | org/period | historical | — |
| Courses | Content enrollments / completions | `courses`, `course_enrollments` | student scope | near | `/admin/training-courses` |
| Training programs | Institution programs | `training_programs` / enrollments | org | near | — |
| Micro-credentials | Active/approved MCs + cohort enrollments | `micro_credentials`, `enrollments` | uni | near | `/admin/micro-credentials` |
| System health | API ok + `SELECT 1` + failed letter jobs | process + DB | super admin | live | — |

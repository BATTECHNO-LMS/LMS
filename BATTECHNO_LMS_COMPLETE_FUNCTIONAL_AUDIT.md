# BATTECHNO LMS — Complete Functional Audit

**Date:** 2026-08-23  
**Mode:** READ-ONLY. No source modifications. No production writes.  
**Evidence default:** STATICALLY_VERIFIED unless marked otherwise.  
**Runtime:** BLOCKED for authenticated portals (no safe QA login in this session). Public homepage HTML was previously measured; not re-run for this audit.  
**Working tree:** Already dirty from prior cleanup/performance work. This audit adds **only** this file.

This document is the functional encyclopedia of the current codebase: portals, pages, roles, workflows, APIs, and logical inconsistencies. It does **not** list every pagination chevron as a unique product action; CRUD list/create/edit/view pages share one documented action pattern, with exceptions called out.

---

## 1. Executive Summary

BATTECHNO LMS is a **dual-portal** learning platform on one Node/Express + React codebase:

| Portal | Organization type | Primary learners | Primary staff |
| --- | --- | --- | --- |
| Universities | `UNIVERSITY` | `student` | `instructor`, university `admin`, `reviewer` |
| Institutions | `INSTITUTION` | `trainee` | `trainer`, institution `admin`, `reviewer` |
| Global | none / all | — | `super_admin` (`isGlobal`) |

The same role code **`admin`** is used for both university and institution administrators. Isolation is **not** a separate session type; it is `universityId` / `organizationId` / `organizationType` on the authenticated context plus frontend nav filters.

Two training products coexist:

1. **University academic delivery + Field Training** (cohorts, sessions, academic assessments/submissions/grades, field-training opportunities).
2. **Institution TRAINING_COURSE** (programs, trainer assignments, pre/post tests, tasks, Kirkpatrick Level 1 evaluation, completion, certificates).

**Coverage of this audit:** every frontend route in `frontend/src/app/router/index.jsx`, every backend mount in `backend/src/routes/index.js`, role/nav matrices, and end-to-end traces of the core workflows. Interactive controls on high-impact pages are inventoried individually; academic QA/risk/integrity CRUD is documented as a repeated pattern.

---

## 2. System Architecture Overview

```text
Browser (Vite SPA)
  → Host Nginx (TLS) → Docker frontend Nginx :8080
       → static hashed assets
       → /api/*  → backend :4000
       → /health, /uploads → backend

Backend Express
  → /api/auth/*          auth.routes
  → /api/v1/*            modules via routes/index.js
  → Prisma → Neon PostgreSQL
  → optional R2/S3 file storage
  → notificationEngine (in-app / email / push)
```

**Auth:** JWT. `authenticate` loads `loadCurrentAuthContext` from DB on every authenticated request (roles, org, university, permissions). Frontend `ProtectedRoute` requires login; `RoleBasedRoute` restricts shells; `RoleShellPermissionOutlet` applies UI permission path rules.

**Frontend UI permissions** (`rolePermissions.js`) are a **role matrix**, not the backend permission catalog. Admins get `ADMIN_ALL` (every UI key true). Real write/scope enforcement is backend.

---

## 3. Portal Map

| Portal key | Entry login | Register | Authenticated shell | Org type |
| --- | --- | --- | --- | --- |
| Public | `/` Home | — | none | PUBLIC |
| Portal picker | `/portals` | — | — | PUBLIC |
| University | `/universities/login` also `/login/student` `/login/instructor` `/login/reviewer` `/login/admin` | `/register` (student) | `/student`, `/instructor`, `/reviewer`, `/admin`, `/academic` | UNIVERSITY |
| Institution | `/institutions/login` | `/institutions/register` | `/trainee`, `/trainer`, `/admin` | INSTITUTION |
| Super Admin | university or institution login if `isGlobal` | — | `/admin` (all nav groups) | GLOBAL |

`RoleBasedRoute` redirects institution `trainee` off `/student/*` (except maps `training-programs` → `/trainee/courses`) and university `student` off `/trainee/*`.

Post-login landing: `resolveAuthenticatedLandingRoute` — email gate, account status, org select, then dashboard by active role (`portalConfig.resolveDashboardPathForRole`).

**No dedicated Terms page** is routed. Privacy and account-deletion exist.

---

## 4. Role Matrix

| Role | Org | Shell | Typical write | Typical read |
| --- | --- | --- | --- | --- |
| `super_admin` | GLOBAL (`isGlobal`) | `/admin` | All org-scoped APIs (`authorizeRoles` short-circuits on `isGlobal`) | All |
| `admin` UNIVERSITY | UNIVERSITY | `/admin` | University academic + FT (nav shows university groups) | Same |
| `admin` INSTITUTION | INSTITUTION | `/admin` | Institution training courses, users, content hub | Nav hides university groups; **many `/admin/*` routes still exist** |
| `reviewer` | either | `/reviewer` + `/academic` (with admin) | Backend catalog is view/export; UI has few writes | Reports, recognition, certificates, FT reports |
| `instructor` | UNIVERSITY | `/instructor` | Academic cohort delivery + assigned FT manage | Own cohorts |
| `student` | UNIVERSITY | `/student` | Apply FT, submit academic work, attendance confirm | Own data |
| `trainer` | INSTITUTION | `/trainer` | Assigned course ops (permission flags on assignment) | Assigned programs only |
| `trainee` | INSTITUTION | `/trainee` | Attendance code, task submit, assessments, evaluation | Enrolled courses |

**Denied by shell:** a `trainer` hitting `/student` gets 403 (`UnauthorizedPage`) unless also holding allowed roles. Multi-role users: `getActiveRoleCode` + `codes.some` allow any matching shell.

**Assignment requirements:** trainer APIs use `requireTrainer()` + `assertTrainerProgramAccess`. Trainee course detail requires enrollment. Student FT requires university + specialty eligibility.

**Read/write:** Reviewer should be read-only. `trainingCompletion.assertManagerAccess` **allows reviewer** (`allowReviewer = true`) on completion readiness — **read** of readiness is OK; confirm finalize still requires trainer/admin flags in `finalizeTraining`.

---

## 5. Complete Page Inventory

Status values: OK | LOGICAL_ISSUE | PARTIAL | PLACEHOLDER | ORPHAN | BLOCKED

### 5.1 Page summary table

| Page ID | Page | Route | Portal | Role(s) | Purpose | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PAGE-001 | Home / landing | `/` | PUBLIC | anonymous; authed redirected | Marketing + portal entry | OK |
| PAGE-002 | Portal picker | `/portals` | PUBLIC | anonymous | Choose university vs institution | OK |
| PAGE-003 | Login index | `/login` | PUBLIC | anonymous | Subdomain/portal-aware redirect | OK |
| PAGE-004 | Admin login | `/login/admin` | PUBLIC | anonymous | Login as admin/super_admin | OK |
| PAGE-005 | Instructor login | `/login/instructor` | UNIVERSITY | anonymous | Instructor login | OK |
| PAGE-006 | Student login | `/login/student` | UNIVERSITY | anonymous | Student login | OK |
| PAGE-007 | Reviewer login | `/login/reviewer` | UNIVERSITY | anonymous | Reviewer login | OK |
| PAGE-008 | Institution login | `/institutions/login` | INSTITUTION | anonymous | Institution staff/learner login | OK |
| PAGE-009 | Institution register | `/institutions/register` | INSTITUTION | anonymous | Org + first admin registration | OK |
| PAGE-010 | Universities login | `/universities/login` | UNIVERSITY | anonymous | University portal login | OK |
| PAGE-011 | Student register | `/register` | UNIVERSITY | anonymous | Student self-registration | OK |
| PAGE-012 | Verify email OTP | `/verify-email` | PUBLIC | pending user | Email verification | OK |
| PAGE-013 | Forgot password | `/forgot-password` | PUBLIC | anonymous | Request reset OTP | OK |
| PAGE-014 | Verify reset OTP | `/reset-password/verify` | PUBLIC | anonymous | Confirm reset OTP | OK |
| PAGE-015 | New password | `/reset-password/new` | PUBLIC | anonymous | Set new password | OK |
| PAGE-016 | Account status | `/account-status` | PUBLIC | gated user | Pending/rejected/disabled | OK |
| PAGE-017 | Select organization | `/select-organization` | SHARED | multi-assignment | Pick active org | OK |
| PAGE-018 | Certificate verify | `/verify/certificate/:code` | PUBLIC | anyone | Public certificate check | OK |
| PAGE-019 | Report verify | `/verify/report/:code` | PUBLIC | anyone | Public official-report check | OK |
| PAGE-020 | Privacy policy | `/privacy-policy` | PUBLIC | anyone | Legal | OK |
| PAGE-021 | Account deletion | `/account-deletion` | PUBLIC | anyone | Deletion request form | OK |
| PAGE-022 | Admin dashboard | `/admin/dashboard` | ADMIN | super_admin, admin | Stats + shortcuts | LOGICAL_ISSUE |
| PAGE-023 | Super Admin analytics | `/admin/analytics` | GLOBAL | super_admin (UI) | KPI/export | OK |
| PAGE-024 | Super Admin courses | `/admin/courses` | UNIVERSITY | **super_admin only** (wrapper) | Course catalog | OK |
| PAGE-025 | Course lessons | `/admin/courses/:id/lessons` | UNIVERSITY | super_admin | Lesson CMS | OK |
| PAGE-026 | Field training list | `/admin/field-training` | UNIVERSITY | FT admin roles | Opportunities | LOGICAL_ISSUE |
| PAGE-027 | FT applications | `/admin/field-training/:id/applications` | UNIVERSITY | FT admin | Review applications | OK |
| PAGE-028 | FT manage | `/admin/field-training/:id/manage` | UNIVERSITY | FT admin | Sessions/attendance/tasks | OK |
| PAGE-029 | FT tasks | `/admin/field-training/:id/tasks` | UNIVERSITY | FT admin | Task bank | OK |
| PAGE-030 | FT reports hub | `/admin/field-training/reports` | UNIVERSITY | admin, super_admin | Report entry | OK |
| PAGE-031 | FT global report | `/admin/field-training/reports/global` | GLOBAL | super_admin intended | Cross-university FT | LOGICAL_ISSUE |
| PAGE-032 | FT university report | `/admin/field-training/reports/university` | UNIVERSITY | admin, reviewer, SA | University FT report | OK |
| PAGE-033 | FT students report | `/admin/field-training/reports/students` | UNIVERSITY | admin, SA | Applications list report | OK |
| PAGE-034 | FT student report | `/admin/field-training/reports/student/:applicationId` | UNIVERSITY | admin, SA | Per-student FT report | OK |
| PAGE-035 | Help articles | `/admin/content-hub/help` | BOTH | admin, SA | CMS help | OK |
| PAGE-036 | Help create | `/admin/content-hub/help/create` | BOTH | admin, SA | Create article | OK |
| PAGE-037 | Help edit | `/admin/content-hub/help/:id/edit` | BOTH | admin, SA | Edit article | OK |
| PAGE-038 | Tours | `/admin/content-hub/tours` | BOTH | admin, SA | Product tours | OK |
| PAGE-039 | Popups | `/admin/content-hub/popups` | BOTH | admin, SA | Managed popups | OK |
| PAGE-040 | Announcements | `/admin/content-hub/announcements` | BOTH | admin, SA | Announcements | OK |
| PAGE-041 | Notification rules | `/admin/content-hub/notifications` | BOTH | admin, SA | Engine rules | OK |
| PAGE-042 | Notification send | `/admin/content-hub/notifications/send` | BOTH | admin, SA | Manual send | OK |
| PAGE-043 | Notification deliveries | `/admin/content-hub/notifications/deliveries` | BOTH | admin, SA | Delivery log | OK |
| PAGE-044 | Notification analytics | `/admin/content-hub/notifications/analytics` | BOTH | admin, SA | Engine analytics | OK |
| PAGE-045 | Contextual help | `/admin/content-hub/contextual` | BOTH | admin, SA | In-page help | OK |
| PAGE-046 | Content analytics | `/admin/content-hub/analytics` | BOTH | admin, SA | CMS analytics | OK |
| PAGE-047 | Content audit | `/admin/content-hub/audit` | BOTH | admin, SA | CMS audit | OK |
| PAGE-048 | Users list | `/admin/users` | BOTH | admin, SA | User management | LOGICAL_ISSUE |
| PAGE-049 | User create | `/admin/users/create` | BOTH | admin, SA | Create user | OK |
| PAGE-050 | User view | `/admin/users/:id` | BOTH | admin, SA | User detail | OK |
| PAGE-051 | User edit | `/admin/users/:id/edit` | BOTH | admin, SA | Edit user | OK |
| PAGE-052 | Roles & permissions | `/admin/roles-permissions` | GLOBAL | super_admin nav | Role catalog UI | PARTIAL |
| PAGE-053 | Universities list | `/admin/universities` | UNIVERSITY | admin, SA | Universities | LOGICAL_ISSUE |
| PAGE-054–056 | University CRUD | `/admin/universities/create\|:id\|:id/edit` | UNIVERSITY | admin, SA | University records | OK |
| PAGE-057 | Institutions list | `/admin/institutions` | INSTITUTION | admin, SA | Institution orgs | OK |
| PAGE-058 | Institution detail | `/admin/institutions/:id` | INSTITUTION | admin, SA | Org + trainers | OK |
| PAGE-059 | Training courses list | `/admin/training-courses` | INSTITUTION | admin, SA | TRAINING_COURSE catalog | OK |
| PAGE-060 | Create training course | `/admin/training-courses/create` | INSTITUTION | admin, SA | Create program | OK |
| PAGE-061 | Edit training course | `/admin/training-courses/:programId/edit` | INSTITUTION | admin, SA | Edit program | LOGICAL_ISSUE |
| PAGE-062 | Training course detail | `/admin/training-courses/:programId` | INSTITUTION | admin, SA | Tabbed course ops | OK |
| PAGE-063 | Lecture player (admin) | `/admin/training-courses/:programId/lectures/:lectureId` | INSTITUTION | admin, SA | Play lecture | OK |
| PAGE-064–067 | Tracks CRUD | `/admin/tracks…` | UNIVERSITY | admin, SA | Academic tracks | OK |
| PAGE-068–071 | Micro-credentials CRUD | `/admin/micro-credentials…` | UNIVERSITY | admin, SA | Credentials | OK |
| PAGE-072 | Learning outcomes | `/admin/learning-outcomes` | UNIVERSITY | admin, SA | Outcomes | OK |
| PAGE-073–076 | Cohorts CRUD | `/admin/cohorts…` | UNIVERSITY | admin, SA | Academic cohorts | OK |
| PAGE-077 | Cohort sessions | `/admin/cohorts/:id/sessions` | UNIVERSITY | admin, SA | Session list | OK |
| PAGE-078 | Create session | `/admin/cohorts/:id/sessions/create` | UNIVERSITY | admin, SA | Create session | OK |
| PAGE-079 | Pending enrollments | `/admin/enrollments` | UNIVERSITY | admin, SA | Approve/reject | OK |
| PAGE-080 | Enrollment view | `/admin/enrollments/:id` | UNIVERSITY | admin, SA | Enrollment detail | OK |
| PAGE-081 | Content management | `/admin/content` | UNIVERSITY | admin, SA | Academic modules/content | OK |
| PAGE-082 | Sessions list | `/admin/sessions` | UNIVERSITY | admin, SA | All sessions | OK |
| PAGE-083–085 | Session view/edit/attendance | `/admin/sessions/:sessionId…` | UNIVERSITY | admin, SA | Delivery | OK |
| PAGE-086 | Attendance | `/admin/attendance` | UNIVERSITY | admin, SA | Attendance ops | OK |
| PAGE-087–090 | Assessments CRUD | `/admin/assessments…` | UNIVERSITY | admin, SA | Academic assessments | OK |
| PAGE-091–093 | Rubrics | `/admin/rubrics…` | UNIVERSITY | admin, SA | Rubrics | OK |
| PAGE-094 | Submissions | `/admin/submissions` | UNIVERSITY | admin, SA | Academic submissions | LOGICAL_ISSUE |
| PAGE-095 | Grades | `/admin/grades` | UNIVERSITY | admin, SA | Academic grades | LOGICAL_ISSUE |
| PAGE-096 | Evidence | `/admin/evidence` | UNIVERSITY | admin, SA | Evidence files | OK |
| PAGE-097 | QA dashboard | `/admin/qa` | UNIVERSITY | admin, SA | QA overview | OK |
| PAGE-098–101 | QA reviews CRUD | `/admin/qa-reviews…` | UNIVERSITY | admin, SA | QA cases | OK |
| PAGE-102–105 | Corrective actions CRUD | `/admin/corrective-actions…` | UNIVERSITY | admin, SA | CAPA | OK |
| PAGE-106 | At-risk students | `/admin/at-risk-students` | UNIVERSITY | admin, SA | Risk list | OK |
| PAGE-107–110 | Risk cases CRUD | `/admin/risk-cases…` | UNIVERSITY | admin, SA | Risk cases | OK |
| PAGE-111–114 | Integrity cases CRUD | `/admin/integrity-cases…` | UNIVERSITY | admin, SA | Integrity | OK |
| PAGE-115–118 | Recognition CRUD | `/admin/recognition-requests…` | UNIVERSITY | admin, SA | Recognition | OK |
| PAGE-119 | Certificates list | `/admin/certificates` | BOTH | admin, SA | Issue/list | OK |
| PAGE-120 | Certificate issue | `/admin/certificates/issue` | BOTH | admin, SA | Issue form | LOGICAL_ISSUE |
| PAGE-121 | Certificate detail | `/admin/certificates/:id` | BOTH | admin, SA, reviewer | Certificate | OK |
| PAGE-122 | Admin notifications | `/admin/notifications` | BOTH | admin, SA | Inbox | OK |
| PAGE-123 | Notification prefs | `/admin/notification-settings` | BOTH | authed | Preferences | OK |
| PAGE-124 | Reports | `/admin/reports` | BOTH | admin, SA | Generic reports page | PARTIAL |
| PAGE-125 | Audit logs | `/admin/audit-logs` | GLOBAL | super_admin nav | Audit | OK |
| PAGE-126 | Audit log detail | `/admin/audit-logs/:id` | GLOBAL | super_admin | Audit row | OK |
| PAGE-127 | Settings | `/admin/settings` | GLOBAL | super_admin nav | System settings | PARTIAL |
| PAGE-128 | Admin 404 | `/admin/*` unknown | ADMIN | admin, SA | Not found | OK |
| PAGE-129 | Help redirect | `/admin/help` | ADMIN | admin, SA | Redirect to content-hub | OK |
| PAGE-130 | FT reports alias | `/admin/field-training-reports` | ADMIN | — | Redirect to hub | OK |
| PAGE-131 | Trainer dashboard | `/trainer` | INSTITUTION | trainer | Assigned courses summary | OK |
| PAGE-132 | Trainer courses | `/trainer/courses` | INSTITUTION | trainer | Course list | OK |
| PAGE-133 | Trainer course | `/trainer/courses/:programId[/:tab]` | INSTITUTION | trainer | Operational tabs | OK |
| PAGE-134 | Trainer course edit | `/trainer/courses/:programId/edit` | INSTITUTION | trainer | Edit metadata | OK |
| PAGE-135 | Trainer lecture player | `/trainer/courses/:programId/lectures/:lectureId` | INSTITUTION | trainer | Play | OK |
| PAGE-136 | Trainer notifications | `/trainer/notifications` | INSTITUTION | trainer | Inbox | OK |
| PAGE-137 | Trainer prefs | `/trainer/notification-settings` | INSTITUTION | trainer | Prefs | OK |
| PAGE-138–141 | Trainer user-guide | `/trainer/user-guide…` | INSTITUTION | trainer | Help | OK |
| PAGE-142 | Trainer profile | `/trainer/profile` | INSTITUTION | trainer | Profile | OK |
| PAGE-143 | Trainer unknown | `/trainer/*` | INSTITUTION | trainer | Placeholder | PLACEHOLDER |
| PAGE-144 | Trainee dashboard | `/trainee` | INSTITUTION | trainee | My courses | OK |
| PAGE-145 | Trainee courses | `/trainee/courses` | INSTITUTION | trainee | Enrolled list | OK |
| PAGE-146 | Trainee course detail | `/trainee/courses/:programId[/:tab]` | INSTITUTION | trainee | Learn + submit | OK |
| PAGE-147 | Trainee lecture | `/trainee/courses/:programId/lectures/:lectureId` | INSTITUTION | trainee | Play | OK |
| PAGE-148 | Trainee certificates | `/trainee/certificates` | INSTITUTION | trainee | Certificates | OK |
| PAGE-149–153 | Trainee notif/guide/profile | `/trainee/notifications` etc. | INSTITUTION | trainee | Support | OK |
| PAGE-154 | Trainee unknown | `/trainee/*` | INSTITUTION | trainee | Placeholder | PLACEHOLDER |
| PAGE-155 | Instructor dashboard | `/instructor/dashboard` | UNIVERSITY | instructor | Teaching home | OK |
| PAGE-156 | My cohorts | `/instructor/cohorts` | UNIVERSITY | instructor | Assigned cohorts | OK |
| PAGE-157–160 | Instructor cohort/session CRUD | `/instructor/cohorts/:id…` | UNIVERSITY | instructor | Delivery | OK |
| PAGE-161 | Instructor sessions | `/instructor/sessions` | UNIVERSITY | instructor | Sessions | OK |
| PAGE-162 | Instructor attendance | `/instructor/attendance` | UNIVERSITY | instructor | Attendance | OK |
| PAGE-163–166 | Instructor assessments | `/instructor/assessments…` | UNIVERSITY | instructor | Create/edit/view | OK |
| PAGE-167 | Instructor submissions | `/instructor/submissions` | UNIVERSITY | instructor | Grade queue | OK |
| PAGE-168 | Grade submission | `/instructor/submissions/:submissionId/grade` | UNIVERSITY | instructor | Grade form | OK |
| PAGE-169–170 | Instructor grades | `/instructor/grades…` | UNIVERSITY | instructor | Grades | OK |
| PAGE-171–174 | Instructor evidence | `/instructor/evidence…` | UNIVERSITY | instructor | Evidence | OK |
| PAGE-175 | Risk students | `/instructor/risk-students` | UNIVERSITY | instructor | At-risk | OK |
| PAGE-176 | Instructor FT | `/instructor/field-training` | UNIVERSITY | instructor | Assigned opportunities | OK |
| PAGE-177–184 | Instructor FT subpages | `/instructor/field-training/:id/…` | UNIVERSITY | instructor | Manage/participants/sessions/attendance/tasks/submissions/results/eligibility | OK |
| PAGE-185–189 | Instructor guide/notif | `/instructor/user-guide…` `/notifications` | UNIVERSITY | instructor | Support | OK |
| PAGE-190 | Instructor unknown | `/instructor/*` | UNIVERSITY | instructor | Placeholder | PLACEHOLDER |
| PAGE-191 | Instructor at-risk alias | `/instructor/at-risk-students` | UNIVERSITY | instructor | Redirect | OK |
| PAGE-192 | Student entry | `/student` | UNIVERSITY | student | Redirect dashboard | OK |
| PAGE-193 | Student dashboard | `/student/dashboard` | UNIVERSITY | student | Overview widgets | PERF-OBS |
| PAGE-194 | Student courses | `/student/courses` | UNIVERSITY | student | Enrolled e-courses | OK |
| PAGE-195 | Student course detail | `/student/courses/:id` | UNIVERSITY | student | Course content | OK |
| PAGE-196 | Training programs (student) | `/student/training-programs` | UNIVERSITY / redirect | student | Institution programs or redirect trainee | LOGICAL_ISSUE |
| PAGE-197 | Field training catalog | `/student/field-training` | UNIVERSITY | student | Opportunities | OK |
| PAGE-198 | FT detail | `/student/field-training/:id` | UNIVERSITY | student | Apply + progress | OK |
| PAGE-199 | FT progress alias | `/student/field-training/:id/progress` | UNIVERSITY | student | Redirect into detail | OK |
| PAGE-200 | FT self-evaluation | `/student/field-training/:opportunityId/tasks/:taskId/self-evaluation` | UNIVERSITY | student | Self eval | OK |
| PAGE-201 | Available cohorts | `/student/available-cohorts` | UNIVERSITY | student | Self-enroll request | OK |
| PAGE-202 | Semester schedule | `/student/semester-schedule` | UNIVERSITY | student | Calendar | OK |
| PAGE-203 | My programs | `/student/programs` | UNIVERSITY | student | Enrolled programs | OK |
| PAGE-204 | Program detail | `/student/programs/:id` | UNIVERSITY | student | Program | OK |
| PAGE-205 | Content | `/student/content` | UNIVERSITY | student | Learning content | OK |
| PAGE-206 | Student sessions | `/student/sessions` | UNIVERSITY | student | Sessions | OK |
| PAGE-207 | Student attendance | `/student/attendance` | UNIVERSITY | student | Confirm attendance | OK |
| PAGE-208 | Student assessments | `/student/assessments` | UNIVERSITY | student | List | OK |
| PAGE-209 | Academic submit | `/student/assessments/:assessmentId/submit` | UNIVERSITY | student | Submit work | OK |
| PAGE-210 | Student submissions | `/student/submissions` | UNIVERSITY | student | Own submissions | LOGICAL_ISSUE |
| PAGE-211 | Student grades | `/student/grades` | UNIVERSITY | student | Own grades | LOGICAL_ISSUE |
| PAGE-212 | Student certificate | `/student/certificate` | UNIVERSITY | student | Certificates | OK |
| PAGE-213–217 | Student guide/notif | `/student/user-guide…` | UNIVERSITY | student | Support | OK |
| PAGE-218 | Student enrollments alias | `/student/enrollments` | UNIVERSITY | student | Redirect programs | OK |
| PAGE-219 | Student unknown | `/student/*` | UNIVERSITY | student | Placeholder | PLACEHOLDER |
| PAGE-220 | Academic FT hub | `/academic/field-training/reports` | UNIVERSITY | admin, reviewer | Academic reports | OK |
| PAGE-221 | Academic FT university report | `/academic/field-training/reports/university` | UNIVERSITY | admin, reviewer | University report | OK |
| PAGE-222 | Academic FT students | `/academic/field-training/students` | UNIVERSITY | admin, reviewer | Students | OK |
| PAGE-223 | Academic FT opportunities | `/academic/field-training/opportunities` | UNIVERSITY | admin, reviewer | Read list | OK |
| PAGE-224 | Academic FT opportunity | `/academic/field-training/opportunities/:opportunityId` | UNIVERSITY | admin, reviewer | Read detail | OK |
| PAGE-225 | Academic student report | `/academic/field-training/reports/student/:applicationId` | UNIVERSITY | admin, reviewer | Student report | OK |
| PAGE-226 | Reviewer dashboard | `/reviewer/dashboard` | UNIVERSITY | reviewer | Review home | OK |
| PAGE-227 | Enrollment requests | `/reviewer/enrollment-requests` | UNIVERSITY | reviewer | View pending | OK |
| PAGE-228–229 | Recognition | `/reviewer/recognition-requests…` | UNIVERSITY | reviewer | View | OK |
| PAGE-230 | University reports | `/reviewer/university-reports` | UNIVERSITY | reviewer | Reports | OK |
| PAGE-231–235 | Reviewer FT reports | `/reviewer/field-training/reports…` | UNIVERSITY | reviewer | FT reports | OK |
| PAGE-236 | Evidence viewer | `/reviewer/evidence` | UNIVERSITY | reviewer | Read evidence | OK |
| PAGE-237–238 | Reviewer certificates | `/reviewer/certificates…` | UNIVERSITY | reviewer | Review certificates | OK |
| PAGE-239–243 | Reviewer guide/notif | `/reviewer/user-guide…` | UNIVERSITY | reviewer | Support | OK |
| PAGE-244 | Reviewer unknown | `/reviewer/*` | UNIVERSITY | reviewer | Placeholder | PLACEHOLDER |
| PAGE-245 | Catch-all | `*` | PUBLIC | — | Navigate `/` | OK |

**Terms of service page:** not routed (MISSING_ACTION / missing page, not a broken button).

---

### 5.2 Representative page entries (why the page exists)

**PAGE-001 Home**  
Arabic: الصفحة الرئيسية. Component: `Home.jsx`.  
Purpose: public marketing and portal choice.  
Business: convert visitors to university vs institution login.  
Data: `GET /api/v1/public/landing-stats` (cached 60s locally).  
Entry: `/`. Exit: portal CTAs → `/universities/login`, `/institutions/login`, `/register`, `/institutions/register`.  
Authed users: `RootRedirect` sends them to dashboard (never stay on Home).

**PAGE-022 Admin dashboard**  
Purpose: one-screen counts for the signed-in admin context.  
API: `GET /api/v1/dashboard` → `getAdminDashboardStats` (users, universities, cohorts, assessments, pending_enrollments, recent_activity).  
Institution admins also see training-course shortcuts.  
**LOGICAL_ISSUE:** metrics are **academic** (cohorts/assessments/pending enrollments). Institution admin sees university-shaped KPIs that may be zero or scoped oddly if `universityId` is null.

**PAGE-062 / PAGE-133 / PAGE-146 Course detail (admin / trainer / trainee)**  
Purpose: operate or take a TRAINING_COURSE without leaving one URL.  
Admin/trainer: tabs load extra APIs when opened. Trainee: `GET /training/trainee/programs/:id?sections=` overview first.  
Business: full lifecycle in one place.

**PAGE-197–198 Student field training**  
Purpose: discover eligible opportunities, apply, then train.  
APIs under `/api/v1/student/field-training`.

Full field list of remaining pages follows the table in §5.1: each is a standard list/detail/form for the named entity, reached from admin/instructor/student nav, backed by the matching `/api/v1/{resource}` module.

---

## 6. Complete Action / Button Inventory

### 6.1 Action summary (high-impact)

| Action ID | Page | Button/Action | Role | API | Effect | Assessment |
| --- | --- | --- | --- | --- | --- | --- |
| ACT-001 | PAGE-001 | University portal CTA | public | none | navigate login | CORRECT |
| ACT-002 | PAGE-001 | Institution portal CTA | public | none | navigate login | CORRECT |
| ACT-003 | PAGE-001 | Student register CTA | public | none | `/register` | CORRECT |
| ACT-004 | PAGE-010/008 | Login submit | public | `POST /api/auth/login` | JWT + landing | CORRECT |
| ACT-005 | PAGE-011 | Register submit | public | `POST /api/auth/register` | user pending | CORRECT |
| ACT-006 | PAGE-009 | Institution register | public | `POST /api/auth/institutions/register` | org+admin | CORRECT |
| ACT-007 | PAGE-012 | Verify OTP | user | `POST /api/auth/verify-email-otp` | email verified | CORRECT |
| ACT-008 | PAGE-012 | Resend OTP | user | `POST /api/auth/resend-email-otp` | new OTP | CORRECT |
| ACT-009 | PAGE-013 | Forgot password | public | `POST /api/auth/forgot-password` | OTP email | CORRECT |
| ACT-010 | PAGE-015 | Reset password | public | `POST /api/auth/reset-password` | password change | CORRECT |
| ACT-011 | PAGE-017 | Select organization | multi | `POST /api/auth/me/active-organization` | switch org | CORRECT |
| ACT-012 | PAGE-018 | Verify certificate | public | `GET /api/v1/training/certificates/verify/:code` | display | CORRECT |
| ACT-013 | PAGE-021 | Request deletion | public | `POST /api/v1/account/deletion` (accountDeletion) | request row | CORRECT |
| ACT-014 | PAGE-022 | Retry dashboard | admin | `GET /dashboard` refetch | READ | CORRECT |
| ACT-015 | PAGE-022 | Create training course | inst admin | navigate create | NONE | CORRECT |
| ACT-016 | PAGE-048 | Create user | admin | `POST /users` | CREATE | CORRECT |
| ACT-017 | PAGE-048 | Export users Excel | SA/admin | users export | READ file | CORRECT |
| ACT-018 | PAGE-059 | Create course | inst admin | navigate | NONE | CORRECT |
| ACT-019 | PAGE-060 | Save new course | inst admin | `POST /training/organizations/:orgId/programs` | CREATE DRAFT | CORRECT |
| ACT-020 | PAGE-062 | Tab switch | admin | tab-gated fetches | READ | CORRECT |
| ACT-021 | PAGE-062 | Publish / status | admin | `PATCH /training/programs/:id` | UPDATE status | QUESTIONABLE |
| ACT-022 | PAGE-062 | Create cohort | admin | `POST /training/programs/:id/cohorts` | CREATE | CORRECT |
| ACT-023 | PAGE-062 | Enroll / import trainees | admin | enroll + import endpoints | CREATE | CORRECT |
| ACT-024 | PAGE-062 | Assign trainer | admin | `POST …/trainer-assignments` | CREATE | CORRECT |
| ACT-025 | PAGE-062 | Create session | admin | `POST /training/cohorts/:id/sessions` | CREATE | CORRECT |
| ACT-026 | PAGE-062 | Open attendance window | admin/trainer | `POST …/sessions/:id/attendance-window` | UPDATE + code | CORRECT |
| ACT-027 | PAGE-062 | Mark present/all | admin/trainer | attendance APIs | UPDATE | CORRECT |
| ACT-028 | PAGE-062 | Add material/lecture | admin | materials APIs | CREATE | CORRECT |
| ACT-029 | PAGE-062 | Create/publish task | admin | task APIs | CREATE | CORRECT |
| ACT-030 | PAGE-062 | Pre/post editor | admin | assessment APIs | CREATE/UPDATE | CORRECT |
| ACT-031 | PAGE-062 | Finalize training | admin/trainer | `POST …/programs/:id/finalize` | UPDATE enrollments | CORRECT |
| ACT-032 | PAGE-062 | Reopen training | admin | `POST …/reopen` | UPDATE | CORRECT |
| ACT-033 | PAGE-062 | Generate report PDF/Excel | admin | report generate + download | CREATE file | CORRECT |
| ACT-034 | PAGE-133 | Trainer tab actions | trainer | same family, assignment-scoped | mixed | CORRECT |
| ACT-035 | PAGE-146 | Confirm attendance | trainee | `POST …/attendance/confirm` | UPDATE | CORRECT |
| ACT-036 | PAGE-146 | Submit task | trainee | `POST …/tasks/:id/submit` | CREATE submission | CORRECT |
| ACT-037 | PAGE-146 | Start/submit PRE/POST | trainee | start/save/submit attempt | CREATE/UPDATE | CORRECT |
| ACT-038 | PAGE-146 | Submit evaluation | trainee | evaluation submit | UPDATE | CORRECT |
| ACT-039 | PAGE-197 | Apply to opportunity | student | `POST /student/field-training/:id/apply` | CREATE application | CORRECT |
| ACT-040 | PAGE-198 | Confirm FT attendance | student | FT attendance confirm | UPDATE | CORRECT |
| ACT-041 | PAGE-198 | Submit FT task | student | FT task submit | CREATE | CORRECT |
| ACT-042 | PAGE-027 | Approve/reject application | FT admin | `PATCH` application status | UPDATE | CORRECT |
| ACT-043 | PAGE-079 | Approve enrollment | uni admin | enrollments approve | UPDATE | CORRECT |
| ACT-044 | PAGE-209 | Academic submit | student | `POST /assessments/:id/submissions` | CREATE | CORRECT |
| ACT-045 | PAGE-168 | Grade + finalize | instructor | grades APIs | UPDATE | CORRECT |
| ACT-046 | Header | Notification bell | authed | unread-count; list when open | READ | CORRECT |
| ACT-047 | Header | Logout | authed | `POST /api/auth/logout` | session end | CORRECT |
| ACT-048 | PAGE-023 | Export analytics xlsx | SA | analytics export | READ | CORRECT |
| ACT-049 | PAGE-124 | Open report | admin | reports API | READ | INCOMPLETE |
| ACT-050 | PAGE-120 | Issue certificate | admin | `POST /certificates` | CREATE | QUESTIONABLE |

### 6.2 CRUD action pattern (applies to PAGE-048–118 academic CMS)

Each list page typically has: Search, Filters, Pagination, Create, row View/Edit/Delete.  
Create/Edit: Save (POST/PATCH), Cancel (navigate back).  
Delete: often confirm then DELETE or status archive.

| Control | API shape | DB | Confirmation |
| --- | --- | --- | --- |
| List | `GET /api/v1/{resource}?page&page_size&q` | READ | NO |
| Create save | `POST /api/v1/{resource}` | CREATE | NO |
| Update save | `PATCH /api/v1/{resource}/:id` | UPDATE | NO |
| Delete | `DELETE` or status field | DELETE/UPDATE | often YES |
| Export | GET blob | READ | NO |

**Assessment:** CORRECT as a pattern. Individual field mismatches are LOGIC items, not dead buttons.

### 6.3 Trainee course tabs (PAGE-146)

| Tab | Loads | Primary actions |
| --- | --- | --- |
| overview | `sections=overview` | none |
| sessions | `sections=sessions` | enter attendance code, submit confirm |
| lectures / materials | `sections=materials` | open URL / file |
| tasks | `sections=tasks` | text + FileUploader, submit; instruction download |
| assessments | panel own API | start/resume/submit PRE/POST |
| evaluation | EvaluationWizard | draft/autosave/submit |
| progress | overview progress | none |
| report | IndividualReportView | view; export if offered |
| certificate | `sections=certificate` | show number/code |

### 6.4 Trainer course tabs (PAGE-133)

Overview (counts only) → sessions/attendance (sessions section) → trainees/progress (trainees section) → materials/tasks/assessments via lazy managers → finalization/reports via readiness API.

### 6.5 Modal/dialog pattern

`AppModal`: open from button, fields + Save/Cancel. Escape/outside-click typically close without save (component default). Confirmation modals for delete/finalize use `window.confirm` in several trainer/admin flows (native).

---

## 7–15. Portal / role chapters (condensed encyclopedia)

### 7. University Portal

Shells: student, instructor, reviewer, university admin, `/academic`.  
Solves: academic micro-credentials, cohorts, field training, quality/accreditation.

**Student journey:** dashboard → FT catalog → apply → (admin approve) → sessions/attendance/tasks/assessments → completion/report/certificate. Parallel academic: available-cohorts → enroll request → content/sessions/assessments/submit/grades.

**Instructor journey:** dashboard → my cohorts → sessions/attendance → assessments/submissions/grades → assigned FT manage.

**University admin:** users, universities, tracks, credentials, cohorts, enrollments, FT opportunities, QA, certificates.

### 8. Institution Portal

Shells: trainee, trainer, institution admin.  
Solves: corporate TRAINING_COURSE delivery with trainer assignment permissions.

**Trainee:** dashboard → course → pre-test (may lock content) → sessions/materials/tasks/post-test → evaluation → wait for finalize → certificate.

**Trainer:** only assigned programs; flags `canManageSessions`, `canGradeTasks`, etc.

**Institution admin:** institutions, training-courses, users (trainee/trainer/admin/reviewer), content hub, certificates.

### 9. Super Admin

`isGlobal` bypasses `authorizeRoles`. Nav: analytics, courses (wrapper **super_admin only**), settings, audit logs, roles, both university and institution groups.  
Can open any `/admin/*` route. Organization switching via assignments if present.

### 10. Admin (shared role)

**University Admin:** nav `portal: UNIVERSITY`.  
**Institution Admin:** nav `portal: INSTITUTION`.  
**Both:** dashboard, users, notifications, content-hub, certificates, reports.  
**Ambiguity:** route `/admin/universities` is still in the router for any `ADMIN_ROLE_SET` user. Nav hides it for institution admins; **direct URL still loads the page** unless a page-level org check exists (many list pages rely on backend 403). This is a **frontend/backend mismatch** (LOGIC-003).

### 11. Reviewer

Read-oriented: dashboard, enrollment requests, recognition, university reports, FT reports, evidence, certificates.  
Nav `canViewUniversityReports`. `/academic/*` also allows `admin` + `reviewer`.  
Write risk: completion `assertManagerAccess` allows reviewer to **read** readiness; finalize should still be trainer/admin — verify per `finalizeTraining` (trainer needs `can_finalize_training`).  
Reviewer FT list is reports, not opportunity CRUD.

### 12. Instructor

Academic delivery + FT if `assigned_instructor_id`. Duplicate nav items both go to `/instructor/field-training` (one labeled assigned, one generic) — UX duplication DUPLICATION-004.

### 13. Student

University learner. Cannot see institution trainer APIs. `TRAINEE` UI matrix clones student but `canViewFieldTraining: false`.

### 14. Trainer

Must have active assignment. Overview no longer loads 200 trainees until tab (current local code). Permissions per assignment row.

### 15. Trainee

Must be enrolled and not PENDING/INVITED. Content lock when `preTestBlocksContent` and pre-test not `ok`. Lecture playback URL now enforces the same lock (`courseContent.getMaterialPlaybackUrl`).

---

## 16. Field Training Workflow

```text
Admin creates opportunity (draft)
↓
Set eligibility (universities/specialties)
↓
Publish (draft → published)
↓
Student sees eligible list → Apply
↓
Admin approve / reject / needs update
↓
assigned instructor + sessions
↓
Attendance windows + student confirm / instructor mark
↓
Tasks publish → student submit → instructor review
↓
Assessments / hours / eligibility
↓
Completion + reports (university / student / global)
↓
Certificate if eligible
```

**States (applications):** pending, approved, rejected, cancelled (report filters).  
**Opportunity:** draft, published, closed.  
**Attendance:** present, absent, late, excused, unconfirmed.  
**Who:** student apply; admin approve; instructor manage if assigned; reviewer reports.

**Blockers:** no university/specialty on student; opportunity not published; application not approved for hours (`HOURS_APPLICATION_NOT_APPROVED`).

---

## 17. Training Course Workflow

```text
Create program (DRAFT)
↓
Configure settings (hours, attendance %, pre/post, tasks, evaluation)
↓
Create cohort
↓
Assign trainer (permissions + optional lead)
↓
Invite/enroll trainees (PENDING → APPROVED)
↓
Publish / REGISTRATION_OPEN / IN_PROGRESS
↓
Sessions + attendance windows
↓
Materials + recorded lectures
↓
Tasks publish
↓
PRE_TEST (may lock content)
↓
POST_TEST (eligibility after other requirements)
↓
Final evaluation (Kirkpatrick L1) — may lock until post-test
↓
Progress snapshot → READY_TO_COMPLETE when all required.ok
↓
Finalize (ELIGIBLE_ONLY or EXCEPTIONAL)
↓
Official reports + certificate ISSUED
```

**Enrollment statuses:** INVITED, PENDING, ACTIVE, APPROVED, REQUIREMENTS_COMPLETED, COMPLETED, NOT_COMPLETED, WITHDRAWN.

**Who:** institution admin creates/configures; trainer operates assigned scope; trainee consumes.

---

## 18. Attendance

**Institutional:** trainer/admin `openAttendanceWindow` → time-limited **code** → trainee `confirmAttendance`. Manual present/absent/late. Unconfirmed absences countable.  
**University academic / FT:** session attendance records; student confirm vs instructor mark-all-present.  
**Progress:** attendance % from countable sessions; **if sessionCount === 0, hours and attendance requirements are treated `ok: true`** (`trainingProgress.helpers`) — prevents permanent block, but a course can look “attendance complete” with zero sessions (LOGIC-008).

---

## 19. Tasks

**Institutional:** create (draft) → instruction file/links → publish (`published_at`) → trainee submit text+file → grade / revision requested → resubmit (`canSubmitTask`). Workflow service **is wired** in current tree (`trainingTaskWorkflow.service.js` + routes). Trainee UI now has FileUploader and instruction download (BUG-006 **partially fixed** vs Aug 19 audit).  
**Field training:** parallel task module under FT routes (not the same tables).

---

## 20. Assessments

### Academic (university)

Create on cohort → students submit (`POST /assessments/:id/submissions`) → instructor grade/finalize. Uniqueness: one submission per assessment+student.

### Institutional PRE_TEST / POST_TEST

Create/publish questions → trainee start attempt → save answers → submit.  
`assertAttemptNotExpired` runs on resume **and submit** (BUG-007 **fixed** in current `trainingAssessment.service.js`).  
POST_TEST blocked until `assertPostTestEligible`.  
Correct answers not sent to trainee (`includeCorrect: false`).

**Contradiction risk:** overview used to embed assessments with question counts; current `sections=overview` omits assessment payloads (good). Full `sections=all` still returns attempts, not full banks, in trainee detail mapping (questionCount only).

---

## 21. Final Evaluation

Institutional **reaction survey** (Kirkpatrick **Level 1**). Not Level 3/4.  
Level 2 ≈ PRE/POST comparison (`getPrePostComparison`).  
Flow: evaluation may be LOCKED until post-test → draft + autosave → submit → progress recompute.  
Wizard: `EvaluationWizard.jsx`. Analytics: `EvaluationAnalyticsPanel` (trainer/admin).

---

## 22. Completion

Source of truth: `computeAndPersistProgress` → `training_progress.requirements_json` + `deriveCompletionEligibility`.

Required flags (program settings): attendance, hours, tasks, final task, preTest, postTest, evaluation.

```text
All required.ok and not WITHDRAWN → ELIGIBLE / lifecycle READY_TO_COMPLETE
enrollment.status COMPLETED → COMPLETED
evaluation done but other missing → FINAL_EVALUATION_SUBMITTED
else POST_TEST_PENDING or ACTIVE
```

Finalize: `ELIGIBLE_ONLY` or `EXCEPTIONAL`. Sets COMPLETED, may issue certificates, audit + `COURSE_COMPLETED` event.  
Reopen: admin/SA → REQUIREMENTS_COMPLETED, revoke certificates.

**Contradictory sources:** enrollment.status vs progress.status vs report `completed/notCompleted` vs certificate ISSUED — they are **related but not a single field** (DUPLICATION-001).

---

## 23. Reports

| Report | Who | APIs |
| --- | --- | --- |
| Official training PDF/Excel | admin, trainer (view reports), reviewer | `/training/programs/:id/reports` generate/list/download |
| Individual trainee report | trainee (own), trainer/admin | IndividualReportView |
| FT university / student / global | admin, reviewer, SA | `/admin/field-training` report routes + academic aliases |
| Analytics | super_admin | `/analytics` + xlsx chunk on demand |
| `/admin/reports` | admin | generic `ReportsPage` — **PARTIAL** (academic-era page) |

Generate on explicit action, not merely opening overview (current intent). PDF via puppeteer; Excel via exceljs/xlsx.

**Stale:** reports snapshot at generation time; regenerate required for new scores.

---

## 24. Certificates

**Issue:** after COMPLETED / eligibility; `POST` certificates or training certificate on enrollment.  
**Download:** owner + staff with access.  
**Verify:** public PAGE-018.  
**Revoke:** reopen training revokes issued training certificates.  
**Blockers:** not eligible; not finalized; missing hours/attendance/tests as configured.

University academic certificates vs `training_certificates` are **two entities** (DUPLICATION-002).

---

## 25. Notifications

Catalog: `notificationEvents.catalog.js` (ACCOUNT, OPPORTUNITY, APPLICATION, SESSION, ATTENDANCE, TASK, TEST, PROGRESS, CERTIFICATE, …).  
Dispatcher only emits **known** event types.  
Bell: unread count on an interval; list when opened.  
Admin can configure rules/templates and send.  
**Observation:** catalog is broader than every emit site; some events may never fire (MISSING notification vs unused catalog — INFERRED).

---

## 26. Navigation

Admin nav: `adminNavigation.js` filtered by role + `organizationType` + `isGlobal`.  
Student/instructor/trainer/trainee/reviewer: `NAV_BY_ROLE`.  
**Duplicates:** instructor two items → same `/instructor/field-training`.  
**Hidden but routed:** institution admin can still type `/admin/cohorts` (LOGICAL_ISSUE).  
**Courses catalog** `/admin/courses`: nav super_admin + UNIVERSITY; wrapper **denies non-super_admin** even if they guess the URL — stricter than ADMIN_ROLE_SET parent.  
**Field training** `/admin/field-training`: wrapper allows `admin` + `super_admin` (`userHasFieldTrainingAdminRole`), not instructor.

Unknown paths under role shells → `ModulePlaceholderPage` (PLACEHOLDER), not 404, except `/admin/*` → `AdminNotFoundPage`.

---

## 27. Permission Analysis

| Layer | What it does |
| --- | --- |
| ProtectedRoute | login + account gates |
| RoleBasedRoute | shell role allowlist + portal mismatch redirects |
| RoleShellPermissionOutlet | UI_PERMISSION path map |
| Nav visibility | hide links |
| Backend authorizeRoles | role codes; **isGlobal bypass** |
| Backend org/university helpers | scope |
| Trainer assignment flags | fine-grained course ops |

**Inconsistencies:**

1. UI ADMIN_ALL vs backend scope (institution admin vs university APIs).  
2. `SuperAdminCoursesRoute` vs parent `ADMIN_ROLE_SET`.  
3. FT admin UI for any `admin` including institution admin without `universityId` — **detail access now 403** if no universityId (`assertAdminOpportunityAccess`); **list** still depends on `isFieldTrainingAdmin` + `resolveUniversityIdFilter` (null uni → undefined filter for non-global: `return uni || undefined` means **no university filter**). **LOGIC-001 still present for LIST if institution admin is in FIELD_TRAINING_ADMIN_ROLE_CODES.**  
4. `GET /students/:id/submissions` now `requireOrganizationType('UNIVERSITY')` + staff must have universityId (BUG-002 **partially fixed**).  
5. Student listing classmates: `listByStudent` forbids other students; **assessment submissions list** still needs own-row filter (BUG-003 — re-verify `submissions.service` list-by-assessment).

---

## 28. Logical Errors

| ID | Severity | Page | Action/Workflow | Current Behavior | Problem |
| -- | -------- | ---- | --------------- | ---------------- | ------- |
| LOGIC-001 | CRITICAL | FT admin list | List opportunities | `resolveUniversityIdFilter` returns `undefined` when `universityId` is null for non-global users | Institution `admin` may see all FT rows if treated as FT admin. Detail fetch now 403 without uni. **Likely still present on list.** |
| LOGIC-002 | HIGH | Dual `admin` | Direct URLs | Nav hides university pages; router still registers them | Institution admin can open university shells; API may 403 or leak |
| LOGIC-003 | HIGH | Academic lists | Staff dumps | Historical classmate leak on assessment submissions | Recheck list-by-assessment; student `listByStudent` is own-or-staff |
| LOGIC-004 | MEDIUM | PAGE-022 | Dashboard KPIs | Academic counts shown to institution admin | Misleading zeros / wrong product |
| LOGIC-005 | MEDIUM | Hours/attendance | Completion | Zero sessions ⇒ requirements `ok: true` | Can finalize without any attendance reality |
| LOGIC-006 | MEDIUM | PAGE-196 | training-programs | Dual meaning university vs institution redirect | Confusing label vs destination |
| LOGIC-007 | LOW | Instructor nav | Two FT items | Same route | Duplicate |
| LOGIC-008 | LOW | Placeholder catch-alls | Unknown URL | “Module coming soon” not 404 | Misleading empty |
| LOGIC-009 | MEDIUM | `/admin/reports` | Reports | Academic-era page vs training/FT engines | Two report UIs |
| LOGIC-010 | LOW | No `/terms` | Legal | Privacy exists, terms do not | Incomplete legal set |

**Known-issue recheck vs `BATTECHNO_LMS_FULL_BUG_AUDIT.md` (2026-08-19):**

| Bug ID | Now |
| --- | --- |
| BUG-001 FT list null university | **still present (list filter)**; detail **partially fixed** |
| BUG-002 students API | **partially fixed** (`requireOrganizationType('UNIVERSITY')` + universityId check) |
| BUG-003 classmate submissions | **not fully re-proven**; student-by-id path improved |
| BUG-005 missing task workflow module | **fixed** in current tree (service + trainee submit UI) |
| BUG-006 trainee task files | **partially fixed** (FileUploader + instructions) |
| BUG-007 timer on submit | **fixed** (`assertAttemptNotExpired` in `submitAttempt`) |
| BUG-008 question banks on overview | **mitigated** by `sections=overview` omitting assessments |
| BUG-011 playback lock | **fixed** in `getMaterialPlaybackUrl` |
| BUG-010 settings overwrite | **not re-verified** this pass |

---

## 29. Dead / Broken / Missing Actions

| Class | Finding | Evidence |
| --- | --- | --- |
| DEAD_ACTION | Deleted landing leftovers (`HomeHeader`, hero stacks) | removed in cleanup; not in router |
| PLACEHOLDER | `ModulePlaceholderPage` on `*` of 5 shells | `index.jsx` |
| MISSING_ACTION | No Terms route | router inventory |
| MISSING_ACTION | Trainee cannot self-enroll in published course if not invited (by design unless import) | enrollment statuses |
| BROKEN_API_MAPPING | FE `endpoints.js` dropped unused `auth.refresh`, `ai.*` in cleanup | unused vs `backend ai.routes` still mounted |
| UNUSED_OR_EXTERNAL_API | `GET /api/v1/ai/test`, `GET /students` family, files health | no current FE caller; ops/CLI possible |
| FAKE_UI | None confirmed as “badge-only publish” on training status — status PATCH is real | STATICALLY_VERIFIED |

---

## 30. Orphan / Placeholder Pages

**ORPHAN_PAGE:** none of the routed pages are unreachable from *some* role, except super-admin-only wrappers. Institution-hidden university pages are **reachable by URL** (not orphan; over-exposed).

**PLACEHOLDER:** PAGE-143, 154, 190, 219, 244 (`*` → ModulePlaceholderPage).  
**Admin 404** is a real not-found, not “coming soon”.

**Deleted orphans (cleanup):** `AdminHelpCenterPage` — `/admin/help` redirects to content-hub.

---

## 31. Duplicate Concepts

| ID | Pair | Risk |
| --- | --- | --- |
| DUPLICATION-001 | enrollment.status vs training_progress.status vs report completion | Conflicting UI labels |
| DUPLICATION-002 | `certificates` vs `training_certificates` | Two issue/verify paths |
| DUPLICATION-003 | Academic assessments vs `training_assessments` | Same Arabic word “اختبارات” |
| DUPLICATION-004 | Instructor nav duplicate FT links | UX |
| DUPLICATION-005 | `/admin/field-training/reports` vs `/academic/field-training/reports` vs `/reviewer/field-training/reports` | Three hubs, overlapping components |
| DUPLICATION-006 | UI_PERMISSION matrix vs backend permissionCatalog | Two auth stories |
| DUPLICATION-007 | Student vs trainee task/attendance engines | Parallel implementations |

---

## 32. Performance Observations

| ID | Observation |
| --- | --- |
| PERF-OBS-001 | Student dashboard ~9 parallel React Query calls (`page_size` assessments now 30) |
| PERF-OBS-002 | Neon ~600 ms floor on `SELECT 1` (prior production measure) |
| PERF-OBS-003 | Live JS/CSS uncompressed until deploy (prior performance report) |
| PERF-OBS-004 | Landing-stats 60s cache (local, not necessarily production) |
| PERF-OBS-005 | Trainee/trainer overview tab-lazy (local) |

Do not treat these as functional bugs.

---

## 33. UX / Accessibility Observations

- Many icon-only table actions: some have `aria-label` via `TableIconActions`; not universal.  
- Native `window.confirm` for destructive trainer session cancel — not accessible modal.  
- Wide admin tables: likely horizontal scroll on mobile.  
- RTL is first-class (`dir=rtl`).  
- Loading: full-page spinner on course detail until overview returns; tab spinner after.  
- Empty: `EmptyState` generally GOOD; placeholder catch-all is MISLEADING_EMPTY_STATE (“module” vs 404).

---

## 34. API Map

**Auth (`/api/auth`):** login, logout, register, institution register, universities list for register, OTP verify/resend, password reset, `/me`, assignments, active-organization, account-status.

**Versioned (`/api/v1`):** users, admin/reviewers, roles, universities, organizations, **training** (large), kpi, specialties, tracks, micro-credentials, learning-outcomes, cohorts, student, enrollments, modules, sessions, attendance-records, assessments, rubrics, submissions, grades, students, rubric-criteria, evidence, qa-reviews, corrective-actions, risk-cases, integrity-cases, recognition-requests/documents, certificates, notifications, analytics, reports, audit-logs, dashboard, settings, admin/courses, student/courses, admin/instructor/student/academic field-training, mobile/push, account, files, ai, public, help, popups, announcements, notification-rules/templates/ops.

**Health:** `GET /health`, `GET /health/ready`.

**UNUSED_OR_EXTERNAL_API:** `/ai/test`, `/ai/status`, `/files` health (if present), `GET /students/:id/*` (staff tools; FE may not call).

---

## 35. Data Model Functional Map

```text
users ──< user_roles / assignments >── organizations (UNIVERSITY | INSTITUTION)
  │
  ├─ primary_university_id ── universities ── specialties
  │
  UNIVERSITY academic:
  tracks → micro_credentials → cohorts → enrollments (student)
       → sessions → attendance_records
       → assessments → submissions → grades
  field_training_opportunities → eligibility → applications
       → sessions/tasks/attendance (FT tables)
  │
  INSTITUTION training:
  training_programs (TRAINING_COURSE) → training_cohorts → training_enrollments
       → training_sessions → training_attendance_records
       → training_tasks → training_task_submissions
       → training_assessments → attempts/questions
       → training_materials (incl. RECORDED_LECTURE)
       → training_progress
       → training_evaluation_responses
       → training_certificates
       → training_trainer_assignments (permission flags)
  │
  Cross-cutting: notifications, audit_logs, files, certificates (academic), help CMS
```

---

## 36. Recommended Future Fix Priorities

*(Direction only — not implemented.)*

1. Never treat null `universityId` as global FT list (LOGIC-001).  
2. Bind `admin` to `organizationType` on **routes**, not only nav.  
3. Unify completion status display (enrollment vs progress vs reports).  
4. Replace shell `*` placeholders with 404.  
5. Decide one FT reports hub.  
6. Deploy gzip/cache (ops), not a product-logic fix.

---

## 37. Coverage / Blocked Areas

| Area | Evidence |
| --- | --- |
| Router page inventory | STATICALLY_VERIFIED — complete vs `index.jsx` |
| Backend mounts | STATICALLY_VERIFIED — `routes/index.js` |
| Every table icon on QA/risk/integrity | INFERRED via CRUD pattern |
| Authenticated click-through | BLOCKED |
| Production mutation | not done |
| Mobile real devices | INFERRED from CSS |
| Notification every emit vs catalog | INFERRED / partial |
| Source code modified this task | **NO** |

**Runtime verified:** none of the authenticated buttons in this session.  
**Statically verified:** routes, nav, completion derivation, FT access helpers, trainee/trainer tabs, assessment expiry on submit, lecture playback lock.

---

## Forms (cross-cutting)

Login: email + password. Backend validates credentials + portal hints.  
Register student: name, email, university, specialty, password. Backend requires university for student.  
Institution register: org fields + first admin.  
Course create: title required; type forced TRAINING_COURSE (university FT type rejected).  
OTP: 6-digit; resend cooldown.  
**Mismatch class:** frontend required vs backend optional exists on large program PATCH bodies (`strict` zod vs extra UI fields) — treat as product review, not proven bug without field-by-field table.

## Destructive actions

| Action | Confirm | Audit | Reversible |
| --- | --- | --- | --- |
| Finalize training | UI confirm typical | recordAudit | reopen (admin) |
| Reopen | reason | audit | certificates revoked |
| Delete material/lecture | often confirm | audit | NO |
| Reject application | yes | notify | re-apply depends |
| Delete user | confirm | audit | NO |
| Session cancel | window.confirm | update status | NO |

## Duplicate submission

Login/register: can double-click; backend should reject duplicate email.  
Task/assessment submit: `busy` flags on trainee forms; assessment uniqueness on academic create.  
Finalize: not idempotent in the business sense (second call should no-op or error — STATICALLY_VERIFIED as service checks status).

---

## End-to-end diagrams (required set)

**University student FT**

```text
Login → Student dashboard → Field training list → Opportunity → Apply
→ Admin approve → Sessions/attendance/tasks → Eligibility → Report/certificate
```

**Institution trainee course**

```text
Login → Trainee dashboard → Course overview → (Pre-test if required)
→ Sessions/materials/tasks → Post-test → Evaluation → Wait finalize → Certificate
```

**Trainer ops**

```text
Login → Courses → Course overview → Sessions/attendance → Tasks/grade
→ Assessments → Progress → Finalization/reports
```

**University admin**

```text
Login → Dashboard → Users/cohorts/FT → Approve applications → Reports
```

**Institution admin**

```text
Login → Dashboard → Training courses → Create/configure → Assign trainer
→ Enroll → Monitor finalization
```

**Reviewer**

```text
Login → Dashboard → FT reports / recognition / certificates (read)
```

**Completion / assessment / task / attendance / report / certificate** — see §§16–24.

---

*End of functional audit. Source files were not modified.*

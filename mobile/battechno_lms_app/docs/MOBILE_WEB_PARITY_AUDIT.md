# MOBILE-WEB-PARITY-AUDIT-001

**Product:** BATTECHNO LMS  
**Scope:** Backend (`backend/`), Web (`frontend/`), Flutter (`mobile/battechno_lms_app/`)  
**Audit date:** 2026-07-22  
**Auditor mode:** Read-only source inspection + local test/build verification  
**Source changes:** This document only. No application code was modified.  
**Git/deploy:** No Git writes, no production changes, no Neon migrations.

---

## Executive summary

BATTECHNO LMS is a university-scoped learning and **field-training** platform. The Flutter app is a **role-aware mobile client** of the same Express/Prisma Backend used by the React web SPA. Core field-training journeys for all **seven active roles** are present and API-backed. Large academic CMS, analytics, and dense admin tooling remain **intentionally web-only**. Push delivery is **compile-gated off**. Known auth limitations **QA-AUTH-001** and **QA-AUTH-003** remain open.

**Final verdict: MOSTLY MATCHED** (see Phase 29).

| Metric | Value |
|--------|------:|
| Flutter GoRoutes | 68 |
| Flutter `*screen*.dart` files | 67 |
| Flutter `ApiEndpoints` path builders | 103 |
| Active roles covered on mobile | 7 |
| Backend unit tests (this run) | 379 pass |
| Frontend unit tests | 42 pass |
| Frontend production build | pass |
| Flutter tests | 160 pass |
| Flutter analyze (`--no-fatal-infos`) | pass (52 info) |
| Dart format (`lib`/`test`) | clean |

---

## Phase 1 — Product idea (Arabic, plain language)

### ما هي منصة BATTECHNO LMS؟

منصة **بات تكنو لإدارة التعلم والتدريب الميداني**. تربط بين:

- **الجامعات** التي تعتمد برامجها وتراقب طلابها
- **الطلاب** الذين يتدربون ويُقيَّمون
- **المدربين/المحاضرين** الذين يديرون الجلسات والحضور والمهام
- **BATTECHNO** كمشغّل للمنصة والصلاحيات العامة (Super Admin)

الهدف: تنظيم **التعليم الأكاديمي** و**التدريب الميداني** من التسجيل حتى الشهادة/كتاب الإنهاء، مع رقابة جودة ومراجعة جامعية.

### من يستخدمها؟

| الدور | الغرض |
|--------|--------|
| طالب (`student`) | التقديم للتدريب، الحضور، المهام، التقييمات، الشهادات |
| مدرب (`instructor`) | إدارة الفرص المسندة، الحضور، مراجعة التسليمات، الساعات |
| إداري جامعة (`university_admin`) | فرص التدريب، الطلبات، المستخدمين ضمن الجامعة |
| إداري أكاديمي (`academic_admin`) | إدارة أكاديمية/تدريب ميداني ضمن النطاق الجامعي |
| ضابط جودة (`qa_officer`) | مراجعات الجودة، الإجراءات التصحيحية، المخاطر والنزاهة |
| مراجع جامعي (`university_reviewer`) | طلبات الاعتراف، قرارات القيد، تقارير الطلاب |
| مشرف عام (`super_admin`) | الجامعات، المستخدمون عالمياً، الرقابة العامة (`isGlobal`) |

دور `program_admin` **متوقف** ويجب أن يفشل مغلقاً (fail-closed).

### مسارات العمل الأربعة

1. **أكاديمي:** برامج، تسجيل، تقييمات أكاديمية، درجات، شهادات رقمية.  
2. **تدريب ميداني:** فرص → تقديم → تقييم قبلي → جلسات/حضور → مهام → تقييم بعدي → ساعات → أهلية → كتاب إنهاء/شهادة.  
3. **إداري:** مستخدمون، جامعات، نشر الفرص، التقارير.  
4. **جودة/مراجعة:** QA، مخاطر، نزاهة، اعتراف، قرارات قيد.

### رحلة الطالب (مبسّطة)

تسجيل → تحقق بريد → انتظار تفعيل عند الحاجة → دخول → لوحة → تصفح فرص مؤهلة → تقديم طلب → متابعة الحالة → تقييم قبلي → جلسات وحضور → مهام وتسليم → مراجعة المدرب → ساعات مكتملة/مطلوبة → تقييم بعدي → استيفاء الشروط → شهادة/كتاب إنهاء → إشعارات طوال المسار.

### رحلة المدرب

فرص مسندة → تفاصيل → مشاركون → جلسات وحضور جماعي → تسليمات ومراجعة → رؤية نتائج التقييمات → تحديث الساعات المكتملة → تقارير/إشعارات.

### الجامعة والجودة والمشرف

- الجامعة تراقب الفرص والطلبات والتقدم والتقارير.  
- QA تدير حالات الجودة والمخاطر والنزاهة.  
- المراجع الجامعي يقرر الاعتراف والقيد ويقرأ التقارير.  
- Super Admin يدير الجامعات والمستخدمين عالمياً ويراقب النظام (بدون أدوات أسرار/هجرة في الموبايل).

---

## Phase 2 — System architecture

```
Flutter App / React Web
        │  HTTPS JSON
        ▼
Express API  (/api/auth + /api/v1)
        │  JWT authenticate → loadCurrentAuthContext (DB truth)
        │  authorizeRoles + university scope (isGlobal bypass)
        ▼
Services / business rules
        ▼
Prisma → PostgreSQL (Neon in production; disposable Postgres in CI)

Files: local uploads and/or Cloudflare R2 (presign → confirm → download-url)
In-app notifications: DB rows (+ optional action_url)
Push (optional): mobile_push_registrations → FCM fanout (disabled in app build)
```

| Layer | Stack |
|-------|--------|
| Backend | Node.js, Express 4, Prisma, PostgreSQL, modular `src/modules/*` |
| Web | React 18, Vite 5, react-router v6, TanStack Query, Axios, SCSS tokens, i18next ar/en |
| Flutter | Feature-first `lib/features/*`, Riverpod, Dio, go_router, SharedPreferences token+cache, ARB ar/en, Material 3 `BatTheme` |

**Flutter structure:** `app/` (router, theme, l10n), `core/` (api, auth roles, files, push, storage), `features/` (auth, student/training, field_training, instructor, admin, reviewer, super_admin, notifications, certificates, push, splash, profile, dashboard).

---

## Phase 3 — Authentication and account lifecycle

| Step | Backend | Web | Flutter | Notes |
|------|---------|-----|---------|-------|
| Register | `POST /api/auth/register` | `/register` | `/auth/register` | Student self-reg |
| Email OTP | verify/resend OTP | `/verify-email` | `/auth/verify-email` | |
| Login | `POST /api/auth/login` | portal + `/login` | `/auth/login` | JWT |
| Current user | `GET /api/auth/me` | Auth context | AuthController refresh | DB-backed roles/`isGlobal` |
| Pending | activation status | notifications/admin | `/auth/pending` | |
| Inactive | 403 `ACCOUNT_INACTIVE` | blocked | `/auth/inactive` | IDENTITY-003 |
| Forgot/reset | OTP + reset password | web reset routes | forgot → reset-verify → new-password | |
| Logout | `POST /logout` **client-only** | clears storage | clears token + offline cache | **QA-AUTH-001** |
| Token storage | — | web storage | **SharedPreferences** (not SecureStorage) | Emulator hang workaround; security trade-off |
| `program_admin` | stripped from allowlists | fail → login | `unsupportedRole` | Fail-closed |
| Super Admin gate | `isGlobal` from DB | admin shell | `role==super_admin && isGlobal` | Lost privilege → placeholder + logout |
| 401 | unauthorized | logout bridge | Dio → clear session | |
| 403/404/409/422 | API codes | mapped | `ApiException` + UI messages | Hours conflict 409 handled |
| Network | — | — | `/auth/network-error` + banners | |

### Known limitations (not resolved)

| ID | Status | Evidence |
|----|--------|----------|
| **QA-AUTH-001** | **Open** | Logout does not revoke JWT server-side; docs + mobile ARB `logoutServerLimitation` |
| **QA-AUTH-003** | **Open** | Password reset does not invalidate existing access JWTs; no in-app password change |

IDENTITY-001 / 002 / 003 are **implemented** on Backend (privilege boundary, DB-rebuilt auth context, inactive rejection).

Flutter does **not** invent authorization; shells/capabilities are UX gates; Backend enforces.

---

## Phase 4 — Role and permission matrix

### Summary matrix

| Role | Scope | Mobile shell | Read (primary) | Write (primary) | Web-only heavy |
|------|-------|--------------|----------------|-----------------|----------------|
| student | university | Home / Training / Notifications / Profile | FT opportunities, progress, sessions, tasks, assessments, certs, notifications | Apply, submit task/assessment | Courses CMS browse depth, academic grade center density |
| instructor | university + assigned FT | Home / Trainings / Students / Profile | Assigned opps, participants, submissions | Sessions/attendance (portal), review submissions, hours | Academic cohort CMS, grade builder |
| university_admin | university | Home / Opportunities / Trainees / Reports / Profile | FT ops, students, reports, users (admin-stats) | Opp CRUD publish/archive, application status, hours | Org CRM density, some curriculum |
| academic_admin | university | Same admin pages (tab label “training”) | FT admin + academic FT reports path | Opp/applications/hours (FT_ADMIN) | Broader academic CMS on web |
| qa_officer | university | Home / Reviews / Reports / Notifications / Profile | QA/corrective/risk/integrity, evidence, FT reports | Status updates on QA cases | Dense admin QA tables |
| university_reviewer | university | Home / Reviews / Trainees / Reports / Profile | Recognition, pending enrollments, students, evidence | Recognition status, enrollment approve/reject | Full certificate issue UI |
| super_admin | **global (`isGlobal`)** | Home / Universities / Users / Reports / Profile | Global FT, audit, system health, certs list | Universities/users/roles (not program_admin) | Analytics Recharts, courses CMS, settings secrets |

### Explicit comparisons

| Pair | Difference |
|------|------------|
| **university_admin vs academic_admin** | Both FT admin on mobile. UA can read admin-stats/users more clearly; AA focuses academic oversight; web nav filters differ (UA gets FT ops; AA gets broader delivery/quality). |
| **qa_officer vs university_reviewer** | **Not one role.** QA: reviews/corrective/risk/integrity write status. Reviewer: recognition + enrollment decisions. Hours write **false** for both. |
| **super_admin vs scoped** | Only `isGlobal` super_admin gets global shell; scoped roles never see global university CRUD. |

`program_admin`: unsupported everywhere; not assignable in `SuperAdminCapabilities.assignableRoles`.

---

## Phase 5 — Complete mobile page inventory

### Auth / startup

| Route | Screen | Role | Purpose | API | Offline | Web equivalent | Parity |
|-------|--------|------|---------|-----|---------|----------------|--------|
| `/splash` | SplashScreen | all | Bootstrap token/`me` | `/auth/me` | n/a | soft boot | PARITY-B |
| `/auth/login` | LoginScreen | public | Login | `/auth/login` | none | `/login*` | PARITY-A |
| `/auth/register` | RegisterScreen | public | Register | register + catalogs | none | `/register` | PARITY-A |
| `/auth/verify-email` | VerifyEmailScreen | public | OTP | verify/resend OTP | none | `/verify-email` | PARITY-A |
| `/auth/forgot-password` | ForgotPasswordScreen | public | Start reset | forgot | none | `/forgot-password` | PARITY-A |
| `/auth/reset-verify` | ResetVerifyScreen | public | Reset OTP | verify reset OTP | none | `/reset-password/verify` | PARITY-A |
| `/auth/new-password` | NewPasswordScreen | public | Set password | reset-password | none | `/reset-password/new` | PARITY-A |
| `/auth/pending` | PendingApprovalScreen | gated | Await activation | — | — | activation UX | PARITY-B |
| `/auth/inactive` | InactiveAccountScreen | gated | Blocked | — | — | blocked | PARITY-A |
| `/auth/unsupported` | UnsupportedRoleScreen | gated | program_admin etc. | — | — | login bounce | PARITY-A |
| `/auth/network-error` | NetworkErrorScreen | gated | Connectivity | — | — | generic | PARITY-B |
| `/home` | HomeShellScreen | all active | Role shell | various | cache per feature | role dashboards | PARITY-B |

### Student

| Route | Screen | Purpose | Key APIs | Parity |
|-------|--------|---------|----------|--------|
| shell Home | StudentHomeScreen | Dashboard | student FT / dashboard | PARITY-B |
| shell Training | StudentTrainingListScreen | Browse/apply list | student/field-training, my-applications | PARITY-B |
| `/student/field-training/:id` | FieldTrainingDetailScreen | Opportunity detail | detail, progress, apply | PARITY-B |
| `.../sessions` | SessionsListScreen | Sessions | sessions | PARITY-B |
| `.../sessions/:sessionId` | SessionDetailScreen | Session detail | sessions | PARITY-B |
| `.../assessments` | AssessmentsHubScreen | Pre/post hub | assessments | PARITY-B |
| `.../assessments/:type` | AssessmentOverviewScreen | Overview | assessment | PARITY-B |
| `.../attempt` | AssessmentAttemptScreen | Submit | assessment submit | PARITY-A |
| `.../result` | AssessmentResultScreen | Result | assessment | PARITY-A |
| `/student/tasks/:taskId` | TaskDetailScreen | Task + submit | tasks, submit | PARITY-B |
| `/student/certificates` | CertificatesHubScreen | Wallet | certificates | PARITY-B |
| `/student/certificates/:id` | CertificateDetailScreen | Detail | certificate | PARITY-B |
| `/student/settings` | SettingsScreen | Locale/logout | — | PARITY-C |
| `/notifications` | NotificationsInboxScreen | Inbox | notifications | PARITY-A |
| Profile tab | StudentProfileScreen | Read-only profile | me | PARITY-C |

### Instructor

| Route | Screen | Purpose | Parity |
|-------|--------|---------|--------|
| InstructorHomeScreen | Dashboard/stats | PARITY-B |
| InstructorTrainingsScreen | Assigned list | PARITY-B |
| InstructorTrainingDetailScreen | Opp detail | PARITY-B |
| InstructorParticipantsScreen / ParticipantDetail | Students + hours | PARITY-B |
| InstructorSessionsScreen / AttendanceScreen | Sessions + batch attendance | PARITY-B |
| InstructorSubmissionsScreen / ReviewScreen | Review tasks | PARITY-B |
| InstructorAssessmentsScreen | Assessment visibility | PARITY-C (limited vs web manage) |
| InstructorStudentsHubScreen | Cross-training students | PARITY-B |
| InstructorProfileScreen / settings | Profile | PARITY-C |

### University / Academic admin

| Route | Screen | Purpose | Parity |
|-------|--------|---------|--------|
| AdminHomeScreen | Stats (UA/SA) | PARITY-B |
| AdminOpportunitiesScreen | List | PARITY-B |
| AdminOpportunityFormScreen new/edit | Create/edit + required hours | PARITY-B |
| AdminOpportunityDetailScreen | Detail publish/archive | PARITY-B |
| AdminApplicationsScreen | Approve/reject | PARITY-B |
| AdminSessionsScreen / Submissions / Assessments | Oversight | PARITY-C (less write than web manage hub) |
| AdminStudentsHubScreen / StudentDetailScreen | Oversight + hours write | PARITY-B |
| AdminReportsScreen | University/students reports | PARITY-B |
| AdminProfileScreen | Profile | PARITY-C |

### QA / Reviewer

| Route | Screen | Role | Parity |
|-------|--------|------|--------|
| QaHomeScreen / QaReviewsHub / QaReviewDetail | QA queue | qa_officer | PARITY-B |
| QaCaseDetailScreen corrective/risk/integrity | Case status | qa_officer | PARITY-B |
| QaEvidenceScreen | Evidence | both | PARITY-C |
| ReviewerHome / ReviewsHub | Reviewer home | university_reviewer | PARITY-B |
| RecognitionRequestsSection / RecognitionDetail | Recognition | reviewer | PARITY-B |
| PendingEnrollmentsSection | Enrollment decisions | reviewer | PARITY-B |
| ReviewerStudentsHub / StudentDetail | Read-only FT student | both | PARITY-B |
| ReviewerReportsScreen | FT reports | both | PARITY-B |
| ReviewerProfileScreen | Profile | both | PARITY-C |

### Super Admin

| Route | Screen | Parity |
|-------|--------|--------|
| SuperAdminHomeScreen | Global dashboard | PARITY-B |
| Universities list/detail/form | CRUD universities | PARITY-B |
| Users list/detail | Status, roles, activate | PARITY-B |
| SuperAdminFieldTrainingHubScreen | Global FT | PARITY-B |
| SuperAdminQaOversightScreen | QA oversight | PARITY-B |
| SuperAdminAuditScreen | Audit logs | PARITY-B |
| SuperAdminSystemStatusScreen | Health probe only | PARITY-C / WEB-ONLY for settings/analytics |
| SuperAdminCertificatesScreen | Cert list | PARITY-C |
| SuperAdminReportsScreen | Global reports | PARITY-B |
| SuperAdminProfileScreen / settings | Profile | PARITY-C |

**Loading / empty / error:** Most list/detail screens use AsyncValue-style or manual loading + retry patterns; empty copy via l10n; network errors via `ApiException`.

**Offline:** Read-through SharedPreferences cache for many list namespaces; **no offline write queue**.

---

## Phase 6 — Web page inventory (parity lens)

| Web area | Mobile equivalent | Result |
|----------|-------------------|--------|
| Auth + OTP + reset | Full | Fully represented |
| Student FT browse/detail/tasks/assessments | Full adapted | PARITY-B |
| Student courses/programs/semester/content | Missing / thin | MOBILE-GAP / WEB-ONLY |
| Instructor FT manage | Adapted deep links | PARITY-B |
| Instructor academic cohorts/grades builder | Missing | WEB-ONLY |
| Admin FT ops + hours | Present | PARITY-B |
| Admin FT manage multi-tab hub | Simplified screens | PARITY-B / C |
| Admin analytics / courses CMS / roles matrix | Absent | WEB-ONLY |
| Academic FT reports | Reviewer/admin reports | PARITY-B |
| QA / risk / integrity / recognition | Present | PARITY-B |
| Reviewer enrollments / certificates review | Enrollments yes; cert issue limited | PARITY-C |
| Super admin universities/users/audit | Present | PARITY-B |
| Super admin analytics charts + exports | Absent | WEB-ONLY |
| Public certificate verify | API exists; dedicated mobile public route thin | PARITY-C |
| Notifications | Present | PARITY-A |

---

## Phase 7 — API inventory (Flutter-facing)

Flutter centralizes paths in `lib/core/api/api_endpoints.dart` (**103** builders) against Backend `/api/auth` and `/api/v1`.

### Domains used by Flutter

| Domain | Methods (representative) | Roles |
|--------|--------------------------|-------|
| Auth | login, logout, register, OTP, reset, me, catalogs | public/auth |
| Student FT | list, detail, apply, progress, tasks, submit, assessments, sessions, completion letter | student |
| Instructor FT | list, stats, applications, sessions, attendance, submissions review, assessments, **hours** | instructor |
| Admin FT | CRUD opp, publish/archive, applications status, hours, sessions, submissions, assessments, reports, instructors, eligibility | UA/AA/SA |
| Academic FT reports | university report, students, student report, instruction download-url | QA/reviewer/AA |
| Notifications | list, read, read-all | self |
| Certificates | list, detail, verify | CERTIFICATE_READ |
| Files | download-url | authenticated |
| QA | qa-reviews, corrective-actions, risk-cases, integrity-cases (+ status) | QA_OVERSIGHT / RISK_INTEGRITY |
| Evidence | list/detail | EVIDENCE_READ |
| Recognition | list/detail/documents/status | recognition roles |
| Enrollments | pending, approve, reject | ENROLLMENT_DECISION |
| Users / universities / audit | CRUD-ish | ADMIN / SA |
| Mobile push | register, register-all | authenticated |
| Dashboard | admin-stats | ADMIN_READ |

### Detected contract notes

| Finding | Class |
|---------|-------|
| Paths align with web `endpoints.js` field-training portals | PARITY-A |
| No Flutter calls inventing fake completion/eligibility | OK |
| Academic CMS endpoints largely **unused** by Flutter | WEB-ONLY / intentional |
| Push endpoints present; Firebase options **not configured** | Feature dormant |
| Stale l10n `hoursReadOnlyNotice` still claims hours API unavailable while instructor/admin write hours | DESIGN-MISMATCH (copy) |
| Review-history / checklist dedicated APIs | Backend gap if product expects them |
| `action_url` not uniformly set for all notification producers | Backend gap |

**No evidence** of Flutter calling non-existent core FT paths for implemented screens (repositories map to real portals). Authorization mismatches would surface as 403 — client capabilities fail closed for reviewer hours and program_admin.

---

## Phase 8 — Student workflow parity

| Step | Backend | Web | Flutter | Status |
|------|---------|-----|---------|--------|
| 1 Register | yes | yes | yes | PARITY-A |
| 2 Verify email | yes | yes | yes | PARITY-A |
| 3 Approval wait | activation | admin notify | pending screen | PARITY-B |
| 4 Login | yes | yes | yes | PARITY-A |
| 5 Dashboard | yes | yes | yes | PARITY-B |
| 6 Browse eligible opps | eligibility server | yes | yes | PARITY-A |
| 7 Apply | 409 duplicate | yes | yes | PARITY-A |
| 8 Application status | yes | yes | yes | PARITY-A |
| 9 Pre-assessment | gating server | yes | yes | PARITY-A |
| 10 Access training | status server | yes | yes | PARITY-A |
| 11 Sessions | yes | yes | yes | PARITY-B |
| 12 Attendance | yes | yes | view | PARITY-C (student view) |
| 13 Tasks | yes | yes | yes | PARITY-B |
| 14 Submit URL/file | files + submit | yes | yes | PARITY-B |
| 15 Instructor review | statuses | yes | visible | PARITY-A |
| 16 Hours tracking | required/completed | yes | display | PARITY-A (read) |
| 17 Post-assessment | yes | yes | yes | PARITY-A |
| 18 Completion requirements | eligibility engine | yes | display | PARITY-A |
| 19 Certificate / letter | issue server-side | yes | download/view | PARITY-B |
| 20 Notifications | DB + optional push | yes | inbox; push off | PARITY-B |

Flutter does **not** locally grant completion/certification.

**Gaps:** Academic courses journey largely absent; AI self-evaluation page exists on web more richly; public verify UX thinner.

---

## Phase 9 — Instructor workflow parity

| Capability | Web | Flutter | Status |
|------------|-----|---------|--------|
| Assigned opportunities | yes | yes | PARITY-B |
| Participants / progress | yes | yes | PARITY-B |
| Sessions create/edit | manage hub | sessions screens (portal APIs) | PARITY-B (verify full CRUD depth vs web) |
| Batch attendance | yes | InstructorAttendanceScreen | PARITY-B |
| Submission review | yes | yes | PARITY-A |
| Assessment results | yes | limited visibility | PARITY-C |
| Completed hours update | yes | participant hours | PARITY-A |
| Academic cohorts/grades | yes | no | WEB-ONLY |
| Notifications | yes | via shell/settings paths | PARITY-B |

---

## Phase 10 — University & academic admin parity

| Capability | Shared | UA | AA | Mobile | Notes |
|------------|--------|----|----|--------|-------|
| FT opportunities CRUD | yes | yes | yes | yes | PARITY-B |
| Required hours on opp | yes | yes | yes | form field | PARITY-A |
| Publish/archive | yes | yes | yes | yes | PARITY-A |
| Applications decide | yes | yes | yes | yes | PARITY-A |
| Completed hours write | yes | yes | yes | AdminStudentDetail | PARITY-A |
| Sessions/submissions oversight | yes | yes | yes | mostly read/lighter | PARITY-C |
| Users list | ADMIN_READ | stronger | weaker on mobile | UA/SA | PARITY-C |
| Curriculum/enrollments CMS | web | filtered | heavy web | missing | WEB-ONLY |
| Reports | yes | yes | academic routes | yes | PARITY-B |
| Certificates issue | web | yes | yes | limited | WEB-ONLY / C |

---

## Phase 11 — QA & university reviewer parity

| Capability | QA | Reviewer | Mobile | Status |
|------------|----|----------|--------|--------|
| QA reviews + status | write | no | separate screens | PARITY-B |
| Corrective / risk / integrity | write | no | QaCaseDetail | PARITY-B |
| Recognition decisions | no | write | Recognition* | PARITY-B |
| Enrollment approve/reject | no | write | PendingEnrollments | PARITY-B |
| Evidence | read | read | QaEvidenceScreen | PARITY-C |
| FT student reports | read | read | ReviewerStudentDetail | PARITY-B |
| Hours write | **no** | **no** | enforced | PARITY-A |
| Certificates | scoped | empty list backend | limited | PARITY-C |

**Backend gaps (document, not fixed):** dedicated review-history API, rich decision-notes/checklist APIs, incomplete `action_url` coverage across producers.

Roles are **not** collapsed into one generic reviewer in Flutter (`ReviewerCapabilities`).

---

## Phase 12 — Super Admin parity

| Area | Status |
|------|--------|
| `isGlobal` gating | Enforced in `SuperAdminCapabilities.canAccess` |
| Universities CRUD | Present |
| Users status / roles | Present; `program_admin` not assignable |
| Super Admin role mutation | Client confirm + Backend IDENTITY-001 |
| Global FT / reports | Present |
| QA oversight / audit / certs list | Present |
| System status | Health only — **not** DB/migration/secret tools |
| Analytics / courses CMS / settings secrets | **WEB-ONLY** (correct) |
| Stale JWT / lost isGlobal | Refresh `me`; fail-closed shell | 

---

## Phase 13 — Business logic review

| Rule | Backend | Web | Flutter | Risk |
|------|---------|-----|---------|------|
| Opportunity eligibility | server | displays | displays | OK |
| Application lifecycle | server | yes | yes | OK |
| Instructor assignment scope | access layer | yes | portal APIs | OK |
| Pre/post assessment gating | server | yes | yes | OK |
| Session/attendance rules | server | yes | yes | OK |
| Task submission + review statuses | server | yes | yes | OK |
| Expelled/inactive | server | yes | surfaces errors | OK |
| Required / completed hours + 409 conflict | server | yes | admin/instructor write | OK |
| Hours do not alone gate eligibility | server comment | — | must not invent gate | OK |
| Completion letter eligibility | server | yes | download when available | OK |
| Academic one submission / finalized grade | server | yes | **mostly unused on mobile** | WEB-ONLY surface |
| IDENTITY-001/002/003 | yes | yes | respects me/isGlobal | OK |
| program_admin retired | yes | yes | unsupported | OK |

**High-risk client-only enforcement:** None found for completion/certification/hours authority. Client capabilities are UX only.

---

## Phase 14 — Design system audit

| Token | Web (`_variables.scss`) | Flutter (`BatColors`) | Match |
|-------|-------------------------|------------------------|-------|
| Primary | `#132d4a` | `#132D4A` | Match |
| Secondary | `#0c1f35` | `#0C1F35` | Match |
| Accent gold | `#c9a227` | `#C9A227` | Match |
| Cream / BG / surface | cream `#f7f1e7`, bg `#f6f7f5`, white | same | Match |
| Status colors | success/warn/danger | mapped | Match |
| Typography | Tajawal / Inter | Tajawal (ar), Inter (en) | Match |
| Radii | modest | `BatRadii` sm–xl + student 17 | Correct native adaptation |
| Logo | Battechno | `BatLogoHeader` splash | Match |

**Classification of differences:** Bottom navigation, cards-for-touch, and simplified hubs = **correct native-mobile adaptation**. Dense web DataTables/analytics = not mirrored (correct). Occasional hardcoded English API messages = **usability/i18n issue**. Stale hours read-only notice string = **inconsistent component copy**.

Visual identity communicates universities, training, and institutional navy/gold trust. Not a compressed desktop site.

**Visual verification note:** Inspected via code, theme tokens, widget tests, and prior emulator history in project. Fresh side-by-side screenshot capture of all seven roles was **not** re-run in this audit session → design visual check **partially unverified** for live pixels.

---

## Phase 15 — Mobile UX and responsiveness

| Topic | Observation |
|-------|-------------|
| SafeArea / Material scaffolds | Generally used |
| Keyboard | Form screens; standard Flutter |
| Bottom nav | Role shells 4–5 tabs |
| Tablet NavigationRail | Not a first-class rail app |
| Android back | go_router stack |
| Deep links | Notification `action_url` → mobile route mapper; push dormant |
| Pull-to-refresh | Present on many lists |
| RTL/LTR | ar/en ARB + direction |
| Empty/error/retry | Common patterns + tests |
| Offline banner | `offlineCachedBanner` |
| Destructive confirms | Super Admin role changes; status actions |
| Risks | Some dense admin lists; profile “not in app yet”; info-level analyzer async gaps |

---

## Phase 16 — Data and state management

```
Screen → Riverpod (AuthController / feature controllers)
      → Repository
      → ApiClient (Dio) + Bearer
      → Backend
      → Map/model
      → UI Async/loading/error
```

| Topic | Status |
|-------|--------|
| Cache invalidation | Per-user namespace keys |
| Logout cleanup | Token + `OfflineCache.clearUser/clearAll` |
| Account switch leak | User-scoped cache keys mitigate |
| Offline writes | Not queued |
| Optimistic updates | Limited; hours conflict handled on 409 |
| Duplicate calls | Typical refresh-on-open; acceptable |

---

## Phase 17 — Offline behavior

**Cached (read fallback examples):** training lists, instructor/admin/reviewer/sa list namespaces, notifications/certificates/profile-ish payloads as implemented per repository.

**Never offline-safe writes:** applications, assessments, task submissions, attendance, hours, review decisions, user/university mutations.

**Timestamps:** `saved_at` in cache payload; UI can show stale banner.  
**Logout:** clears user cache.  
**Personal data:** cache holds operational JSON in SharedPreferences — acceptable for MVP but not a hardened secure enclave.

---

## Phase 18 — File and document security

| Control | Status |
|---------|--------|
| HTTPS-only open | `SecureFileService.isSafeHttpsUrl` |
| Auth download / signed URL / file id | Implemented |
| Temp files + OpenFilex | Yes |
| Tokens in logs | Debug LogInterceptor only in development |
| Permanent private cache of docs | Avoided by temp download pattern |
| Fabricated certificates | No — server issued |
| Completion letters | Download endpoints |

---

## Phase 19 — Notification parity

| Channel | Status |
|---------|--------|
| In-app inbox | Implemented (list/read/read-all) |
| Unread badge | Shell/home patterns |
| action_url → mobile route | `NotificationNavigator.mobileRouteFromActionUrl` |
| Unknown target fallback | Coordinator stores/handles safely |
| Push Firebase | **`PushConfig` / options false → NoOp gateway** |
| Token register/unregister | Code present; inactive when push off |
| Device delivery evidence | **None claimed** |

**Role×route matrix (conceptual):** Student → FT/certificates; Instructor → submissions/sessions; Admin → applications/opps; QA → reviews/cases; Reviewer → recognition/enrollments; Super → universities/users. Coverage depends on Backend `action_url` population — **incomplete producer coverage** documented as Backend gap.

---

## Phase 20 — Localization and accessibility

| Item | Status |
|------|--------|
| ARB ar + en | Present |
| Hardcoded English errors | Some API/client strings |
| RTL | Supported |
| Web EN hours keys incomplete | Web i18n gap (not mobile-only) |
| Stale mobile hours read-only copy | Inconsistency |
| Analyzer a11y | No fatal; info-level issues |
| Contrast | Navy/gold on cream/white — generally institutional |

Prefer web Arabic terminology for FT (“التدريب الميداني”, “كتاب الإنهاء”, “الشهادات الرقمية”) — mobile ARB largely aligned.

---

## Phase 21 — Parity classification legend

Used throughout: **PARITY-A / B / C**, **WEB-ONLY**, **MOBILE-GAP**, **CONTRACT-MISMATCH**, **AUTHORIZATION-RISK**, **DESIGN-MISMATCH**, **UNVERIFIED**.

Completeness requires route + screen + real API + auth + states + refresh + tests — not merely a widget.

---

## Phase 22 — Page-by-page parity matrix (major screens)

| Role | Mobile route | Mobile screen | Web | Purpose | APIs | Writes | Auth | Offline | Class | Risk | Rec |
|------|--------------|---------------|-----|---------|------|--------|------|---------|-------|------|-----|
| all | /auth/login | LoginScreen | /login* | Login | auth/login | — | public | no | A | low | — |
| student | /home | StudentHome | /student/dashboard | Home | FT stats | — | student | cache | B | low | — |
| student | training list | StudentTrainingList | /student/field-training | Browse | student FT | apply | student | cache | B | low | — |
| student | /student/field-training/:id | Detail | detail page | Journey | detail/progress | apply | student | cache | B | low | — |
| student | assessments/* | Attempt/Result | FT assessments | Pre/post | submit | student | no | A | low | — |
| student | tasks/:id | TaskDetail | tasks | Submit | submit/files | student | no | B | med | harden file UX |
| student | certificates | Hub/Detail | /student/certificate | Wallet | certificates | — | student | cache | B | low | — |
| instructor | trainings | InstructorTrainings | /instructor/field-training | List | instructor FT | — | instructor | cache | B | low | — |
| instructor | attendance | InstructorAttendance | manage attendance | Batch | attendance POST | instructor | no | B | med | confirm parity of edge cases |
| instructor | submissions review | ReviewScreen | manage submissions | Review | review | instructor | no | A | low | — |
| instructor | participant | ParticipantDetail | participants | Hours | hours PATCH | instructor | no | A | low | fix stale read-only string |
| UA/AA | opportunities | AdminOpportunities | /admin/field-training | Ops | admin FT | CRUD | FT_ADMIN | cache | B | low | — |
| UA/AA | form | OpportunityForm | create/edit | Hours required | POST/PATCH | FT_ADMIN | no | B | low | — |
| UA/AA | applications | AdminApplications | applications | Decide | status | FT_ADMIN | no | A | low | — |
| UA/AA | reports | AdminReports | FT reports | Reports | reports | — | REPORT | cache | B | low | exports WEB-ONLY |
| qa | /qa/reviews | Hub/Detail | /admin/qa-reviews | QA | qa-reviews | status | QA | cache | B | med | history API gap |
| qa | /qa/{kind}/:id | CaseDetail | risk/integrity/corrective | Cases | status | QA | no | B | med | — |
| reviewer | recognition | Recognition* | /reviewer/recognition* | Decide | status | reviewer | no | B | low | — |
| reviewer | enrollments | PendingEnrollments | enrollment-requests | Decide | approve/reject | reviewer | no | B | low | — |
| reviewer | students | ReviewerStudentDetail | academic student report | Read | academic reports | — | both | cache | B | low | — |
| SA | universities | SuperAdmin* | /admin/universities | CRUD | universities | write | isGlobal | cache | B | low | — |
| SA | users | UserDetail | /admin/users | Roles/status | users | write | isGlobal | no | B | med | confirm IDENTITY UX |
| SA | system-status | SystemStatus | settings/analytics | Health | health | — | isGlobal | no | C | low | keep WEB-ONLY |
| SA | analytics | — | /admin/analytics | Charts | analytics | — | SA | — | WEB-ONLY | — | stay web |
| student | courses | — | /student/courses* | Academic | courses | — | student | — | MOBILE-GAP | med | decide roadmap |
| all | push permission | gated off | n/a | Push | push register | — | auth | — | UNVERIFIED live | med | Phase enable Firebase |

---

## Phase 23 — API-to-screen traceability (selected)

| Endpoint pattern | Method | Roles | Web | Flutter repo | Screens | Tested | Status |
|------------------|--------|-------|-----|--------------|---------|--------|--------|
| /api/auth/login | POST | public | yes | AuthRepository | Login | yes | A |
| /api/auth/me | GET | auth | yes | AuthRepository | Splash/shell | yes | A |
| /student/field-training | GET | student | yes | StudentTraining/FT | lists | yes | A |
| .../apply | POST | student | yes | FT repo | detail | yes | A |
| .../assessments/:type/submit | POST | student | yes | FT repo | attempt | yes | A |
| /instructor/.../attendance | POST | instructor | yes | InstructorRepository | attendance | yes | A |
| /instructor/.../hours | GET/PATCH | instructor | yes | InstructorRepository | participant | yes | A |
| /admin/field-training | CRUD | FT_ADMIN | yes | AdminRepository | admin FT | yes | A |
| /admin/.../hours | GET/PATCH | FT_ADMIN | yes | AdminRepository | student detail | yes | A |
| /qa-reviews | GET/PATCH status | QA | yes | ReviewerRepository | QA screens | yes | A |
| /recognition-requests/.../status | PATCH | reviewer | yes | ReviewerRepository | recognition | yes | A |
| /enrollments/:id/approve | PATCH | reviewer | yes | ReviewerRepository | enrollments | yes | A |
| /universities | GET/POST | SA | yes | SuperAdminRepository | universities | yes | A |
| /mobile/push/register | POST/DELETE | auth | n/a web | push services | shell bootstrap | unit | dormant |
| /analytics/* | GET | SA | yes | **unused mobile** | — | web | WEB-ONLY |
| /admin/courses | * | SA | yes | **unused** | — | web | WEB-ONLY |

Unused mobile methods: push path when Firebase off; some download URL variants depending on screen reachability.

Placeholder data: **no** production screen mocks found; `PlaceholderShellPage` only for unsupported/lost privilege.

---

## Phase 24 — Design verification

| Screen class | Verification method | Result |
|--------------|---------------------|--------|
| Splash/Login | code + tests + prior emulator | Brand navy/gold OK |
| Student home/detail | tests + code | Native cards OK |
| Instructor attendance | code + tests | Functional layout |
| Admin opp form / home | code + tests | OK |
| QA / reviewer queues | code + tests | Separated UX OK |
| Super Admin home/users | code + tests | Fail-closed OK |
| Notifications / offline / empty | code + l10n | Present |
| Live 7-role pixel compare vs web | **Not re-captured this session** | **Partially UNVERIFIED** |

---

## Phase 25 — Test and build verification (2026-07-22)

| Suite | Result |
|-------|--------|
| `dart format --output=none --set-exit-if-changed lib test` | **0 changed** (exit 0). Note: formatting entire tree `.` can fail on Windows/OneDrive directory listing — `lib`/`test` used. |
| `flutter analyze --no-fatal-infos` | **exit 0**, 52 **info** issues |
| `flutter test` | **160 passed** |
| Backend `npm run test:unit` | **379 passed** |
| Frontend `npm run test:unit` | **42 passed** |
| Frontend `npm run build` | **success** |
| iOS/Android release store builds | **Not run** (UNVERIFIED) |
| Production DB tests | **Not run** (forbidden) |

---

## Phase 26 — Gap and risk register

### P0 — Release blockers

| ID | Area | Issue | Prod impact | Block release? |
|----|------|-------|-------------|----------------|
| — | — | **No P0 authorization bypass or fabricated certification found in mobile** | — | **No P0 blockers for FT core** |

> SharedPreferences token storage is **P1** (not P0) given known emulator constraint and HTTPS API; elevate if threat model requires hardware-backed secrets before production mobile launch.

### P1 — Major gaps / mismatches

| ID | Severity | Role | Area | Current | Expected | Evidence | Rec |
|----|----------|------|------|---------|----------|----------|-----|
| GAP-ACAD-001 | P1 | student/instructor | Academic CMS | Courses/cohorts/grades largely absent | Product decision: web-only vs mobile phase | Web routes vs Flutter inventory | Explicit WEB-ONLY product call |
| GAP-PUSH-001 | P1 | all | Push | Firebase options false / NoOp | Real device push if promised | PushConfig | Enable only with real Firebase options |
| GAP-AUTH-001 | P1 | all | Logout | JWT not revoked | Server denylist or short TTL | QA-AUTH-001 | Backend auth hardening phase |
| GAP-AUTH-003 | P1 | all | Reset | Old JWT valid | Invalidate sessions | QA-AUTH-003 | Same |
| GAP-NOTIF-001 | P1 | all | action_url | Incomplete producers | Consistent deep links | notification.service usage | Backend notification coverage |
| GAP-TOKEN-STORE | P1 | all | Security | SharedPreferences token | Secure storage or mitigated threat model | secure_token_storage.dart | Document accept risk or revisit |

### P2 — Completeness / UX / contract

| ID | Issue | Rec |
|----|-------|-----|
| GAP-COPY-HOURS | Stale `hoursReadOnlyNotice` | Update copy |
| GAP-ADMIN-DEPTH | Admin manage hub thinner than web | Accept PARITY-C or deepen |
| GAP-CERT-ISSUE | Certificate issuance web-heavy | Keep WEB-ONLY |
| GAP-REVIEW-HIST | No review-history/checklist API | Backend if required |
| GAP-PROFILE | Profile edit “not in app yet” | Profile phase |
| GAP-ANALYZER | Info-level async BuildContext | Cleanup phase |
| GAP-EXPORT | PDF/XLSX reports web-only | Intentional |

### P3 — Polish

| ID | Issue |
|----|-------|
| GAP-EN-WEB-HOURS | Web EN missing some hours keys |
| GAP-RAIL | No tablet NavigationRail |
| GAP-FORMAT-DOT | `dart format .` flaky on full tree Windows |

### Intentional WEB-ONLY (not defects)

1. Super Admin analytics (Recharts + exports)  
2. Courses CMS (`/admin/courses`)  
3. Roles-permissions matrix UI  
4. Rubric builder / dense academic grade console  
5. FT Excel/PDF export hubs  
6. Environment/secret/migration tooling  
7. Heavy DataTable admin browsers  

### Design improvements (not blockers)

- Reduce leftover contradictory hours strings  
- Stronger empty illustrations  
- Align residual English server messages to l10n  

### Unverified

- Physical FCM delivery  
- Fresh 7-role visual screenshot grid vs web  
- Store release signing builds  
- Production Neon schema vs local 30 migrations (out of scope; do not migrate)

---

## Phase 27 — شرح لغير المبرمجين (مالك المشروع)

1. **ماذا تفعل التطبيق؟** يدير تسجيل الطلاب، التدريب الميداني، الحضور، المهام، التقييمات، الساعات، الجودة، والمراجعة الجامعية، والشهادات.  
2. **من يستخدمه؟** سبعة أدوار: طالب، مدرب، إداري جامعة، إداري أكاديمي، ضابط جودة، مراجع جامعي، مشرف عام.  
3. **رحلة الطالب:** من إنشاء الحساب حتى الشهادة/كتاب الإنهاء عبر فرص التدريب والجلسات والمهام.  
4. **رحلة المدرب:** إدارة المتدربين والحضور ومراجعة الأعمال وتسجيل الساعات.  
5. **رحلة الجامعة:** نشر الفرص، قبول الطلبات، المتابعة والتقارير.  
6. **الجودة والمراجعة:** متابعة حالات الجودة والاعتراف وقرارات القيد — أدوار مختلفة لا تُخلط.  
7. **المشرف العام:** الجامعات والمستخدمون على مستوى المنصة عند امتلاك صلاحية عامة موثوقة.  
8. **التواصل مع الخادم:** التطبيق يتحدث مع نفس خادم الويب؛ الخادم هو الحكم النهائي.  
9. **حماية البيانات:** الصلاحيات تُفحص في الخادم؛ الموبايل يخفي الأزرار فقط ولا يمنح صلاحية سرية.  
10. **التصميم:** ألوان الجامعة (كحلي وذهبي) مثل الموقع، لكن بواجهة هاتف (شريط سفلي وبطاقات لمس).  
11. **ما يطابق تماماً:** مسارات التدريب الميداني الأساسية للأدوار السبعة، الدخول، الإشعارات داخل التطبيق.  
12. **ما يختلف عمداً:** التحليلات المعقدة وإدارة المقررات والجداول الضخمة تبقى على الويب.  
13. **ما ينقص:** جزء كبير من الدراسة الأكاديمية على الموبايل، وإشعارات الدفع الحقيقية غير مفعّلة بعد، وبعض تحسينات الأمان في الخروج/إعادة التعيين.  
14. **جاهزية تجربة الأجهزة:** نعم لاختبار رحلات التدريب الميداني الأساسية على جهاز/محاكي؛ لا تدّعِ اكتمال كل منصة الويب ولا اكتمال الدفع حتى تفعيل Firebase واختبار جهاز حقيقي.

---

## Phase 28 — Technical appendix

### Architecture map

See Phase 2.

### Route inventory

68 GoRoutes in `lib/app/router/app_router.dart` (Phase 5).

### API inventory

103 builders in `api_endpoints.dart` (Phase 7).

### Role matrix

Phase 4.

### Cache policy

User-scoped SharedPreferences JSON; read-only fallback; cleared on logout; no offline mutation queue.

### Notification routing

In-app authoritative; `action_url` mapped; push compile-gated off.

### File-security policy

HTTPS validation; temp downloads; download-url via Backend; no local certificate fabrication.

### Test results

Phase 25.

### Known Backend gaps

QA-AUTH-001/003; incomplete notification `action_url`; optional review-history/checklist APIs.

### Migration dependency status

Repository has **30** migrations; baseline v1 cutoff at migration 27; 28–30 = hours + push. **This audit did not apply migrations to production/Neon.**

### Platform configuration

Default API `https://lms-7txx.onrender.com` via dart-define; Firebase push **disabled**.

---

## Phase 29 — Final verdict

# MOSTLY MATCHED

| Dimension | Result |
|-----------|--------|
| Product-idea match | **Strong** — same LMS + field-training product |
| Business-logic match | **Strong** for FT; academic CMS thin on mobile |
| API-contract match | **Strong** for implemented surfaces |
| Authorization match | **Strong** (fail-closed program_admin / isGlobal) |
| Design/brand match | **Strong tokens**; native adaptation correct |
| Role coverage | **7/7 shells present** |
| Core FT workflow coverage | **Mostly complete** |
| Testing confidence | **High for unit/widget**; medium for live pixels/push |
| Release blockers (P0) | **None identified for FT core device testing** |
| Recommended next action | **MOBILE-DEVICE-QA-001** on physical devices for seven roles + decide academic WEB-ONLY scope + optional **PUSH-ENABLE-001** only with real Firebase |

Do **not** treat “tests pass” as full product parity. Web remains richer for analytics, courses, and dense admin.

---

## Phase 30 — Document control

| Field | Value |
|-------|-------|
| File | `mobile/battechno_lms_app/docs/MOBILE_WEB_PARITY_AUDIT.md` |
| Other files changed | **None** |
| Fixes applied | **None** (defects documented only) |

---

*End of MOBILE-WEB-PARITY-AUDIT-001.*

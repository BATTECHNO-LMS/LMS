# المسارات والصفحات

**مصدر الحقيقة:** `frontend/src/app/router/index.jsx`  
**تحميل كسول:** `frontend/src/app/router/lazyPages.js`

## ملخص الأعداد

| التصنيف | العدد | ملاحظات |
|---------|------:|---------|
| سمات `path=` في `AppRouter` | **167** | Confirmed — عدّ آلي |
| عناصر `<Route` | **186** | يشمل أغلفة بدون path أحيانًا |
| عناصر `<Navigate` | **15** | redirects |
| صفحات قابلة للعرض (تقدير) | ~150+ | Strong inference بعد استبعاد Navigate فقط |
| عامة / مصادقة | انظر الجدول أدناه | AuthLayout أو عامة |
| `/admin` | أغلب المسارات | `ADMIN_ROLE_SET` |
| `/instructor` | مجموعة كاملة + query sections في التنقل | + `RoleShellPermissionOutlet` |
| `/student` | مجموعة كاملة | + permission outlet |
| `/academic` | 4 صفحات | تقارير تدريب |
| `/reviewer` | مجموعة + redirects إلى academic | |

**الثقة في تعريفات المسارات في الموجّه:** Confirmed.

**لا توجيه قائم على نظام ملفات.** التحميل الكسول عبر `lazyPages.js` فقط.
## حراس الوصول

| الحارس | الملف | السلوك |
|--------|-------|--------|
| `ProtectedRoute` | `components/common/ProtectedRoute.jsx` | يتطلب جلسة وإلا → مسار دخول البوابة |
| `RoleBasedRoute` | `components/common/RoleBasedRoute.jsx` | يطابق `allowedRoles` وإلا → لوحة دور المستخدم |
| `RoleShellPermissionOutlet` | `components/permissions/RoleShellPermissionOutlet.jsx` | صلاحية UI للمسار أو Unauthorized |
| `SuperAdminAnalyticsRoute` / Courses / FieldTraining | صفحات wrappers | قيود إضافية داخل `/admin` |

**ملاحظة Confirmed:** غلاف `/admin` لا يستخدم `RoleShellPermissionOutlet`؛ التصفية عبر التنقل والأدوار.

## المسارات العامة

| النمط | المكوّن | المصادقة | الثقة |
|-------|---------|----------|-------|
| `/` | `RootRedirect` → Home أو لوحة | عامة* | Confirmed |
| `/login` | `SubdomainLoginRedirect` / `LoginPage` | عامة | Confirmed |
| `/login/admin` | `AdminLoginPage` | عامة | Confirmed |
| `/login/instructor` | `InstructorLoginPage` | عامة | Confirmed |
| `/login/student` | `StudentLoginPage` | عامة | Confirmed |
| `/login/reviewer` | `ReviewerLoginPage` | عامة | Confirmed |
| `/register` | `RegisterPage` | عامة | Confirmed |
| `/verify-email` | `VerifyEmailOtpPage` | عامة | Confirmed |
| `/forgot-password` | `ForgotPasswordPage` | عامة | Confirmed |
| `/reset-password/verify` | `VerifyPasswordResetOtpPage` | عامة | Confirmed |
| `/reset-password/new` | `NewPasswordPage` | عامة | Confirmed |
| `/verify/certificate/:verificationCode` | `CertificateVerifyPage` | عامة | Confirmed |
| `*` | Navigate → `/` | عامة | Confirmed |

\*المصادَق يُحوَّل من `/` إلى لوحة دوره.

## بوابة الإدارة `/admin`

- **Layout:** `AdminLayout`
- **أدوار:** `ADMIN_ROLE_SET` = `super_admin`, `program_admin`, `university_admin`, `academic_admin`, `qa_officer`
- **تنقل:** `constants/adminNavigation.js` (أقل من كل المسارات العميقة)

مجموعات المسارات (Confirmed):

| مجموعة | أمثلة مسارات |
|--------|--------------|
| لوحة وتحليلات | `/admin/dashboard`, `/admin/analytics` |
| مقررات | `/admin/courses`, `/admin/courses/:id/lessons` |
| تدريب ميداني | `/admin/field-training`, `.../:id/{applications,manage,tasks}`, `.../reports/*` |
| مستخدمون وأدوار | `/admin/users*`, `/admin/roles-permissions` |
| جامعات | `/admin/universities*` |
| منهج | `/admin/tracks*`, `/admin/micro-credentials*`, `/admin/learning-outcomes` |
| تسليم | `/admin/cohorts*`, `/admin/enrollments*`, `/admin/sessions*`, `/admin/attendance`, `/admin/content` |
| أكاديمي | `/admin/assessments*`, `/admin/rubrics*`, `/admin/submissions`, `/admin/grades` |
| حوكمة | `/admin/evidence`, `/admin/qa*`, `/admin/corrective-actions`, `/admin/risk-cases`, `/admin/integrity-cases`, `/admin/at-risk-students` |
| اعتراف/شهادات | `/admin/recognition-requests*`, `/admin/certificates*` |
| تشغيل | `/admin/notifications`, `/admin/reports`, `/admin/audit-logs*`, `/admin/settings` |
| Catch-all | `/admin/*` → `ModulePlaceholderPage` |
| Alias | `/admin/field-training-reports` → reports |

## بوابة المدرّس `/instructor`

- **Layout:** `InstructorLayout`
- **دور:** `instructor` فقط
- مجموعات: dashboard، cohorts/sessions/attendance، assessments/submissions/grades، evidence، risk-students، field-training تفاصيل متعددة، notifications

## بوابة الطالب `/student`

- **Layout:** `StudentLayout`
- **دور:** `student`
- `/student` → `StudentEntryRedirect` (برامج أو أفواج متاحة)
- مقررات، تدريب ميداني (+ self-evaluation)، برامج، محتوى، جلسات، حضور، تقييمات، تسليمات، درجات، شهادة، إشعارات

## بوابة أكاديمية `/academic`

- **Layout:** `AdminLayout`
- **أدوار:** `academic_admin`, `qa_officer`, `university_reviewer`
- تقارير تدريب ميداني وطلاب فقط (4 صفحات)

## بوابة المراجع `/reviewer`

- **Layout:** `ReviewerLayout`
- **دور:** `university_reviewer`
- dashboard، enrollment-requests، recognition، university-reports، evidence، certificates، notifications
- `/reviewer/field-training*` → تحويل إلى `/academic/field-training/reports`

## Redirects مهمة

| من | إلى |
|----|-----|
| `/admin` | `dashboard` |
| `/instructor/at-risk-students` | `/instructor/risk-students` |
| `/student/enrollments` | `/student/programs` |
| `/reviewer/field-training*` | academic FT reports |
| دور خاطئ | `getDefaultDashboardPath(user)` |
| غير مصادق | `getLoginPathForCurrentPortal()` |

## مسارات غير ظاهرة في الشريط الجانبي

المسارات العميقة (`:id/edit`, sessions create، FT manage، إلخ) موجودة في الموجّه وقد تُفتح من الجداول/الإشعارات دون عنصر قائمة — **لا تُصنَّف غير مستخدمة**.

## مكوّنات lazy غير مربوطة بالموجّه

معرفة في `lazyPages.js` وغير مستخدمة في `index.jsx` (Weak inference — مرشحة لمستقبل أو مسارات ناقصة):

- `QAReviewCreatePage`, `QAReviewEditPage`, `QAReviewViewPage`
- `CorrectiveActionCreate/Edit/ViewPage`
- `RiskCaseCreate/Edit/ViewPage`
- `IntegrityCaseCreate/Edit/ViewPage`
- صفحات reviewer FT القديمة (`ReviewerFieldTraining*`)

## حالات التحميل/الفراغ/الخطأ (نمط عام)

| الحالة | النمط المرصود |
|--------|----------------|
| Loading | `RouteFallback`, skeletons (مثل `StudentDashboardSkeleton`), spinners SCSS |
| Empty | مكونات قوائم/جداول حسب الصفحة |
| Error | ErrorBoundary + رسائل API في الصفحات |
| Unauthorized | `UnauthorizedPage` عبر permission outlet |

**الثقة:** Strong inference للنمط العام؛ لكل صفحة تفاصيل مختلفة.

## بوابات النطاق الفرعي

`utils/portal.js`: مضيفات `admin.*` / `instructor.*` / `student.*` / `reviewer.*` توجّه مسار الدخول — Confirmed في الكود؛ استخدام الإنتاج الفعلي Unknown بدون إعداد DNS.

## تنقل بـ query string (ليس مسار Router منفصل)

في `constants/navigation.js` لدور `instructor` تظهر عناصر مثل:

- `/instructor/field-training?section=sessions`
- `/instructor/field-training?section=tasks`
- `/instructor/field-training?section=results`
- `/instructor/field-training?section=eligibility`

هذه تُحسب **عنصر تنقل** وليست `path` إضافيًا في `AppRouter`. المسار الفعلي يبقى `/instructor/field-training`. يوجد أيضًا تكرار لعنصرين يشيران لنفس المسار الأساسي للتدريب الميداني.

## ملاحظة التحقق الثاني

تفاصيل التصحيحات العددية ومقارنة API: [14_RISKS_CONTRADICTIONS_AND_GAPS.md](./14_RISKS_CONTRADICTIONS_AND_GAPS.md) و[16_ANALYSIS_COVERAGE.md](./16_ANALYSIS_COVERAGE.md).

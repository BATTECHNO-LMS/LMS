# كتالوج واجهات البرمجة (API)

## نظرة عامة

| الخاصية | القيمة | الثقة |
|---------|--------|-------|
| النمط | REST JSON | Confirmed |
| بادئة المصادقة | `/api/auth` | Confirmed — `app.js` |
| بادئة الموارد | `/api/${API_VERSION}` افتراضيًا `/api/v1` | Confirmed |
| GraphQL / WebSocket / Webhooks | غير مكتشفة | Confirmed absence in src |
| Server actions | لا (ليست Next.js) | Confirmed |
| Rate limiting | `authLimiter` على auth؛ `apiLimiter` على v1؛ حدود إضافية لـ AI/files/FT AI | Confirmed |
| تحقق | Zod في validation modules | Confirmed |
| أخطاء | عبر `error.middleware` / `ApiError` | Confirmed |

**إجمالي النقاط المكتشفة:** **330** = **327** تسجيل `router.(get|post|put|patch|delete)` عبر 45 ملف `*.routes.js` + **3** في `app.js` (`/`, `/health`, `/health/ready`).

**الثقة في العدد:** Confirmed (منهجية العدّ أعلاه؛ التحقق الثاني 2026-07-16).

**أنماط استدعاء الواجهة:** ~**294** (method+path بعد توسيع بادئات FT حسب الدور) من `features/**/*.service.js` — انظر قسم المقارنة.
## تجميع المسارات

الملف: `backend/src/routes/index.js` يربط الوحدات تحت `/api/v1`.

## ملخص حسب الوحدة

| الوحدة | المسار الأساسي | تقريباً | Auth |
|--------|----------------|--------:|------|
| Root/Health | `/`, `/health`, `/health/ready` | 3 | عامة |
| Auth | `/api/auth` | 13 | مختلط |
| users | `/api/v1/users` | 12 | أدوار admin |
| roles | `/roles` | 2 | `super_admin` |
| universities | `/universities` | 4 | ADMIN_READ / WRITE |
| specialties | `/specialties` | 1 | عامة (نشطة) |
| tracks / micro-credentials / learning-outcomes | متنوع | ~14 | CURRICULUM_* |
| cohorts (+ nested) | `/cohorts` | 10 | DELIVERY_* |
| student portal | `/student/*` | 3+courses+FT | student |
| enrollments | `/enrollments` | 7 | مختلط |
| modules/sessions/attendance | متنوع | ~8 | DELIVERY_* |
| assessments/submissions/grades/rubrics | متنوع | ~24 | ACADEMIC_* |
| evidence/qa/corrective/risk/integrity | متنوع | ~19 | oversight |
| recognition + certificates | متنوع | ~15 | recognition/cert |
| notifications | `/notifications` | 4 | أي مصادق |
| analytics | `/analytics` | 13 | غالبًا super_admin |
| reports (+ FT legacy) | `/reports` | ~13 | REPORT_READ |
| audit/dashboard/settings | متنوع | 5 | مقيد |
| admin/student courses | `/admin/courses`, `/student/courses` | 28 | super_admin / student |
| field-training (4 بوابات) | `/admin|academic|instructor|student/field-training` | ~122 | حسب البوابة |
| files | `/files` | 5 | مصادق |
| ai | `/ai` | 3 | مصادق (+test super_admin) |
| public | `/public/landing-stats` | 1 | عامة |

## Auth — تفاصيل مختصرة

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | `/api/auth/register/universities` | عامة | `registrationUniversities` |
| GET | `/api/auth/register/specialties` | عامة | `registrationSpecialties` |
| GET | `/api/auth/register/universities/:universityId/specialties` | عامة | `registrationUniversitySpecialties` |
| POST | `/api/auth/register` | عامة | `register` |
| POST | `/api/auth/verify-email-otp` | عامة | `verifyEmailOtp` |
| POST | `/api/auth/resend-email-otp` | عامة | `resendEmailOtp` |
| POST | `/api/auth/forgot-password` | عامة | `forgotPassword` |
| POST | `/api/auth/verify-password-reset-otp` | عامة | `verifyPasswordResetOtp` |
| POST | `/api/auth/resend-password-reset-otp` | عامة | `resendPasswordResetOtp` |
| POST | `/api/auth/reset-password` | عامة | `resetPassword` |
| POST | `/api/auth/login` | عامة | `login` |
| GET | `/api/auth/me` | Bearer | `me` |
| POST | `/api/auth/logout` | عامة | `logout` (لا إبطال خادمي للتوكن) |

الملف: `backend/src/modules/auth/auth.routes.js`.

## أنماط التفويض المتكررة

قوائم الأدوار من `backend/src/config/env.js` (قابلة للتجاوز بـ `.env`):

- `ADMIN_READ_ROLE_CODES`, `USER_WRITE_ROLE_CODES`, `USER_ACTIVATE_ROLE_CODES`
- `CURRICULUM_*`, `DELIVERY_*`, `ACADEMIC_*`
- `EVIDENCE_*`, `QA_OVERSIGHT_*`, `RISK_INTEGRITY_*`
- `RECOGNITION_*`, `CERTIFICATE_*`, `AUDIT_LOG_READ_*`, `REPORT_READ_*`
- `ENROLLMENT_DECISION_*`, `FIELD_TRAINING_*`

`req.user.isGlobal` يتجاوز `authorizeRoles` — Confirmed في `authorization.middleware.js`.

## نقاط عامة بارزة

| Method | Path | ملاحظات |
|--------|------|---------|
| GET | `/api/v1/certificates/verify/:verificationCode` | تحقق شهادة بدون دخول |
| GET | `/api/v1/public/landing-stats` | إحصاءات الصفحة الرئيسية |
| GET | `/api/v1/specialties` | تخصصات نشطة للتسجيل/العرض |
| GET | `/uploads/*` | ملفات ثابتة محلية |

## التدريب الميداني — خريطة البوابات

| بادئة | ملف routes | أدوار افتراضية |
|-------|------------|----------------|
| `/api/v1/admin/field-training` | `adminFieldTraining.routes.js` (+ reports) | FIELD_TRAINING_ADMIN / MANAGE / REPORT |
| `/api/v1/academic/field-training` | `academicFieldTraining.routes.js` | academic_admin, university_reviewer, qa_officer, university_admin |
| `/api/v1/instructor/field-training` | `instructorFieldTraining.routes.js` | instructor |
| `/api/v1/student/field-training` | `studentFieldTraining.routes.js` | student |
| `/api/v1/reports/field-training` | legacy عبر reports | REPORT_READ |

## المقررات

- Admin: CRUD هيكل، cover upload، YouTube preview، training config، publish/archive — غالبًا `super_admin`.
- Student: list/start/progress/complete + training workflow endpoints.

## الملفات والـ AI

| Method | Path | ملاحظات |
|--------|------|---------|
| POST | `/api/v1/files/presign-upload` | يتطلب غالبًا R2 |
| POST | `/api/v1/files/confirm-upload` | تأكيد |
| GET | `/api/v1/files/:id/download-url` | رابط تنزيل |
| DELETE | `/api/v1/files/:id` | soft delete محتمل عبر `deleted_at` |
| POST | `/api/v1/ai/generate` | مزود حسب `AI_PROVIDER` |
| GET | `/api/v1/ai/status` | حالة التفعيل |
| GET | `/api/v1/ai/test` | `super_admin` |

## مقارنة الواجهة ↔ الخادم

| الملاحظة | التصنيف |
|----------|---------|
| جرد FE (~294 نمطًا موسّعًا) مقابل BE (330) أُنجز في التحقق الثاني | Confirmed |
| مسارات الكتابة الأكاديمية لـ submissions/grades (بما فيها nested تحت assessments) **بلا مستهلك** في `*.service.js` — الواجهة تقرأ GET فقط | Confirmed |
| `endpoints.auth.refresh` معرّف في FE و**لا** يوجد `/api/auth/refresh` في BE ولا استدعاء من `auth.service.js` | Confirmed |
| FE يستخدم `POST /student/enrollment-requests`؛ BE يعرّف أيضًا `POST /enrollments/request` بلا مستهلك FE مكتشف | Confirmed / Unknown للسبب |
| ثوابت غير مستدعاة من الخدمات: `registerSpecialties`, `files.health`, `ai.test`, `endpoints.students` | Confirmed |
| `fetchAnalyticsDomain` معرّف؛ صفحات التحليلات تستخدم overview/exports أساسًا | Confirmed |
| وضع تقارير FT `legacy` قابل للبناء في الكود لكن UI يمرّر `admin`/`academic` فقط | Confirmed |
| مسارات FT مكررة عبر بوابات (admin vs instructor) بسلوك ملكية مختلف | Confirmed |
| عملاء API على مستوى feature؛ الأساس `apiClient.js`؛ المسارات كاملة تحت `/api/...` | Confirmed |
| `VITE_API_BASE_URL` = أصل بدون لاحقة `/api` | Confirmed |

**لا يُصنَّف endpoint كـ unused** لمجرد عدم العثور على استدعاء frontend ثابت (قد يوجد CLI أو عميل خارجي — Unknown).

تفاصيل التصحيحات: [14_RISKS_CONTRADICTIONS_AND_GAPS.md](./14_RISKS_CONTRADICTIONS_AND_GAPS.md) — قسم Second-Pass Verification.
## الترقيم والتصفية

وحدات القائمة تستخدم عادة أدوات `utils/pagination.js` ومعاملات استعلام في validation — النمط متكرر (Strong inference عبر الوحدات؛ التفاصيل تختلف لكل مورد).

## هيكل الاستجابة (نمط)

استجابات النجاح/الفشل تمر عبر طبقات موحدة نسبيًا مع `success` في health؛ أخطاء الأعمال عبر `ApiError` برموز مثل `EMAIL_NOT_VERIFIED` — Confirmed جزئيًا من auth؛ تعميم كامل Unknown دون قراءة كل controllers.

## المستهلكون الخارجيون

لا دليل في المستودع على SDK عام أو شركاء يستهلكون API بخلاف الواجهة وعمليات التحقق العامة للشهادات — **Unknown** لأي مستهلك خارجي إضافي.

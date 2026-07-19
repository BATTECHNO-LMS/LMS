# الميزات ورحلات المستخدم

## مجموعات الميزات حسب المجال

### 1) الهوية والتسجيل

| البند | التفاصيل |
|-------|----------|
| الغرض | إنشاء حساب طالب، تحقق بريد، تفعيل، دخول حسب البوابة |
| الممثلون | `student`، أدوار التفعيل الإدارية |
| نقطة الدخول | `/register`, `/login/*`, `/verify-email`, `/forgot-password` |
| شروط مسبقة | جامعة ونطاق بريد نشط، تخصص جامعي |
| إجراءات | تسجيل، OTP، إعادة إرسال، تفعيل إداري، دخول/خروج |
| تحقق | Zod في auth validation؛ تطابق نطاق البريد |
| Backend | `auth.service.js`, `emailVerification.service.js`, `passwordReset.service.js` |
| كيانات | `users`, `email_verification_otps`, `password_reset_otps`, `user_roles`, `university_users` |
| خارجي | Resend |
| نجاح | JWT + توجيه للوحة الدور |
| أذونات | تسجيل عام؛ تفعيل عبر `USER_ACTIVATE_ROLE_CODES` |
| APIs | `/api/auth/*` |
| الثقة | Confirmed |

### 2) إدارة المستخدمين والجامعات

| البند | التفاصيل |
|-------|----------|
| الغرض | إنشاء موظفين، تغيير حالة، إعادة كلمة مرور إدارية، إدارة جامعات ونطاقات |
| الممثلون | `super_admin`, `program_admin`, … حسب env |
| دخول | `/admin/users`, `/admin/universities` |
| APIs | `/api/v1/users`, `/api/v1/universities` |
| الثقة | Confirmed |

### 3) المنهج والشهادات المصغّرة

| البند | التفاصيل |
|-------|----------|
| الغرض | تعريف tracks وmicro-credentials وlearning outcomes وmodules |
| دخول | `/admin/tracks`, `/admin/micro-credentials`, `/admin/learning-outcomes`, `/admin/content` |
| كيانات | `tracks`, `micro_credentials`, `learning_outcomes`, `modules`, `contents` |
| قواعد | حالات مسودة/مراجعة/نشط؛ أكواد فريدة |
| الثقة | Confirmed |

### 4) الأفواج والتسجيل والحضور

| البند | التفاصيل |
|-------|----------|
| الغرض | تشغيل فوج، طلب تسجيل، موافقة، جلسات، حضور |
| ممثلون | إداريون، instructor، student، university_reviewer |
| رحلات | انظر أدناه |
| كيانات | `cohorts`, `enrollments`, `sessions`, `attendance_records` |
| أحداث | `attendance_below_threshold` عبر eventDispatcher |
| الثقة | Confirmed |

### 5) التقييم والدرجات

| البند | التفاصيل |
|-------|----------|
| الغرض | إنشاء تقييمات، تسليم طلاب، رصد درجات، نماذج تقييم |
| دخول | بوابات admin/instructor/student assessments/submissions/grades |
| كيانات | `assessments`, `submissions`, `grades`, `rubrics`, `rubric_criteria` |
| أحداث | `assessment_overdue`, `assessment_ungraded_before_closure` |
| الثقة | Confirmed |

### 6) الجودة والمخاطر والنزاهة

| البند | التفاصيل |
|-------|----------|
| الغرض | مراجعات QA، إجراءات تصحيحية، حالات خطر/نزاهة |
| دخول | `/admin/qa*`, `/admin/risk-cases`, `/admin/integrity-cases`, instructor risk |
| ملاحظة | صفحات create/edit lazy موجودة لكن غير مربوطة بالموجّه — Weak inference أن الإدارة تتم من صفحات القائمة أو غير مكتملة |
| الثقة | Confirmed للقوائم والـ API؛ Incomplete للـ UI CRUD |

### 7) الاعتراف والشهادات

| البند | التفاصيل |
|-------|----------|
| الغرض | تجهيز طلب اعتراف + مستندات؛ إصدار شهادة + تحقق عام |
| دخول | admin/reviewer recognition؛ certificates؛ `/verify/certificate/:code` |
| أحداث | `recognition_request_status_changed`, `certificate_issued` |
| الثقة | Confirmed |

### 8) المقررات (Courses)

| البند | التفاصيل |
|-------|----------|
| الغرض | مقررات مستقلة مع أقسام ودروس وتقدّم؛ تدريب درس (رفع + اختبار + AI محتمل) |
| ممثلون | `super_admin` (إدارة)، `student` (استهلاك) |
| دخول | `/admin/courses`, `/student/courses` |
| خارجي | YouTube playlist preview؛ AI في تصحيح الدرس إن فُعّل |
| الثقة | Confirmed |

### 9) التدريب الميداني

| البند | التفاصيل |
|-------|----------|
| الغرض | فرص، أهلية، طلبات، جلسات، حضور، مهام، تقييمات قبل/بعد، خطابات إتمام، تقارير |
| ممثلون | admin FT roles، instructor المعيَّن، student، academic/reviewer للتقارير |
| دخول | `/admin/field-training*`, `/instructor/field-training*`, `/student/field-training*`, `/academic/field-training*` |
| خارجي | AI self-evaluate؛ استخراج PDF/DOCX؛ Excel/PDF تقارير |
| أكبر كتلة API (~122) | Confirmed من جرد المسارات |
| الثقة | Confirmed |

### 10) التحليلات والتقارير والملفات والـ AI العام

| البند | التفاصيل |
|-------|----------|
| Analytics | `/admin/analytics` → `/api/v1/analytics/*` (`super_admin`) |
| Reports | `/admin/reports`, reviewer university reports |
| Files | presign/confirm/download عبر `/api/v1/files` |
| AI عام | `/api/v1/ai/generate` مع rate limit |

---

## رحلات المستخدم الأساسية (نهاية لنهاية)

### رحلة أ — تسجيل طالب حتى الدخول

1. UI: `RegisterPage` → بيانات جامعة/تخصص/بريد.
2. `POST /api/auth/register`.
3. بريد OTP (Resend إن وُجد المفتاح).
4. `VerifyEmailOtpPage` → `POST /verify-email-otp`.
5. انتظار تفعيل إداري (`UsersListPage` / activate APIs).
6. دخول من `/login/student` → JWT → `/student` (`StudentEntryRedirect`).

**الثقة:** Confirmed.

### رحلة ب — طلب تسجيل في فوج والموافقة

1. طالب: `AvailableCohortsPage` → طلب.
2. API: `POST /api/v1/student/enrollment-requests` أو `/enrollments/request`.
3. إشعار أنواع `student_enrollment_requested` (enum موجود).
4. مراجع/إداري: `PendingEnrollmentsPage` أو `ReviewerEnrollmentRequestsPage`.
5. `PATCH .../approve` أو `reject`.
6. طالب يرى البرامج في `MyProgramsPage`.

**الثقة:** Confirmed للمسارات؛ تفاصيل نص الإشعار Strong inference من enums/services.

### رحلة ج — جلسة وحضور

1. إنشاء جلسة تحت cohort (admin/instructor).
2. `SessionAttendancePage` يحفظ عبر `POST /sessions/:id/attendance`.
3. تحديث سجلات `attendance_records`.
4. احتمال حدث انخفاض الحضور.

**الثقة:** Confirmed.

### رحلة د — تقييم وتسليم ودرجة

1. إنشاء assessment (instructor/admin) — **Confirmed** عبر `assessments.service.js` (POST/PUT/PATCH).
2. طالب يسلّم عبر submissions API — **فجوة واجهة (Confirmed في التحقق الثاني):** لا استدعاء `apiClient.post/put` لإنشاء/تحديث submissions الأكاديمية في `features/**/*.service.js`؛ الصفحات تقرأ `GET /submissions` و`GET /grades` فقط. نقاط BE للكتابة موجودة (`POST /assessments/:id/submissions`, إلخ).
3. مدرس يرصد درجة grades API — **نفس الفجوة** لكتابة grades الأكاديمية من الواجهة (قراءة فقط من FE).
4. الطالب يعرض `/student/grades` — **Confirmed** كعرض قائمة.

**الثقة:** Confirmed للقراءة والإنشاء الإداري للتقييم؛ **Contradiction / Incomplete** لرحلة التسليم/الدرجة الأكاديمية كاملة عبر SPA. تدريب ميداني له مسار تسليم منفصل مكتمل أكثر في `fieldTraining.service.js`.

### رحلة هـ — إصدار شهادة وتحقق عام

1. Admin: `CertificateIssuePage` → `POST /certificates`.
2. حدث `certificate_issued` + إشعار طالب.
3. زائر: `/verify/certificate/:verificationCode` → API verify العام.

**الثقة:** Confirmed.

### رحلة و — تدريب ميداني (طالب)

1. استعراض فرص `/student/field-training`.
2. تقديم طلب `POST .../apply`.
3. موافقة admin/instructor manage.
4. تقييم قبلي → حضور جلسات → مهام (+ AI self-eval اختياري) → تقييم بعدي.
5. أهلية إتمام → خطاب إتمام قابل للتنزيل.

**الثقة:** Confirmed للهيكل؛ تفاصيل كل انتقال حالة تتطلب قراءة workflow service عند التنفيذ — Strong inference من enums + routes.

### رحلة ز — إدارة مقرر ونشره

1. `SuperAdminCoursesRoute` / دروس.
2. هيكل sections/lessons؛ اختياري استيراد YouTube playlist.
3. إعداد `course_lesson_training`.
4. publish course.
5. طالب يبدأ ويتقدم ويكمل الدروس/التدريب.

**الثقة:** Confirmed.

---

## آثار جانبية شائعة عبر الميزات

| الأثر | الآلية |
|-------|--------|
| إشعار داخل التطبيق | `notification.service` / eventDispatcher |
| سجل تدقيق | `audit.service` / `audit_logs` |
| بريد | OTP فقط بشكل أساسي (Resend) |
| ملفات | جدول `files` + تخزين |

لا طوابير/cron مكتشفة — انظر [11_BACKGROUND_JOBS.md](./11_BACKGROUND_JOBS.md).

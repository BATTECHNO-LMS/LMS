# المصادقة والتفويض

## طريقة المصادقة

| العنصر | التنفيذ | الثقة |
|--------|---------|-------|
| الآلية | كلمة مرور + JWT Bearer | Confirmed |
| التجزئة | bcrypt | Confirmed (اعتمادية + auth service) |
| التوقيع | `jsonwebtoken` + `JWT_SECRET` | Confirmed — `utils/jwt.js` |
| مدة التوكن | `JWT_EXPIRES_IN` افتراضي `7d` | Confirmed — `env.js` |
| التخزين في الواجهة | `localStorage` مفتاح `battechno_lms_auth_token` | Confirmed — `utils/storage.js` |
| الإرسال | `Authorization: Bearer` عبر Axios interceptor | Confirmed — `apiClient.js` |
| الجلسات الخادمية | لا مخزن جلسات — JWT stateless | Confirmed |
| إبطال عند logout | رسالة نجاح فقط؛ المسح من العميل | Confirmed — سلوك logout |
| OAuth / MFA | غير مكتشف | Confirmed absence |
| Refresh tokens | غير مكتشف | Confirmed absence |

## حمولة JWT

الحقول: `userId`, `roles[]`, `universityId`, `isGlobal` — `utils/jwt.js`.

`isGlobal` يُضبط عند وجود دور `super_admin` (أو `SUPER_ADMIN_ROLE_CODE`).

## تدفقات

### التسجيل

`POST /api/auth/register` → مستخدم `inactive` + دور `student` + OTP بريد → `requiresEmailVerification`.

### تحقق البريد

OTP 6 أرقام، تخزين `code_hash`, حدود محاولات/إعادة إرسال من env (`EMAIL_OTP_*`).

### التفعيل

`PATCH /users/:id/activate` أو تفعيل جماعي — أدوار `USER_ACTIVATE_ROLE_CODES`.

### الدخول

رفض إن البريد غير متحقق أو الحالة ليست `active`؛ ثم إصدار JWT + ملف شخصي.

### إعادة كلمة المرور

forgot → verify OTP → `resetToken` → reset password؛ رسائل عامة لمنع تعداد الحسابات.

## مصفوفة الأدوار والصلاحيات (تشغيلية)

### الأدوار المُبذورة

| code | scope | بوابة UI رئيسية |
|------|-------|-----------------|
| `super_admin` | global | `/admin` |
| `program_admin` | university* | `/admin` |
| `university_admin` | university | `/admin` |
| `academic_admin` | university | `/admin`, `/academic` |
| `qa_officer` | university | `/admin`, `/academic` |
| `instructor` | university | `/instructor` |
| `student` | university | `/student` |
| `university_reviewer` | university | `/reviewer`, `/academic` |

\*عمليًا `program_admin` يُعامل كنظامي عابر في `universityScope` — Confirmed.

### مجالات التفويض الخادمي (افتراضيات env)

| المجال | قراءة نموذجية | كتابة نموذجية |
|--------|---------------|---------------|
| مستخدمون | ADMIN_READ | USER_WRITE |
| تفعيل | — | USER_ACTIVATE (+ university/academic admin) |
| منهج | CURRICULUM_READ (+ instructor/qa) | CURRICULUM_WRITE |
| تسليم | DELIVERY_READ | DELIVERY_WRITE (+ instructor) |
| أكاديمي | ACADEMIC_READ (+ student) | ACADEMIC_WRITE |
| أدلة | EVIDENCE_READ (+ reviewer) | EVIDENCE_WRITE |
| QA | QA_OVERSIGHT | نفس |
| مخاطر/نزاهة | RISK_INTEGRITY (+ instructor) | نفس |
| اعتراف | RECOGNITION_READ (+ reviewer) | RECOGNITION_WRITE |
| شهادات | CERTIFICATE_READ | CERTIFICATE_WRITE |
| تدقيق | AUDIT_LOG_READ | — |
| تقارير | REPORT_READ | — |
| قرار تسجيل | — | ENROLLMENT_DECISION (+ reviewer) |
| FT | مسارات منفصلة admin/instructor/academic | حسب البوابة |

التفاصيل الدقيقة للرموز الافتراضية: `backend/src/config/env.js`.

### صلاحيات جدول `permissions`

- تُحمَّل في login/`me` عبر joins.
- **لا seed ظاهر** لأي صفوف — التفويض الفعلي عبر أدوار env.
- الواجهة لديها مصفوفة UI منفصلة في `utils/rolePermissions.js`.

**التصنيف:** Contradiction بين هيكل RBAC بالصلاحيات والاستخدام الفعلي بالأدوار.

## أين يُفرض التفويض؟

| الميزة / البوابة | Frontend | Backend | الحكم |
|------------------|----------|---------|-------|
| دخول المناطق المحمية | ProtectedRoute | JWT مطلوب على معظم v1 | كلاهما |
| فصل البوابات admin/instructor/… | RoleBasedRoute | authorizeRoles على المسارات | كلاهما |
| عناصر قائمة/أزرار | PermissionGate / nav filters | — | Frontend فقط (ظهور) |
| عمليات حساسة (تفعيل، إصدار شهادة، FT manage) | إخفاء جزئي | أدوار إلزامية | Backend هو مصدر الحقيقة |
| نطاق الجامعة | TenantContext / تخزين محلي | `universityScope.js` | Backend للحماية الحقيقية؛ FE للمساعدة |
| Analytics / courses admin | wrappers SuperAdmin* | غالبًا `super_admin` على المسارات | كلاهما (تحقق BE مطلوب) |

## نطاق الجامعة (Tenant)

- ليس multi-tenant بقواعد DB منفصلة.
- التقييد عبر `primary_university_id` في JWT وفلترة الاستعلامات.
- `super_admin` و`program_admin` عابران (system-wide).
- `tenantScope` في localStorage موثَّق كمحاكاة واجهة — Confirmed تعليق في `storage.js`.

## عدم اتساق محتمل (رصد فقط)

| الموضوع | الدليل | الثقة |
|---------|--------|-------|
| `forcedRole` في صفحات الدخول عرضي لا يمنع دورًا آخر | `portalLogins.jsx` + توجيه حسب أدوار حقيقية | Confirmed |
| `role.middleware.requireRoles` يتوقع `req.user.role` المفرد وغير مستخدم في المسارات | ملف middleware | Confirmed dead-ish path |
| صلاحيات UI قد تسمح برؤية ما يرفضه API أو العكس | مصفوفتان منفصلتان | Strong inference |
| JWT في localStorage عرضة لXSS إن وُجد | نمط شائع | Weak inference للمخاطر العملية |

## مصفوفة دور × قدرة (مبسط)

| القدرة | SA | PA | UA | AA | QA | INS | STU | REV |
|--------|:--:|:--:|:--:|:--:|:--:|:---:|:---:|:---:|
| إدارة مستخدمين (كتابة) | ✓ | ✓ | | | | | | |
| تفعيل طلاب | ✓ | ✓ | ✓ | ✓ | | | | |
| منهج كتابة | ✓ | ✓ | | ✓ | | | | |
| تدريس/حضور | ✓* | ✓* | ✓* | ✓* | | ✓ | | |
| تسليم طالب | | | | | | | ✓ | |
| قرار تسجيل | ✓ | ✓ | | ✓ | | | | ✓ |
| اعتراف قراءة | ✓ | ✓ | ✓ | ✓ | | | | ✓ |
| شهادات كتابة | ✓ | ✓ | ✓ | ✓ | | | | |
| FT إدارة | ✓ | ✓ | ✓ | ✓ | | معيَّن | تقديم | تقارير |
| Analytics | ✓ | | | | | | | |

\*حسب قوائم DELIVERY/ACADEMIC؛ SA يتجاوز عبر `isGlobal`.  
الرموز: SA=super_admin … REV=university_reviewer.

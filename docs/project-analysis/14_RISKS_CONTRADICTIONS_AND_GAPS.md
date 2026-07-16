# المخاطر والتناقضات والفجوات المعرفية

هذه قائمة رصد فقط — **ليست** خطة إصلاح.

## 1) جدول `permissions` غير مُبذور مقابل تحميل الصلاحيات

| الحقل | المحتوى |
|-------|---------|
| Finding | login/`me` تجمع `permissionCodes` من DB بينما لا seed ظاهر لـ `permissions` |
| Evidence | `auth.repository.js` joins؛ غياب create permissions في scripts |
| Why risky | واجهة قد تعتمد أكوادًا فارغة وترجع لمصفوفة دور؛ التباس ملكية التفويض |
| Files | `auth.repository.js`, `rolePermissions.js`, schema `permissions` |
| Confidence | Confirmed (الهيكل) / Strong inference (النية المستقبلية) |
| Question | هل صلاحيات DB مهجورة أم قيد التفعيل؟ |

## 2) مصدران للتفويض (env roles vs UI matrix)

| الحقل | المحتوى |
|-------|---------|
| Finding | الخادم يستخدم قوائم أدوار env؛ الواجهة مصفوفة UI منفصلة |
| Evidence | `env.js`, `authorizeRoles`, `rolePermissions.js` |
| Why risky | اختلاف ظهور الزر عن سماح API |
| Confidence | Confirmed |
| Question | ما مصدر الحقيقة المعتمد للمنتج؟ |

## 3) JWT في localStorage بدون إبطال خادمي

| الحقل | المحتوى |
|-------|---------|
| Finding | logout لا يُسقط التوكن خادمياً؛ التخزين في localStorage |
| Evidence | auth logout؛ `storage.js` |
| Why risky | سرقة توكن عبر XSS تبقى صالحة حتى انتهاء المدة |
| Confidence | Confirmed للنمط؛ Weak لوجود XSS فعلي |
| Question | هل مطلوب قائمة إبطال أو تخزين httpOnly؟ |

## 4) صفحات lazy غير مربوطة بالموجّه

| الحقل | المحتوى |
|-------|---------|
| Finding | CRUD pages لـ QA/Risk/Integrity وreviewer FT معرفة وغير مستخدمة في router |
| Evidence | `lazyPages.js` vs `router/index.jsx` |
| Why risky | وظائف ناقصة أو دين مجتمعي؛ المستخدم يعتمد على قوائم فقط |
| Confidence | Confirmed لعدم الربط |
| Question | هل هي عمل قيد الإنجاز أم بقايا؟ |

## 5) أحداث overdue بدون مسح دوري (مصحَّح في التحقق الثاني)

| الحقل | المحتوى |
|-------|---------|
| Finding | لا cron؛ الإشعارات المتأخرة تُطلق فقط عند create/update إن كان الموعد ماضيًا وقت الحفظ |
| Evidence | `dispatchAppEvent` من `correctiveActions.service.js` / `assessments.service.js` / `attendance.service.js`؛ غياب schedulers |
| Why risky | سجل متأخر لم يُمس بعد الانقضاء قد لا يولّد إشعارًا أبدًا |
| Files | `eventDispatcher.service.js`, services أعلاه |
| Confidence | Confirmed |
| Question | هل يوجد cron خارج المستودع أم الاعتماد على الكتابة فقط مقصود؟ |

## 6) كبر سطح التدريب الميداني

| الحقل | المحتوى |
|-------|---------|
| Finding | ~122 endpoints لدورة حياة معقدة |
| Evidence | routes FT + enums كثيرة |
| Why risky | احتمالات حالات حافة؛ اختبارات موجودة لكنها أصغر من السطح |
| Confidence | Confirmed للحجم |
| Question | ما الحالات الرسمية المعتمدة للانتقال بين `training_status`؟ |

## 7) AI يرسل محتوى طلاب

| الحقل | المحتوى |
|-------|---------|
| Finding | تقييم ذاتي/تصحيح يمر عبر مزود AI خارجي عند التفعيل |
| Evidence | FT AI + ai.service |
| Why risky | خصوصية بيانات تعليمية؛ اعتماد على مفتاح وحصص |
| Confidence | Confirmed عند تفعيل المزود |
| Question | ما سياسة الاحتفاظ والموافقة؟ |

## 8) ازدواجية تخصص المستخدم

| الحقل | المحتوى |
|-------|---------|
| Finding | `specialty_id` و`university_specialty_id` معًا على `users` |
| Evidence | schema |
| Why risky | عدم اتساق تقارير/أهلية FT إن اختلفا |
| Confidence | Confirmed للحقول؛ Unknown لقواعد المزامنة الكاملة |
| Question | أي الحقلين مصدر الحقيقة بعد التسجيل؟ |

## 9) علاقات Prisma غير مكتملة لبعض الجداول القديمة

| الحقل | المحتوى |
|-------|---------|
| Finding | جداول بمراجع UUID دون `@relation` كاملة |
| Evidence | تعليقات check constraints؛ نماذج بدون relations |
| Why risky | سلامة مرجعية تعتمد على DB constraints غير الظاهرة كلها في Prisma |
| Confidence | Weak–Strong حسب الجدول |
| Question | هل كل FK مفروضة على مستوى PostgreSQL؟ |

## 10) middleware أدوار قديم غير مستخدم

| الحقل | المحتوى |
|-------|---------|
| Finding | `requireRoles` يتوقع `req.user.role` المفرد |
| Evidence | `role.middleware.js`؛ المسارات تستخدم `authorizeRoles` |
| Why risky | التباس للمساهمين الجدد إن استُخدم خطأً |
| Confidence | Confirmed |
| Question | هل يُحذف لاحقًا أم يُصلح؟ (لا إصلاح الآن) |

## 11) CORS أصول ثابتة + env

| الحقل | المحتوى |
|-------|---------|
| Finding | قائمة origins مضمّنة تتضمن lms.battechno.com بالإضافة إلى `CORS_ORIGINS` |
| Evidence | `app.js` |
| Why risky | صعوبة تقييد صارم؛ بيئات غير متوقعة قد تُحظر أو تُسمح |
| Confidence | Confirmed |
| Question | ما قائمة الأصول الرسمية للإنتاج؟ |

## 12) تغطية اختبارات وغياب اختبارات الواجهة

| الحقل | المحتوى |
|-------|---------|
| Finding | CI يبني الواجهة دون اختبارات؛ API واسع |
| Evidence | ci.yml؛ frontend بلا tests ظاهرة |
| Why risky | انحدارات UI/auth غير مكتشفة |
| Confidence | Confirmed |
| Question | ما الحد الأدنى المطلوب قبل الإصدارات؟ |

## 13) وثائق متعددة الأجيال

| الحقل | المحتوى |
|-------|---------|
| Finding | `docs/*`, `التوثيق_الشامل.md`, `backend_documentation.md`, وهذا التحليل |
| Evidence | شجرة docs |
| Why risky | تعارض إصدارات التوثيق مع الكود الحالي |
| Confidence | Strong inference |
| Question | أي وثيقة مصدر الحقيقة للمنتج؟ |

## 14) حسابات البذور التجريبية

| الحقل | المحتوى |
|-------|---------|
| Finding | سكربتات demo/test-accounts محذّر منها في README للإنتاج |
| Evidence | README scripts |
| Why risky | تشغيل خاطئ على إنتاج يلوّث البيانات أو يكشف حسابات |
| Confidence | Confirmed للتحذير |
| Question | هل الإنتاج معزول عن هذه السكربتات؟ |

## أسئلة لمالك المنتج (ملخص)

1. هل جدول permissions سيُفعَّل؟
2. ما سياسة الإبطال للجلسات؟
3. هل صفحات QA/Risk CRUD مطلوبة في الواجهة؟
4. هل توجد مهام مجدولة خارج المستودع؟
5. ما جامعات/نطاقات الإنتاج الفعلية بخلاف baseline؟
6. ما مسار النشر النهائي (المضيف، الأسرار، النسخ الاحتياطي)؟
7. ما متطلبات الامتثال لبيانات الطلاب والـ AI؟
8. هل إنشاء تسليمات/درجات التقييم الأكاديمي (غير FT) مكتمل في الواجهة أم API-only/غير جاهز؟
9. هل `auth.refresh` مخطط أم بقايا؟
10. هل `POST /api/v1/enrollments/request` مقصود كبديل لـ `student/enrollment-requests`؟

---

## Second-Pass Verification

تاريخ التحقق الثاني: 2026-07-16. المنهج: تحدّي ادّعاءات المرور الأول عبر إعادة جرد الموجّه، كل `*.routes.js`، كل `features/**/*.service.js` + `endpoints.js`، استدعاءات `dispatchAppEvent`، سكربتات CLI، و`schema.prisma` — دون تعديل شفرة التطبيق.

### نتائج التحقق السريعة (1–20)

| # | بند التحقق | نتيجة المرور الثاني | الثقة |
|---|------------|---------------------|-------|
| 1 | كل تعريف مسار في الموجّه ممثَّل في الجرد | **مقبول مع تصحيح أرقام**: `path="` = **167**، عناصر `<Route` = **186**، `<Navigate` = **15**. المرور الأول (~166/~153) كان تقريبيًا وليس ناقصًا لمسارات كاملة. لا توجيه قائم على نظام ملفات. | Confirmed |
| 2 | مسارات filesystem / مولَّدة ديناميكيًا | **لا filesystem routing** (ليس Next/Remix). الديناميكي = `React.lazy` في `lazyPages.js` + معاملات `:id` + **query strings في التنقل** (`?section=`) لنفس مسار FT للمدرّس. | Confirmed |
| 3 | كل استدعاء FE قورن بـ BE | **لم يكن مكتملًا في المرور الأول** (كان Strong inference). المرور الثاني: ~**294** نمط method+path من الخدمات (مع توسيع بادئات FT حسب الدور) مقابل **327** تسجيل `router.*` + **3** في `app.js` = **330**. اكتُشفت فجوات كتابة أكاديمية وفانتوم endpoints. | Confirmed للمقارنة الموسّعة |
| 4 | كل endpoint BE فُحص لمستهلكين | واجهة + CLI سكربتات + تحقق شهادة عام + رفع مقرَّر. **لا** webhooks / mobile app / workers. بعض الـ BE بلا مستهلك FE ثابت (لا يعني unused). | Confirmed absence للـ webhook/cron؛ Unknown لمستهلكين خارج المستودع |
| 5 | كل نموذج DB | **60** `model` في schema — مطابق للمرور الأول. إضافة: **53** `enum` لم تُفهرَس تفصيليًا سابقًا. | Confirmed |
| 6 | العلاقات تطابق الكود/الهجرات | علاقات FT/courses موثّقة بـ `@relation`. جداول أقدم كثيرة بدون relations Prisma كاملة. **`attempt_status` enum بلا جدول `attempts`**. | Confirmed للتناقض؛ Strong inference لنواقص FK |
| 7 | تمييز authentication vs authorization | مؤكد: `authMiddleware` ≠ `authorizeRoles` / `universityScope`. | Confirmed |
| 8 | UI permissions ≠ إنفاذ خادمي | مؤكد: `PermissionGate` / `RoleShellPermissionOutlet` / `rolePermissions.js` للظهور فقط. | Confirmed |
| 9 | عناصر التنقل ↔ مسارات موثّقة | عناصر `ADMIN_NAV_GROUPS` (34) و`NAV_BY_ROLE` تطابق مسارات موجودة. استثناءات: روابط مدرّس بـ `?section=` ليست مسارات Router منفصلة؛ مكرر `/instructor/field-training` مرتين في القائمة. | Confirmed |
| 10 | مسارات خارج التنقل | CRUD العميق وaliases وcatch-alls ما زالت في الموجّه — لم تُستبعد. | Confirmed |
| 11 | jobs/workers/cron/events | لا cron/queues. أحداث `dispatchAppEvent` **تُستدعى فعليًا** من services/controllers عند الكتابة (ليس مجدولًا). `cohort_status_changed` مسجّل ولم يُطلق أبدًا. | Confirmed |
| 12 | env بدون قيم | أسماء فقط من `env.js` / `.env.example`؛ قيم `.env` المحلية لم تُنسخ. Frontend: `VITE_API_BASE_URL`, `VITE_APP_ORIGINS`, `VITE_API_VERSION`. | Confirmed |
| 13 | تكاملات بلا تنفيذ | لم تُنفَّذ استدعاءات حقيقية. | Confirmed |
| 14 | مكوّنات ديناميكية/سجلات | lazy عبر `lazyPages.js` فقط؛ **لا** plugin registry / DI container / reflection. صفحات lazy غير مربوطة ما زالت قائمة. | Confirmed |
| 15 | feature flags | لا نظام flags. سلوك تكويني عبر env (`AI_PROVIDER`, `STORAGE_BACKEND`, قوائم الأدوار). `FEATURE_KEYS` في اللاندنج = مفاتيح عرض تسويقية فقط. | Confirmed |
| 16 | ربط الاختبارات بالميزات | فهرس الملفات صحيح؛ لم تُشغَّل الاختبارات. لا تغطية FE. | Confirmed |
| 17 | قواعد أعمال vs افتراضات تنفيذ | رحلة «تسليم تقييم أكاديمي» في المرور الأول **أُضعفت**: الواجهة لا تستدعي كتابة submissions/grades الأكاديمية. | Confirmed للفجوة؛ Weak لنية المنتج |
| 18 | تناقضات FE/BE/DB/types | مُوسَّعة أدناه (refresh فانتوم، submissions/grades، enrollments المزدوج، attempt_status). | Confirmed |
| 19 | ادّعاءات كبرى بأدلة | الأرقام والـ API/المسارات رُفعت إلى Confirmed حيث أُعيد العدّ. ادّعاء «مقارنة FE↔BE مكتملة» في المرور الأول **أُسقط**. | Confirmed |
| 20 | ادّعاءات بلا دعم | خُفّضت إلى inference/unknown في التصحيحات. | Confirmed |

### نقاط دخول بديلة فُحصت

| النوع | النتيجة |
|-------|---------|
| Dynamic imports / lazy | `lazyPages.js` فقط لمسارات الصفحات |
| Route / plugin registries | غير موجودة |
| DI / reflection | غير موجودة |
| Event subscriptions | `dispatchAppEvent` داخل العملية |
| Queue processors | غير موجودة |
| CLI | `backend/scripts/*` + `prisma/seed.js` (بذور، تنظيف، R2، backfill، اختبارات HTTP محلية) |
| Webhooks / serverless functions | غير موجودة في المستودع |
| Middleware | سلسلة Express قياسية (`auth`, roles, rate limit, errors) |
| Configuration-driven modules | قوائم أدوار env؛ لا تحميل وحدات بالاسم من الإعداد |
| String-based module refs | `require('../modules/...')` صريح في `routes/index.js` |

### تصحيحات مفصّلة

#### C1 — اكتمال مقارنة FE API ↔ BE

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | «معظم خدمات الواجهة تستهدف مسارات موجودة» (Strong inference) دون جرد استدعاءات كامل |
| New evidence | جرد 36× `*.service.js` + `endpoints.js`؛ لا `apiClient.post/put/patch` لإنشاء/تحديث submissions أو grades الأكاديمية؛ لا استدعاء لـ nested `assessments/:id/submissions` أو `.../grades` |
| Corrected conclusion | المقارنة **جزئية سابقًا**. بعد التحقق: الواجهة **تقرأ** submissions/grades عبر GET فقط؛ نقاط BE للكتابة الأكاديمية (`POST/PUT` submissions، `POST/PUT/PATCH` grades، nested تحت assessments) **بلا مستهلك FE مكتشف**. كتابة التسليمات/الدرجات في **التدريب الميداني** موجودة في `fieldTraining.service.js`. |
| Confidence | Confirmed |
| Affected docs | `06_API_CATALOG.md`, `04_FEATURES_AND_USER_FLOWS.md`, `00_EXECUTIVE_SUMMARY.md` (ضمنيًا), هذا الملف |

#### C2 — `endpoints.auth.refresh` بلا معالج خادمي

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | لم يُذكر؛ ضِمنيًا أن خريطة endpoints متوافقة |
| New evidence | `frontend/src/services/endpoints.js` يعرّف `auth.refresh` → `/api/auth/refresh`؛ `auth.routes.js` لا يسجّل `/refresh`؛ لا استدعاء من `auth.service.js` |
| Corrected conclusion | ثابت واجهة **يتيم / فانتوم** — ليس تدفق refresh فعّال. لا refresh tokens في الخادم. |
| Confidence | Confirmed |
| Affected docs | `06_API_CATALOG.md`, `08_AUTHENTICATION_AND_AUTHORIZATION.md` |

#### C3 — أرقام المسارات والصفحات

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | ~166 إدخالات / ~153 صفحة قابلة للعرض |
| New evidence | عدّ آلي على `router/index.jsx`: 167× `path="`, 186× `<Route`, 15× `<Navigate` |
| Corrected conclusion | استخدم **167 سمة path** كمرجع أدق. عدد «الصفحات القابلة للعرض» يبقى تقديرًا (~150+) حسب استبعاد Navigate/layouts. |
| Confidence | Confirmed للأرقام الخام؛ Strong inference لتصنيف الصفحة |
| Affected docs | `05_ROUTES_AND_PAGES.md`, `16_ANALYSIS_COVERAGE.md`, `00_EXECUTIVE_SUMMARY.md` |

#### C4 — أحداث overdue ليست «ميتة» بالكامل رغم غياب cron

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | قد لا تُطلق أبدًا بدون مجدول (Unknown/Weak) |
| New evidence | `correctiveActions.service.js` و`assessments.service.js` يستدعيان `dispatchAppEvent('*_overdue')` عند create/update/patch إذا كان التاريخ في الماضي؛ `attendance_below_threshold` عند حفظ الحضور |
| Corrected conclusion | الإطلاق **متزامن مع طلبات الكتابة** عند اكتشاف التأخر وقت الحفظ — **وليس** مسحًا دوريًا لكل السجلات المتأخرة. خطر تشغيلي يبقى إن لم يُمس السجل بعد انقضاء الموعد. |
| Confidence | Confirmed |
| Affected docs | `11_BACKGROUND_JOBS.md`, بند 5 أعلاه |

#### C5 — `cohort_status_changed` مسجّل وغير مُرسل

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | مذكور كـ fallthrough بدون تأكيد عدم الإرسال |
| New evidence | لا `dispatchAppEvent('cohort_status_changed'` في المستودع خارج تعريف الـ switch |
| Corrected conclusion | معالج فارغ + **صفر استدعاءات** — بقايا أو تجهيز مستقبلي. |
| Confidence | Confirmed |
| Affected docs | `11_BACKGROUND_JOBS.md` |

#### C6 — تسجيل مزدوج لمسار طلب الالتحاق

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | ذكر كلا المسارين كجزء من كتالوج التسجيل دون مقارنة FE |
| New evidence | FE يستخدم فقط `POST /api/v1/student/enrollment-requests`؛ BE يعرّف أيضًا `POST /api/v1/enrollments/request` |
| Corrected conclusion | ازدواجية خادم محتملة؛ المسار الثاني بلا مستهلك FE مكتشف (قد يكون CLI/قديم/خارجي — Unknown). |
| Confidence | Confirmed للازدواجية والاستخدام FE؛ Unknown لسبب الإبقاء |
| Affected docs | `06_API_CATALOG.md`, `04_FEATURES_AND_USER_FLOWS.md` |

#### C7 — تنقل المدرّس بـ query string

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | قائمة instructor ↔ مسارات؛ لم تُفصَّل query sections |
| New evidence | `NAV_BY_ROLE` يضم `/instructor/field-training?section=sessions|tasks|results|eligibility` ومكررين لنفس المسار الأساسي |
| Corrected conclusion | هذه **ليست** مسارات Router إضافية؛ هي روابط لنفس `/instructor/field-training` مع حالة قسم في الواجهة. الجرد بالمسارات ما زال صحيحًا إن لم تُحسب كصفحات منفصلة. |
| Confidence | Confirmed |
| Affected docs | `05_ROUTES_AND_PAGES.md` |

#### C8 — enum `attempt_status` بلا نموذج attempts

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | لم يُبرَز |
| New evidence | `enum attempt_status` في schema؛ لا `model attempts`؛ `submissions.attempt_id` اختياري؛ يوجد `field_training_assessment_attempts` منفصل |
| Corrected conclusion | بقايا مخطط أو تحضير لبنك محاولات أكاديمية غير مُنفَّذ — **Contradiction/فجوة نموذج**. |
| Confidence | Confirmed للغياب؛ Unknown للنية |
| Affected docs | `07_DATABASE_AND_DATA_MODEL.md` |

#### C9 — عدد نقاط API

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | ~330 (Strong inference) |
| New evidence | عدّ `router.(get|post|put|patch|delete)` عبر 45 ملف routes = **327** + 3 في `app.js` = **330**. تقارير FT ليست double-mount لنفس الراوتر. |
| Corrected conclusion | **330 Confirmed** بهذه المنهجية. |
| Confidence | Confirmed |
| Affected docs | `06_API_CATALOG.md`, `16_ANALYSIS_COVERAGE.md` |

#### C10 — مستهلكون لـ BE بلا FE

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | تحذير عام بعدم وسم unused |
| New evidence | أمثلة بلا مستهلك FE ثابت: `GET /api/v1/students/:studentId/grades|submissions`، `GET /api/v1/files/health/storage`، `GET /api/v1/ai/test`، `GET /api/auth/register/specialties` (ثابت endpoints غير مستدعى من service)، معظم `GET /api/v1/analytics/:domain` (`fetchAnalyticsDomain` غير مستدعى من الصفحات)، مسارات legacy `/api/v1/reports/field-training/*` (وضع `legacy` في FE غير ممرَّر من UI)، وكتابة submissions/grades الأكاديمية أعلاه. CLI قد يستدعي بعضها عبر سكربتات اختبار HTTP. |
| Corrected conclusion | قائمة مرشّحات «بدون مستهلك SPA» — ليست حكم unused نهائي. |
| Confidence | Confirmed لغياب الاستدعاء في services؛ Unknown لاستخدام خارجي |
| Affected docs | `06_API_CATALOG.md` |

#### C11 — تمييز المصادقة/التفويض وUI (إعادة تأكيد)

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | مفصول بشكل صحيح في المرور الأول |
| New evidence | إعادة قراءة middlewares + `RoleShellPermissionOutlet` + عدم وجود `RoleShellPermissionOutlet` على `/admin` |
| Corrected conclusion | **لا تصحيح جوهري** — المرور الأول كان صحيحًا. ملاحظة إضافية: غلاف admin يعتمد `RoleBasedRoute(ADMIN_ROLE_SET)` + تصفية تنقل، بينما instructor/student/reviewer/academic يضيفون فحص UI permission للمسار. |
| Confidence | Confirmed |
| Affected docs | `08_AUTHENTICATION_AND_AUTHORIZATION.md` (تأكيد) |

#### C12 — Feature flags

| الحقل | المحتوى |
|-------|---------|
| Original conclusion | لا نظام flags (Strong inference) |
| New evidence | لا مكتبات flags؛ `FEATURE_KEYS` تسويقي؛ التحكم عبر env |
| Corrected conclusion | يُرفع إلى **Confirmed absence** لنظام feature-flag منتج. |
| Confidence | Confirmed |
| Affected docs | `12_CONFIGURATION_AND_DEPLOYMENT.md` |

### ادّعاءات أُسقطت أو خُفّضت صراحةً

1. «مقارنة الواجهة/الخادم مكتملة بما يكفي كـ Strong inference عام» → استُبدلت بمقارنة موثّقة وفجوات Confirmed.
2. «رحلة التسليم والدرجة الأكاديمية كنهاية-لنهاية في الواجهة» → **Weak inference / فجوة واجهة** ما لم يوجد مسار غير service (لم يُعثر).
3. «أحداث overdue قد لا تُطلق أبدًا» → تصحيح إلى «تُطلق عند الكتابة إن كان الموعد ماضيًا؛ لا مسح دوري».

### أسئلة إضافية ناتجة عن التحقق الثاني

انظر البنود 8–10 في قائمة أسئلة مالك المنتج أعلاه.

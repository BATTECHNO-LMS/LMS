# تغطية التحليل

## نطاق التحليل

| البند | الحالة |
|-------|--------|
| تاريخ | 2026-07-16 |
| نمط العمل | تحليل عكسي read-only |
| تعديل خارج `docs/project-analysis/` | لم يحدث |
| تشغيل migrations/seeds/اختبارات كاتبة | لم يحدث |
| قراءة قيم أسرار `.env` في التوثيق | لم تُنسخ |

## المجلدات التي حُللت (بعمق متفاوت)

| المسار | مستوى التحليل |
|--------|----------------|
| `README.md`, `docs/*.md` | مراجعة داعمة |
| `backend/package.json`, `frontend/package.json` | كامل |
| `backend/src/app.js`, `server.js`, `routes/index.js`, `config/env.js` | كامل |
| `backend/prisma/schema.prisma` | كامل تقريبًا |
| `backend/prisma/migrations/` | أسماء/غرض عالي المستوى فقط |
| `backend/src/modules/**` (routes خاصة) | جرد endpoints شامل عبر وكيل + عينات |
| `backend/src/middlewares/**`, `shared/**` | مصادقة، أخطاء، أحداث، بريد، تخزين |
| `backend/scripts/lib/baselineCatalog.js` | أدوار/بيانات أساس |
| `backend/tests/**` | فهرسة الملفات |
| `frontend/src/app/router/**` | كامل |
| `frontend/src/constants/roles.js`, navigation | كامل/جزئي |
| `frontend/src/features/auth/**`, services/apiClient | جوهري |
| `frontend/src/assets/styles/abstracts/_variables.scss` | كامل للرموز |
| `frontend/src/pages/**`, `components/**` | عينة + عدّ؛ ليس قراءة كل ملف سطرًا سطرًا |
| `.github/workflows/ci.yml`, `backend/Dockerfile` | كامل |
| `docs/project-analysis/` | مُنشأ في هذه المرحلة |

## المجلدات/الملفات المستبعدة أو المحدودة

| المسار | السبب |
|--------|-------|
| `**/node_modules/**` | اعتماديات؛ ليست منطق منتج |
| `backend/node_modules/.prisma/**` | مولَّد |
| قيم `backend/.env` / `frontend/.env` | أسرار — أسماء المتغيرات فقط من example/env.js |
| بيانات PostgreSQL الحية | ممنوع في قواعد المرحلة |
| كل سطر في ~200 صفحة و~118 مكوّن | تغطية عيّنية + الموجّه كمصدر حقيقة للمسارات |
| كل جسم service لكل endpoint من 330 | الكتالوج على مستوى المسار/المعالج/الدور؛ التفاصيل الداخلية انتقائية |

## ما اكتُشف (أرقام — بعد التحقق الثاني)

| الفئة | العدد | ملاحظات | الثقة |
|-------|------:|---------|--------|
| سمات `path=` في الموجّه | **167** | عدّ على `router/index.jsx` | Confirmed |
| عناصر `<Route` | **186** | يشمل layouts/index بدون path أحيانًا | Confirmed |
| عناصر `<Navigate` | **15** | redirects داخل الموجّه | Confirmed |
| صفحات قابلة للعرض | ~150+ | تقدير بعد استبعاد Navigate فقط | Strong inference |
| تسجيلات `router.*` في BE | **327** | 45 ملف `*.routes.js` | Confirmed |
| نقاط HTTP إجمالية | **330** | 327 + `/`, `/health`, `/health/ready` | Confirmed |
| أنماط FE method+path (موسّعة الأدوار) | ~**294** | من `features/**/*.service.js` | Confirmed |
| نماذج Prisma | **60** | | Confirmed |
| enums Prisma | **53** | لم تُفهرَس فرديًا في المرور الأول | Confirmed |
| أدوار مستخدم | **8** | مُبذورة | Confirmed |
| عناصر تنقل admin (`entry`) | **34** | `adminNavigation.js` | Confirmed |
| ملفات اختبار backend | **15** | | Confirmed |
| تكاملات خارجية رئيسية | ~8–10 | | Confirmed |
| مكوّنات JSX (`components/`) | ~118 | عدّ ملفات | Confirmed |
| صفحات JSX (`pages/`) | ~200 | يشمل أجزاء فرعية | Confirmed |
| migrations | **26** | مجلدات | Confirmed |

## ما لم يُراجع بالكامل

- منطق كل دالة في وحدات FT الضخمة سطرًا سطرًا.
- كل ملف ترجمة i18n.
- كل صفحة CRUD admin لربطها بـ API field-by-field.
- سكربتات seed الطويلة باستثناء baseline roles.
- سلوك وقت التشغيل الفعلي (DNS بوابات، Resend، R2، Gemini) بدون استدعاءات.

## قيود بسبب غياب الإعداد/الخدمات

- لا يمكن تأكيد أن البريد يُرسل في البيئة الحالية.
- لا يمكن تأكيد backend التخزين الفعلي (local vs R2) دون قراءة تشغيلية للقيم (مُتجنَّبة).
- لا يمكن تأكيد اكتمال بيانات الإنتاج أو الجامعات الفعلية.
- اختبارات التكامل لم تُشغَّل؛ قد تفشل أو تحتاج DB.

## ادعاء التغطية الكاملة؟

**لا.** حتى بعد التحقق الثاني: التغطية **قوية** على المسارات وأعداد API والمقارنة FE↔BE والنموذج والمصادقة ونقاط الدخول البديلة، و**جزئية** على منطق كل handler داخل FT وعلى سلوك وقت التشغيل للتكاملات.

## وثائق مُنتَجة

جميع الملفات تحت `docs/project-analysis/` المدرجة في [README.md](./README.md).

---

## Second-Pass Verification

تاريخ: 2026-07-16. الهدف: تحدّي تغطية المرور الأول وليس تكرار الملخص التنفيذي.

### ما أُعيد فحصه في التحقق الثاني

| المجال | طريقة الفحص | اكتمال نسبي |
|--------|-------------|-------------|
| موجّه الواجهة | عدّ `path=` / `<Route` / `<Navigate` + مطابقة التنقل | عالٍ |
| تنقل | `adminNavigation.js`, `navigation.js` (بما فيه `?section=`) | عالٍ |
| API backend | عدّ كل `router.METHOD` في 45 ملفًا + mounts في `app.js` | عالٍ |
| API frontend | قراءة خدمات الميزات + `endpoints.js` + بحث `apiClient.(post\|put\|patch)` | عالٍ للمقارنة؛ ليس عقد request/response لكل endpoint |
| أحداث | كل استدعاءات `dispatchAppEvent(` | عالٍ |
| CLI / بدائل | جرد `backend/scripts`؛ بحث cron/webhook/queue | عالٍ للغياب في المستودع |
| Schema | عدّ models/enums؛ فحص `attempt_status` | عالٍ للجرد؛ متوسط للعلاقات القديمة |
| AuthN vs AuthZ vs UI | إعادة قراءة middlewares وPermissionGate | عالٍ |
| Env / تكاملات | أسماء فقط؛ بلا تنفيذ | عالٍ ضمن القيود |
| اختبارات | فهرسة فقط؛ بلا تشغيل | متوسط |

### تصحيحات التغطية (مرتبطة بـ 14)

| Original conclusion | New evidence | Corrected conclusion | Confidence | Affected docs |
|---------------------|--------------|----------------------|------------|---------------|
| مقارنة FE↔BE «Strong inference» عامة | جرد ~294 نمط FE مقابل 330 BE؛ غياب كتابة submissions/grades الأكاديمية من FE | المقارنة **موثّقة مع فجوات Confirmed**؛ ليست مكتملة على مستوى الحقول | Confirmed | `06`, `14`, `04` |
| أرقام المسارات ~166/~153 | 167 path / 186 Route / 15 Navigate | استبدال الأرقام الخام بـ Confirmed؛ الإبقاء على تقدير الصفحات كـ inference | Confirmed / Strong inference | `05`, `16`, `00` |
| عدد API ~330 كـ Strong inference | عدّ 327+3 | **330 Confirmed** | Confirmed | `06`, `16` |
| overdue قد لا يُطلق | استدعاءات عند create/update | يُطلق مع الكتابة إن كان متأخرًا؛ لا cron | Confirmed | `11`, `14` |
| تغطية models كاملة ضمنيًا للعلاقات | `attempt_status` بلا جدول attempts؛ علاقات قديمة ناقصة في Prisma | الجرد العددي كامل؛ العلاقات **ليست** جميعها Confirmed كـ FK ORM | Confirmed | `07`, `14` |
| CLI غير مفهرس بالكامل | قائمة سكربتات seed/cleanup/R2/backfill/HTTP test | أُضيفت كنقاط دخول غير HTTP | Confirmed | `11`, `12`, `14` |
| لا feature flags (inference) | غياب مكتبات + `FEATURE_KEYS` تسويقي | Confirmed absence لنظام flags | Confirmed | `12`, `14` |

### ما يبقى غير مغطى بعد التحقق الثاني

- أجسام كل الـ 330 handler (تحقق أعمال دقيق).
- مطابقة Zod ↔ Prisma ↔ أنواع FE لكل مورد.
- تشغيل الاختبارات والتكاملات الحية.
- استهلاك API من عملاء خارج هذا المستودع.
- DNS/النطاقات الفرعية في الإنتاج.
- محتوى كل ملفات i18n والمكوّنات (~118) سطرًا سطرًا.

### حدود منهجية التحقق الثاني

- البحث الثابت عن استدعاءات API قد يفوّت مسارات مبنية بتجميع سلاسل غير نمطي؛ خُفّف بفحص `endpoints.js` وبحث `apiClient`.
- «بلا مستهلك FE» ≠ unused تشغيليًا.
- لم تُفتح قيم الأسرار؛ لم يُكتب على DB.

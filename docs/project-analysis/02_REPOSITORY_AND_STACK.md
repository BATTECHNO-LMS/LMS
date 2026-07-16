# المستودع والتقنيات

## نوع المستودع

| الخاصية | القيمة | الثقة |
|---------|--------|-------|
| النوع | مستودع تطبيقات متعددة (backend + frontend) في جذر واحد | Confirmed |
| Monorepo بحزم workspace | لا — لا يوجد `workspaces` / pnpm-workspace في الجذر | Confirmed |
| مدير الحزم | npm (وجود `package-lock.json` في كل تطبيق) | Confirmed |
| لغة المصدر | JavaScript (Node CommonJS في الـ backend، ESM في الـ frontend) | Confirmed |

## التطبيقات والحزم

| المسار | الاسم في package.json | الدور |
|--------|----------------------|-------|
| `backend/` | `battechno-lms-api` | REST API |
| `frontend/` | `battechno-lms-web` | SPA |
| `docs/` | — | توثيق بشري |
| `.github/workflows/` | — | CI |

لا توجد حزم داخلية منشورة مشتركة بين الطرفين؛ المشاركة عبر عقد REST فقط.

## اللغات والأطر والإصدارات

### Backend (`backend/package.json`)

| تقنية | إصدار معلن |
|-------|------------|
| Node | `>=18` (CI يستخدم 20) |
| Express | `^4.22.1` |
| Prisma / `@prisma/client` | `^6.0.0` |
| jsonwebtoken | `^9.0.2` |
| zod | `^3.24.1` |
| bcrypt | `^5.1.1` |
| helmet / cors / morgan / multer / express-rate-limit | موجودة |
| Resend, AWS S3 SDK, Google Generative AI, puppeteer, exceljs, … | موجودة |

**نقطة الدخول:** `backend/src/server.js` (`main` في package.json).  
**تطبيق Express:** `backend/src/app.js`.

### Frontend (`frontend/package.json`)

| تقنية | إصدار معلن |
|-------|------------|
| React / react-dom | `^18.3.1` |
| Vite | `^5.4.21` |
| react-router-dom | `^6.28.0` |
| @tanstack/react-query | `^5.62.8` |
| axios | `^1.7.9` |
| i18next / react-i18next | موجودة |
| sass / tailwindcss / framer-motion / recharts / lucide-react | موجودة |

**نقطة الدخول:** `frontend/src/main.jsx` → `App.jsx` → `AppRouter`.

## أدوات البناء والتشغيل

| الطبقة | التطوير | الإنتاج |
|--------|---------|---------|
| Backend | `node --watch src/server.js` | `node src/server.js` |
| Frontend | `vite` | `vite build` + استضافة ثابتة / `vite preview` |
| Prisma | `prisma migrate dev` / `generate` | `prisma migrate deploy` |

## هيكل المجلدات العليا

```
LMS/
├── .github/workflows/ci.yml
├── backend/
│   ├── prisma/          # schema + migrations + seed
│   ├── scripts/         # seeds، cleanup، R2 helpers
│   ├── src/             # التطبيق
│   ├── tests/           # اختبارات node:test
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/             # التطبيق
│   ├── docs/            # توثيق عربي للواجهة
│   ├── public/          # أصول عامة
│   └── package.json
├── docs/                # توثيق المشروع
│   └── project-analysis/ # هذا التحليل
└── README.md
```

### غرض المجلدات المهمة داخل backend/src

| المجلد | الغرض |
|--------|-------|
| `config/` | env، Prisma client |
| `middlewares/` | auth، roles، errors، rate limit، logging |
| `modules/` | وحدات المجال (routes/controller/service/repository/validation) |
| `routes/` | تجميع مسارات `/api/v1` |
| `shared/` | بريد، تخزين، أحداث، قوالب |
| `utils/` | JWT، pagination، scope، logger |

### غرض المجلدات المهمة داخل frontend/src

| المجلد | الغرض |
|--------|-------|
| `app/` | router، providers |
| `pages/` | صفحات البوابات |
| `features/` | خدمات وhooks حسب المجال |
| `components/` | مكونات مشتركة |
| `layouts/` | هياكل البوابات |
| `assets/styles/` | SCSS design tokens |
| `i18n/` | ترجمات ar/en |
| `constants/` | أدوار، تنقل |
| `services/` | apiClient |

## تمييز أنواع الملفات

| النوع | أمثلة |
|-------|-------|
| شفرة مصدر | `backend/src/**`, `frontend/src/**` |
| مولَّد | `backend/node_modules/.prisma/client/**` (بعد generate) |
| بناء | `frontend/dist/**` (عند البناء؛ غير مُتتبَّع عادة) |
| أصول عامة | `frontend/public/**`, `backend/uploads` (تشغيل) |
| اختبارات | `backend/tests/**` |
| إعداد | `.env`, `.env.example`, `vite.config.*`, Prisma |
| سكربتات | `backend/scripts/**` |
| توثيق | `docs/**`, `frontend/docs/**`, `README.md` |
| مؤقت/كاش | `node_modules/**`, `.vite/**` |

**ملاحظة:** حالة git تُظهر `node_modules` غير متتبَّعة — لا تُعامل كمصدر للمنتج.

## ملفات النشر وCI

| الملف | الدور |
|-------|-------|
| `.github/workflows/ci.yml` | اختبار backend + validate Prisma + بناء frontend |
| `backend/Dockerfile` | صورة Node 20 alpine للمنفذ 10000 |
| لا يوجد `docker-compose` | Confirmed غياب |

## سكربتات backend البارزة

| سكربت npm | الغرض |
|-----------|-------|
| `seed:real-baseline` | أدوار + جامعات أردنية + تخصصات |
| `seed:demo` / `seed:analytics-demo` / `seed:auth` | تطوير فقط |
| `seed:test-accounts` | حسابات اختبار محلية |
| `cleanup:demo` | تنظيف بيانات تجريبية |
| `r2:health` / `r2:setup-cors` | فحص/إعداد R2 |

## وثائق موجودة مسبقًا

المستودع يحتوي توثيقًا إنجليزيًا وعربيًا تحت `docs/` و`frontend/docs/` و`backend_documentation.md`. هذا المجلد (`project-analysis`) تحليل عكسي مستقل يستند إلى الكود مع الإشارة للوثائق عند الاتفاق.

## ملخص الجرد

| العنصر | العدد التقريبي |
|--------|----------------|
| نماذج Prisma (`model`) | 60 |
| مجلدات migrations | 26 |
| ملفات اختبار backend | 15 |
| مكونات JSX تحت `components/` | ~118 |
| صفحات JSX تحت `pages/` | ~200 |
| ملفات `*.routes.js` | ~45 |

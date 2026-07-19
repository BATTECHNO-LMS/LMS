# الإعداد والنشر والتشغيل

## متغيرات البيئة — Backend

المصدر: `backend/src/config/env.js` و`backend/.env.example`  
**لا تُعرض قيم فعلية.**

### أساسية

| المتغير | مطلوب؟ | الغرض الظاهر |
|---------|--------|--------------|
| `NODE_ENV` | عمليًا نعم | development/production/test |
| `PORT` | لا (افتراضي 4000) | منفذ الاستماع |
| `API_VERSION` | لا (v1) | بادئة API |
| `DATABASE_URL` | نعم للتشغيل | اتصال PostgreSQL |
| `JWT_SECRET` | نعم | توقيع JWT (حد أدنى في الإنتاج) |
| `JWT_EXPIRES_IN` | لا | عمر التوكن |
| `CORS_ORIGINS` | نعم في الإنتاج | أصول المتصفح المسموحة |
| `PUBLIC_BASE_URL` | مستحسن | روابط ملفات مطلقة |
| `TRUST_PROXY` | مستحسن خلف proxy | — |

### تخزين

| المتغير | الغرض |
|---------|--------|
| `STORAGE_BACKEND` | `local` \| `r2` \| `s3` |
| `UPLOAD_DIR` | مجلد محلي |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_REGION`, `R2_PUBLIC_BASE_URL` | Cloudflare R2 |
| `S3_PUBLIC_BASE_URL` | أصل عام عند S3 |

### بريد وOTP

| المتغير | الغرض |
|---------|--------|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | إرسال بريد |
| `EMAIL_OTP_*` | انتهاء/إعادة/محاولات تحقق البريد |
| `PASSWORD_RESET_OTP_*`, `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` | إعادة كلمة المرور |

### AI وحدود المعدل

| المتغير | الغرض |
|---------|--------|
| `AI_PROVIDER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AI_MODEL` | تفعيل المزود |
| `AI_RATE_LIMIT_*`, `FIELD_TRAINING_AI_RATE_LIMIT_*` | حدود AI |
| `FILE_UPLOAD_RATE_LIMIT_*`, `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX` | حدود عامة/رفع/auth |

### أدوار (CSV)

جميع `*_ROLE_CODES` و`STUDENT_ROLE_CODE` و`SUPER_ADMIN_ROLE_CODE` — انظر `env.js`.

### أخرى

| المتغير | الغرض |
|---------|--------|
| `YOUTUBE_API_KEY` | قوائم تشغيل غير عامة |

**أسرار محتملة في ملفات محلية:** `backend/.env`, `frontend/.env` — نوعها أسرار اتصال/مفاتيح؛ خطر التسريب إن أُدخلت git. **لا تُنسخ هنا.**

## متغيرات البيئة — Frontend

من README:

| المتغير | الغرض |
|---------|--------|
| `VITE_API_BASE_URL` | أصل API |
| `VITE_APP_ORIGINS` | أصول التطبيق (مذكور في README) |

Vite يوجّه `/api` للخلفية في التطوير (README).

## Feature flags

لا نظام feature-flag مستقل مكتشَف (مكتبات أو خدمة flags) — **Confirmed absence** في التحقق الثاني. التفعيل عبر env (AI/storage) وصلاحيات الأدوار.  
`FEATURE_KEYS` في `components/landing/home.constants.js` = مفاتيح عرض لقسم ميزات اللاندنج فقط، وليست أعلام تشغيل للمنتج.

## إعداد التطوير

1. PostgreSQL + `backend/.env`
2. `npm install` في backend (يُشغّل `prisma generate`)
3. migrations + `seed:real-baseline`
4. `npm run dev` → :4000
5. frontend `.env` + `npm run dev` → :5173

## البناء والإنتاج

| الطبقة | الأمر |
|--------|-------|
| Frontend build | `npm run build` → أصول ثابتة |
| Backend start | `npm start` → `node src/server.js` |
| Migrations prod | `npm run prisma:deploy` |

## Docker

- ملف: `backend/Dockerfile` — `node:20-alpine`, يعرّض **10000**
- لا `docker-compose`
- لا Dockerfile للواجهة في المستودع

## CI/CD

`.github/workflows/ci.yml`:

- Backend: `npm ci` → `npm test` → `prisma validate`
- Frontend: `npm ci` → `npm run build`
- الفروع: main/master/develop

لا خطوة نشر تلقائي ظاهرة في هذا الملف — Unknown لخط أنابيب النشر الكامل.

## الاستضافة (مؤشرات)

| المؤشر | المصدر |
|--------|--------|
| `lms.battechno.com` في CORS | `app.js` |
| وثيقة Deployment تذكر Render / Neon | `docs/DEPLOYMENT.md` |
| التحقق التشغيلي الفعلي | Unknown بدون بنية تحتية حية |

## Health checks

| المسار | المعنى |
|--------|--------|
| `GET /` | معلومات خدمة |
| `GET /health` | liveness |
| `GET /health/ready` | readiness + `SELECT 1` |

## النسخ الاحتياطي / التراجع

غير مُعرَّف في الكود؛ يعتمد على مزود PostgreSQL — Unknown تشغيليًا.

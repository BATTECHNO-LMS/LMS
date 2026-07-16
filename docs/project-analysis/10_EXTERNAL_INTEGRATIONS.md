# التكاملات الخارجية

**قاعدة:** لم تُنفَّذ أي استدعاءات حقيقية لخدمات خارجية أثناء التحليل. تُذكر أسماء متغيرات البيئة دون قيم.

## جدول التكاملات

| المزود | الغرض | الاتجاه | ملفات رئيسية | متغيرات إعداد (أسماء فقط) | الثقة |
|--------|-------|---------|--------------|---------------------------|-------|
| **Resend** | بريد OTP (تحقق/إعادة كلمة مرور) | صادر | `shared/services/email.service.js`, قوالب OTP | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Confirmed |
| **Google Gemini** | توليد/تقييم AI | صادر | `modules/ai/ai.service.js`, FT AI | `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `AI_MODEL` | Confirmed |
| **OpenAI** | بديل AI عند الإعداد | صادر | `ai.service.js` | `AI_PROVIDER=openai`, `OPENAI_API_KEY` | Confirmed |
| **Cloudflare R2** | تخزين كائنات (S3-compatible) | صادر/وارد روابط | files + storage shared؛ سكربتات `r2:*` | `STORAGE_BACKEND`, `R2_*` | Confirmed |
| **AWS S3 SDK** | عميل للـ R2/S3 | صادر | اعتمادية `@aws-sdk/client-s3` | أيضًا `S3_PUBLIC_BASE_URL` عند s3 | Confirmed |
| **تخزين محلي** | `UPLOAD_DIR` + `/uploads` | محلي | `app.js` static | `STORAGE_BACKEND=local`, `UPLOAD_DIR` | Confirmed |
| **YouTube** | RSS / Data API / oEmbed لمعاينة قوائم التشغيل | وارد | `youtubePlaylist.service.js`, `youtube.utils.js` | `YOUTUBE_API_KEY` (اختياري للقوائم غير العامة) | Confirmed |
| **Puppeteer** | تصيير PDF للتحليلات | محلي/صادر HTML→PDF | `analytics/pdfRenderer.js` | لا مفتاح خارجي؛ يعتمد Chromium | Confirmed |
| **ExcelJS** | تصدير Excel | توليد ملفات | users/analytics/FT report excel | — | Confirmed |
| **pdf-parse / mammoth** | استخراج نص من مرفقات FT | محلي على الملفات | `fieldTraining.contentExtract.js` | — | Confirmed |
| **PostgreSQL / Neon** | قاعدة البيانات | بيانات | Prisma `DATABASE_URL` | `DATABASE_URL` | Confirmed |
| **GitHub Actions** | CI | بناء/اختبار | `.github/workflows/ci.yml` | — | Confirmed |

## غير المكتشف (أو غائب في الكود)

| النوع | الحالة |
|-------|--------|
| بوابات دفع / اشتراكات | غير موجودة |
| SMS / Push (FCM وغيرها) | غير موجودة |
| Sentry / Datadog / Analytics تجاري | غير مكتشفة |
| OAuth اجتماعي (Google/Microsoft login) | غير موجود |
| Webhooks واردة | غير موجودة |
| CDN مخصص بخلاف R2_PUBLIC_BASE_URL | اختياري عبر إعداد |

## تفاصيل مختارة

### البريد (Resend)

- **متى:** إصدار/إعادة OTP للبريد وإعادة كلمة المرور.
- **فشل بدون مفتاح:** السلوك يعتمد على الخدمة (قد يفشل الإرسال أو يُسجَّل) — يحتاج تحقق تشغيل؛ لا تُستنتج رسالة المستخدم النهائية هنا كـ Confirmed بالكامل.
- **المخاطر:** مفتاح API في `.env` — لا يُنسخ في التوثيق.

### الذكاء الاصطناعي

- يُعطَّل إذا `AI_PROVIDER` فارغ.
- حدود معدل: `AI_RATE_LIMIT_*` و`FIELD_TRAINING_AI_RATE_LIMIT_*`.
- استخدامات: `/api/v1/ai/generate`؛ تقييم ذاتي لمهام FT؛ تصحيح محتمل لتدريب الدروس.
- **بيانات مرسلة:** نصوص مطالبات/إجابات طلاب — حساسية عالية (رصد مخاطر في وثيقة 14).

### التخزين

- `presign-upload` يتطلب غالبًا R2؛ المحلي عبر مسارات رفع أخرى/static.
- سكربت `r2:setup-cors` لإعداد CORS للرفع من المتصفح.

### YouTube

- بدون مفتاح: مسار RSS/oEmbed للعام.
- مع `YOUTUBE_API_KEY`: playlistItems للقوائم التي لا يكفي فيها RSS.

## سلوك إعادة المحاولة / المهلات

غير موحّد عبر مكتبة retry ظاهرة؛ كل تكامل يتعامل محليًا — **Unknown** لسياسة retry عامة.

## Sandbox مقابل إنتاج

لا مفاتيح sandbox مضمّنة في المستودع؛ التمييز عبر قيم `.env` للبيئة — لا تُوثَّق القيم.

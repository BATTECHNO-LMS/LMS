# الاختبارات والمراقبة والجودة

## أطر الاختبار

| الطبقة | الإطار | الأمر |
|--------|--------|-------|
| Backend | Node.js مدمج `node --test` + supertest | `npm test` في backend |
| Frontend | لا ملفات اختبار وحدة/E2E مكتشفة تحت frontend | — |

**الثقة:** Confirmed لوجود `backend/tests/*.test.js` وغياب اختبارات frontend ظاهرة.

## اختبارات Backend المكتشفة (15 ملفًا)

| الملف | المجال الظاهر |
|-------|----------------|
| `health.test.js` | صحة الخدمة |
| `emailOtp.test.js` | منطق OTP |
| `passwordResetToken.test.js` | رمز إعادة التعيين |
| `universityEmailLink.test.js` | ربط نطاق البريد |
| `universityScope.test.js` | نطاق الجامعة |
| `specialties.service.test.js` | تخصصات |
| `landingStats.test.js` | إحصاءات عامة |
| `submissions.auth.test.js` | تفويض التسليمات |
| `youtubePlaylist.test.js` | YouTube playlist |
| `analytics.trends.test.js` | تحليلات |
| `fieldTraining.auth.test.js` | تفويض FT |
| `fieldTraining.access.test.js` | وصول FT |
| `fieldTraining.workflow.test.js` | سير عمل FT |
| `fieldTraining.integration.test.js` | تكامل FT (+ helper) |
| `helpers/fieldTrainingIntegration.js` | مساعدة اختبار |

## ربط الاختبارات بالميزات

| ميزة حرجة | تغطية اختبار؟ |
|-----------|----------------|
| Health | نعم |
| OTP / password reset token | نعم (وحدات) |
| University scope / email link | نعم |
| Field training | نعم (عدة ملفات) |
| Submissions auth | نعم جزئي |
| Analytics trends | نعم جزئي |
| تسجيل كامل E2E + تفعيل | غير واضح كـ E2E كامل |
| Recognition / certificates إصدار | غير ظاهر كملفات مخصصة |
| Courses / lesson training | غير ظاهر |
| Frontend flows | لا |
| صلاحيات كل دور × كل endpoint | لا (جزئي فقط) |

## مخاطر تشغيل الاختبارات

- بعض اختبارات التكامل قد تحتاج DB — **لم تُشغَّل** في هذه المرحلة لتجنب الكتابة على بيئات غير معروفة.
- اختبارات YouTube قد تضرب شبكة خارجية حسب التنفيذ — لم تُشغَّل.

## الجودة الثابتة

| الأداة | Backend | Frontend |
|--------|---------|----------|
| ESLint/Prettier | غير مؤكد كإعداد إلزامي في package scripts | غير ظاهر في scripts |
| TypeScript | لا (JS) | لا (JSX) |
| Prisma validate | في CI | — |
| Build كبوابة | — | `vite build` في CI |
| Pre-commit hooks | غير مكتشفة في الجذر | Unknown |

## المراقبة والقابلية للرصد

| القدرة | المرصود |
|--------|---------|
| Request ID | `requestId.middleware.js` |
| Request logging | `requestLogger.middleware.js` (معطّل في `NODE_ENV=test`) |
| Logger مساعد | `utils/logger.js` |
| Error middleware | موحّد نسبيًا |
| Error tracking SaaS | غير مكتشف |
| Metrics/Tracing | غير مكتشف |
| Audit trail أعمال | `audit_logs` |
| Frontend ErrorBoundary | نعم |
| Console logging | محتمل في التطوير — غير مفهرس بالكامل |

## تدفق الخطأ النموذجي

```
Prisma/Integration error
  → service throws ApiError / Error
  → error.middleware → JSON للعميل
  → Axios reject → hook/UI رسالة
  → (اختياري) ErrorBoundary لأخطاء التصيير
```

## فجوات جودة بارزة

1. لا اختبارات واجهة آلية.
2. سطح API (~330) أكبر بكثير من عدد ملفات الاختبار.
3. لا بوابة تغطية coverage ظاهرة في CI.
4. اعتماد Puppeteer/AI/R2 يجعل مسارات التصدير/الرفع حساسة للبيئة.

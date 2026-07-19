# العمليات الخلفية والأحداث

## الخلاصة

| النوع | الحالة في المستودع | الثقة |
|-------|-------------------|-------|
| Cron / جداول زمنية | غير موجودة في `src/` | Confirmed absence |
| طوابير (Bull/Rabbit/SQS) | غير موجودة | Confirmed absence |
| Workers منفصلة | غير موجودة | Confirmed absence |
| أحداث داخل العملية | `dispatchAppEvent` | Confirmed |
| إشعارات متزامنة مع الطلب | نعم | Confirmed |

## موزّع الأحداث

**الملف:** `backend/src/shared/services/eventDispatcher.service.js`  
**الدالة:** `dispatchAppEvent(type, payload)`

### أنواع الأحداث المعالجة

| type | الآثار الجانبية الرئيسية |
|------|--------------------------|
| `recognition_request_status_changed` | audit + إشعار لمنشئ الطلب |
| `certificate_issued` | audit + إشعار الطالب |
| `certificate_status_changed` | audit + إشعار الطالب |
| `attendance_below_threshold` | إشعارات للمدرب + أدوار إدارية في الجامعة |
| `corrective_action_overdue` | إشعارات للمكلَّف + qa_officer |
| `integrity_case_reported` | audit + إشعارات oversight |
| `qa_review_opened` | إشعارات مراجع/مدرب/QA |
| `assessment_overdue` | إشعارات مدرب + academic_admin |
| `assessment_ungraded_before_closure` | إشعارات مدرب + academic/qa |
| `cohort_status_changed` | لا معالجة (fallthrough) |

**ملاحظة (مُصحَّحة في التحقق الثاني):** أحداث `corrective_action_overdue` و`assessment_overdue` و`assessment_ungraded_before_closure` و`attendance_below_threshold` **تُستدعى فعليًا** من الخدمات/المتحكّمات عند عمليات الكتابة إذا اكتُشف التأخر وقت الحفظ — وليست معالجات ميتة. **لا يوجد** مسح دوري (cron) لكل السجلات المتأخرة؛ إن لم يُمس السجل بعد انقضاء الموعد فقد لا يُرسل إشعار. `cohort_status_changed` مسجّل في الـ switch و**لا** يوجد أي `dispatchAppEvent('cohort_status_changed'` في المستودع.
## إشعارات داخل التطبيق

- الجدول: `notifications`
- الخدمة: `shared/services/notification.service.js`
- دعم خصم تكرار عبر `dedupeWindowHours` في الاستدعاءات أعلاه
- واجهة: قائمة + تعليم كمقروء عبر `/api/v1/notifications`

## سجلات التدقيق

- `audit.service` يكتب إلى `audit_logs` (append-oriented حسب تعليق schema)
- لا POST عام لإنشاء سجلات من العميل — Confirmed تعليق في schema

## معالجة ملفات ثقيلة (متزامنة مع الطلب)

| العملية | السياق |
|---------|--------|
| Puppeteer PDF | تصدير تحليلات عند الطلب |
| ExcelJS | تصدير عند الطلب |
| pdf-parse / mammoth | استخراج نص مهام FT عند المعالجة |
| AI calls | عند طلب المستخدم (مع rate limit) |

هذه **ليست** وظائف خلفية منفصلة؛ تعمل ضمن دورة طلب HTTP وقد تطيل زمن الاستجابة.

## ما الذي يجب تأكيده من مالك المنتج؟

1. هل توجد وظائف مجدولة خارج المستودع (cron على الخادم/Render) لأحداث overdue؟
2. هل الاعتماد الحالي على الإشعارات المتزامنة كافٍ تشغيليًا؟

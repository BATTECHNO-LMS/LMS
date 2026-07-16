# مسرد المشروع

المصطلحات التقنية تبقى كما في المستودع. الشروحات بالعربية.

| المصطلح / المعرّف | المعنى في هذا المشروع |
|-------------------|------------------------|
| **BATTECHNO LMS** | اسم المنتج؛ منصة إدارة تعلّم للشهادات المصغّرة |
| **micro_credential / Micro-credential** | شهادة/برنامج مصغّر تحت مسار (`tracks`) |
| **track** | مسار أكاديمي يجمع شهادات مصغّرة |
| **cohort** | فوج تشغيل زمني لشهادة مصغّرة في جامعة معيّنة |
| **enrollment** | تسجيل طالب في فوج؛ له `enrollment_status` و`final_status` |
| **learning_outcome** | ناتج تعلم مرتبط بالشهادة المصغّرة |
| **module / content** | وحدة محتوى داخل الشهادة؛ عناصر محتوى متسلسلة |
| **session** | جلسة صفّية/مخبرية ضمن فوج |
| **attendance_record** | سجل حضور طالب لجلسة |
| **assessment** | تقييم أكاديمي (quiz/assignment/…) ضمن فوج |
| **submission** | تسليم طالب لتقييم |
| **grade** | درجة مرصودة لتقييم |
| **rubric / rubric_criteria** | نموذج تقييم ومعاييره |
| **evidence_file** | ملف دليل للجودة/الاعتراف |
| **qa_review** | مراجعة ضمان جودة على فوج |
| **corrective_action** | إجراء تصحيحي مرتبط بمراجعة QA |
| **risk_case** | حالة طالب معرّض للخطر أكاديميًا |
| **integrity_case** | حالة نزاهة أكاديمية (غش/انتحال/…) |
| **recognition_request** | طلب اعتراف جامعي بنتائج/برنامج |
| **recognition_document** | مستند داعم لطلب الاعتراف |
| **certificate** | شهادة صادرة برقم ورمز تحقق |
| **verification_code** | رمز عام للتحقق من الشهادة |
| **course** | مقرر LMS مستقل (قد يُربط بأفواج عبر `course_cohorts`) |
| **lesson training / course_lesson_training** | إعداد تدريب لدرس (مهمة، إجابة نموذجية، أوزان، مطالبة AI) |
| **field training / FT** | وحدة التدريب الميداني المستقلة عن المقررات/الأفواج |
| **field_training_opportunity** | فرصة تدريب معلنة |
| **eligibility** | أهلية الظهور/الإتمام حسب السياق (فرصة أو إتمام تدريب) |
| **field_training_application** | طلب/سجل مشاركة طالب في فرصة |
| **training_status** | دورة حياة المشارك بعد الموافقة |
| **pre/post assessment** | تقييم قبلي/بعدي للتدريب الميداني |
| **completion letter** | خطاب إتمام تدريب ميداني |
| **university_email_domain** | نطاق بريد مسموح لربط الطالب بجامعة |
| **specialty / university_specialty** | تخصص عام / برنامج جامعي خاص |
| **super_admin** | دور عام كامل (`isGlobal`) |
| **program_admin** | إدارة برنامج؛ عابر جامعات عمليًا في النطاق |
| **university_admin** | إدارة على مستوى الجامعة |
| **academic_admin** | أدوار أكاديمية/مناهج/تقارير |
| **qa_officer** | مسؤول ضمان جودة |
| **instructor** | مدرّس/مدرب |
| **student** | طالب |
| **university_reviewer** | مراجع جامعي للتسجيل/الاعتراف |
| **ADMIN_ROLE_SET** | مجموعة أدوار تستخدم قشرة `/admin` |
| **isGlobal** | مطالبة JWT تتجاوز فحوص الأدوار |
| **university scope** | تقييد البيانات بجامعة المستخدم غير النظامي |
| **OTP** | رمز لمرة واحدة للبريد أو إعادة كلمة المرور |
| **activation** | تحويل حساب من inactive إلى active بعد التحقق |
| **RBAC** | تحكم بالوصول مبني على الأدوار (وربما صلاحيات مستقبلًا) |
| **permissionCodes** | أكواد من جدول permissions تُعاد مع المستخدم |
| **UI permission** | مفتاح ظهور في الواجهة (`rolePermissions.js`) |
| **portal / subdomain portal** | فصل دخول admin/instructor/student/reviewer |
| **audit_log** | سجل تدقيق لأحداث حساسة |
| **notification** | إشعار داخل التطبيق |
| **presign upload** | رفع مباشر للتخزين عبر رابط موقَّع |
| **R2** | تخزين Cloudflare المتوافق مع S3 |
| **Resend** | مزود البريد المعتمد في الكود |
| **landing-stats** | إحصاءات عامة للصفحة الرئيسية |
| **ModulePlaceholderPage** | صفحة بديلة لمسار داخل بوابة غير مُنفَّذ بالكامل |

## اختصارات شائعة في المسارات

| اختصار | المعنى |
|--------|--------|
| MC | micro-credential |
| FT | field training |
| QA | quality assurance |
| BE / FE | backend / frontend |

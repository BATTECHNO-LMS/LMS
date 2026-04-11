/** بيانات الجداول والبطاقات للواجهات الإدارية والتعليمية */

export const ADMIN_RECENT_ACTIVITY = [
  { id: 'act1', when: '2026-04-08 09:12', what: 'تحديث حالة دفعة «ربيع 2026»', actor: 'د. خالد المنسق', tenantId: 'uni-1' },
  { id: 'act2', when: '2026-04-08 08:40', what: 'اعتماد تقرير حضور أسبوعي', actor: 'م. لينا الصباغ', tenantId: 'uni-1' },
  { id: 'act3', when: '2026-04-07 16:05', what: 'تسليم واجب تحليل — دفعة أردنية', actor: 'محمد علي', tenantId: 'uni-2' },
  { id: 'act4', when: '2026-04-07 14:22', what: 'رفع دليل جودة للمراجعة', actor: 'هند أبو زيد', tenantId: 'uni-2' },
  { id: 'act5', when: '2026-04-07 11:30', what: 'نشر تقييم منتصف الفصل', actor: 'د. سامي النجار', tenantId: 'uni-3' },
  { id: 'act6', when: '2026-04-06 17:50', what: 'طلب اعتراف أكاديمي — قيد المراجعة', actor: 'إدارة الاعتماد', tenantId: 'uni-1' },
  { id: 'act7', when: '2026-04-06 13:15', what: 'تعديل صلاحيات مستخدم', actor: 'مسؤول النظام', tenantId: 'uni-1' },
  { id: 'act8', when: '2026-04-05 10:00', what: 'إصدار شهادات الدفعة السابقة', actor: 'وحدة الشهادات', tenantId: 'uni-3' },
  { id: 'act9', when: '2026-04-05 09:05', what: 'اجتماع متابعة جودة — كلية الحوسبة', actor: 'د. رنا العمري', tenantId: 'uni-2' },
  { id: 'act10', when: '2026-04-04 15:40', what: 'أرشفة مرفقات التقييم النهائي', actor: 'نظام الأرشفة', tenantId: 'uni-1' },
];

export const ADMIN_SESSIONS = [
  { id: 's1', title: 'مقدمة المساق — أسبوع 1', cohort: 'دفعة ربيع 2026 — يرموك', start: '2026-04-09 10:00', mode: 'حضوري', status: 'مجدولة', actions: '•••', tenantId: 'uni-1' },
  { id: 's2', title: 'معمل تحليل البيانات', cohort: 'دفعة ربيع 2026 — يرموك', start: '2026-04-10 14:00', mode: 'عن بُعد', status: 'مجدولة', actions: '•••', tenantId: 'uni-1' },
  { id: 's3', title: 'مراجعة منتصف الفصل', cohort: 'دفعة خريف 2025 — أردنية', start: '2026-04-08 11:00', mode: 'حضوري', status: 'مكتملة', actions: '•••', tenantId: 'uni-2' },
  { id: 's4', title: 'ورشة أمن المعلومات', cohort: 'دفعة خريف 2025 — أردنية', start: '2026-04-11 09:30', mode: 'مختلط', status: 'مجدولة', actions: '•••', tenantId: 'uni-2' },
  { id: 's5', title: 'عرض مشاريع نهائي', cohort: 'دفعة ربيع 2026 — سمية', start: '2026-04-12 12:00', mode: 'حضوري', status: 'مسودة', actions: '•••', tenantId: 'uni-3' },
  { id: 's6', title: 'جلسة استشارية أسبوعية', cohort: 'دفعة ربيع 2026 — يرموك', start: '2026-04-07 08:00', mode: 'عن بُعد', status: 'مكتملة', actions: '•••', tenantId: 'uni-1' },
  { id: 's7', title: 'تدريب أدوات التعلم', cohort: 'دفعة صيف 2026 — يرموك', start: '2026-04-14 13:00', mode: 'عن بُعد', status: 'مجدولة', actions: '•••', tenantId: 'uni-1' },
  { id: 's8', title: 'محاضرة ضيف — صناعة الذكاء الاصطناعي', cohort: 'دفعة ربيع 2026 — سمية', start: '2026-04-16 10:30', mode: 'حضوري', status: 'مجدولة', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_RUBRICS = [
  { id: 'rb1', name: 'سلم التقييم — تحليل البيانات', levels: 4, linked: 6, updated: '2026-04-01', actions: '•••', tenantId: 'uni-1' },
  { id: 'rb2', name: 'معيار المشاريع التطبيقية', levels: 5, linked: 4, updated: '2026-03-28', actions: '•••', tenantId: 'uni-1' },
  { id: 'rb3', name: 'تقييم التقارير المختبرية', levels: 4, linked: 3, updated: '2026-03-20', actions: '•••', tenantId: 'uni-2' },
  { id: 'rb4', name: 'سلم العرض الشفهي', levels: 3, linked: 2, updated: '2026-04-05', actions: '•••', tenantId: 'uni-2' },
  { id: 'rb5', name: 'معيار الأخلاقيات المهنية', levels: 4, linked: 5, updated: '2026-03-15', actions: '•••', tenantId: 'uni-3' },
  { id: 'rb6', name: 'تقييم الواجبات القصيرة', levels: 3, linked: 8, updated: '2026-04-07', actions: '•••', tenantId: 'uni-1' },
];

export const ADMIN_SUBMISSIONS = [
  { id: 'sub1', learner: 'محمد علي', task: 'واجب التحليل', submitted: '2026-04-08 14:20', status: 'بانتظار التصحيح', actions: '•••', tenantId: 'uni-1' },
  { id: 'sub2', learner: 'سارة أحمد', task: 'معمل البيانات', submitted: '2026-04-07 11:02', status: 'مُصحَّح', actions: '•••', tenantId: 'uni-1' },
  { id: 'sub3', learner: 'خالد سعيد', task: 'اختبار الوحدة الثانية', submitted: '2026-04-08 09:45', status: 'بانتظار التصحيح', actions: '•••', tenantId: 'uni-1' },
  { id: 'sub4', learner: 'نورا حسن', task: 'تقرير نصف الشهر', submitted: '2026-04-06 16:30', status: 'متأخر', actions: '•••', tenantId: 'uni-2' },
  { id: 'sub5', learner: 'أحمد الكردي', task: 'مشروع الفريق', submitted: '2026-04-05 13:00', status: 'مُصحَّح', actions: '•••', tenantId: 'uni-2' },
  { id: 'sub6', learner: 'ليان مصطفى', task: 'واجب أمن المعلومات', submitted: '2026-04-08 08:15', status: 'بانتظار التصحيح', actions: '•••', tenantId: 'uni-2' },
  { id: 'sub7', learner: 'عمر يوسف', task: 'عرض تقديمي نهائي', submitted: '2026-04-04 10:00', status: 'مُصحَّح', actions: '•••', tenantId: 'uni-3' },
  { id: 'sub8', learner: 'رغد الطراونة', task: 'تحليل حالة عمل', submitted: '2026-04-07 12:40', status: 'بانتظار التصحيح', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_GRADES = [
  { id: 'g1', learner: 'محمد علي', cohort: 'دفعة ربيع 2026 — يرموك', score: '86', grade: 'B+', updated: '2026-04-07', actions: '•••', tenantId: 'uni-1' },
  { id: 'g2', learner: 'سارة أحمد', cohort: 'دفعة ربيع 2026 — يرموك', score: '92', grade: 'A', updated: '2026-04-07', actions: '•••', tenantId: 'uni-1' },
  { id: 'g3', learner: 'خالد سعيد', cohort: 'دفعة ربيع 2026 — يرموك', score: '78', grade: 'C+', updated: '2026-04-06', actions: '•••', tenantId: 'uni-1' },
  { id: 'g4', learner: 'نورا حسن', cohort: 'دفعة خريف 2025 — أردنية', score: '81', grade: 'B', updated: '2026-04-05', actions: '•••', tenantId: 'uni-2' },
  { id: 'g5', learner: 'أحمد الكردي', cohort: 'دفعة خريف 2025 — أردنية', score: '74', grade: 'C', updated: '2026-04-05', actions: '•••', tenantId: 'uni-2' },
  { id: 'g6', learner: 'عمر يوسف', cohort: 'دفعة ربيع 2026 — سمية', score: '88', grade: 'B+', updated: '2026-04-08', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_ATTENDANCE_LOG = [
  { id: 'at1', learner: 'محمد علي', session: 'معمل تحليل البيانات', status: 'حاضر', time: '2026-04-08 14:05', actions: '•••', tenantId: 'uni-1' },
  { id: 'at2', learner: 'سارة أحمد', session: 'مقدمة المساق', status: 'حاضر', time: '2026-04-09 10:02', actions: '•••', tenantId: 'uni-1' },
  { id: 'at3', learner: 'خالد سعيد', session: 'مراجعة منتصف الفصل', status: 'غائب', time: '—', actions: '•••', tenantId: 'uni-1' },
  { id: 'at4', learner: 'نورا حسن', session: 'ورشة أمن المعلومات', status: 'حاضر', time: '2026-04-11 09:35', actions: '•••', tenantId: 'uni-2' },
  { id: 'at5', learner: 'أحمد الكردي', session: 'ورشة أمن المعلومات', status: 'متأخر', time: '2026-04-11 09:50', actions: '•••', tenantId: 'uni-2' },
  { id: 'at6', learner: 'ليان مصطفى', session: 'عرض مشاريع نهائي', status: 'حاضر', time: '2026-04-12 12:10', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_CERTIFICATES = [
  { id: 'cert1', code: 'BAT-2026-AI-10432', learner: 'سارة أحمد', credential: 'أساسيات الذكاء الاصطناعي', issued: '2026-03-28', status: 'صادرة', actions: '•••', tenantId: 'uni-1' },
  { id: 'cert2', code: 'BAT-2026-SEC-8821', learner: 'نورا حسن', credential: 'أمن المعلومات', issued: '2026-02-14', status: 'صادرة', actions: '•••', tenantId: 'uni-2' },
  { id: 'cert3', code: 'BAT-2026-BA-5510', learner: 'عمر يوسف', credential: 'تحليل الأعمال', issued: '2026-04-02', status: 'صادرة', actions: '•••', tenantId: 'uni-3' },
  { id: 'cert4', code: 'BAT-2025-AI-9912', learner: 'خالد سعيد', credential: 'أساسيات الذكاء الاصطناعي', issued: '2025-12-10', status: 'صادرة', actions: '•••', tenantId: 'uni-1' },
  { id: 'cert5', code: 'BAT-2026-SEC-7733', learner: 'أحمد الكردي', credential: 'أمن المعلومات', issued: '2026-01-20', status: 'ملغاة', actions: '•••', tenantId: 'uni-2' },
];

export const ADMIN_AUDIT_LOGS = [
  { id: 'au1', time: '2026-04-08 09:00:22', actor: 'admin@lms.local', action: 'تسجيل دخول', resource: 'لوحة الإدارة', ip: '192.168.1.10', tenantId: 'uni-1' },
  { id: 'au2', time: '2026-04-08 08:55:01', actor: 'sarah@yu.edu.jo', action: 'تعديل درجة', resource: 'تقييم #a1', ip: '10.0.4.12', tenantId: 'uni-1' },
  { id: 'au3', time: '2026-04-07 22:10:44', actor: 'system', action: 'نسخ احتياطي مجدول', resource: 'قاعدة البيانات', ip: '—', tenantId: 'uni-1' },
  { id: 'au4', time: '2026-04-07 16:33:18', actor: 'laila@uj.edu.jo', action: 'تصدير تقرير', resource: 'تقارير الحضور', ip: '172.16.0.5', tenantId: 'uni-2' },
  { id: 'au5', time: '2026-04-07 11:20:00', actor: 'omar@psut.edu.jo', action: 'رفع مرفق', resource: 'دليل جودة', ip: '10.2.8.9', tenantId: 'uni-3' },
  { id: 'au6', time: '2026-04-06 14:05:33', actor: 'admin@lms.local', action: 'تغيير صلاحية', resource: 'مستخدم #u3', ip: '192.168.1.10', tenantId: 'uni-1' },
];

export const ADMIN_CONTENT = [
  { id: 'co1', title: 'مدخل إلى التعلم التعاوني', type: 'مرئي', cohort: 'دفعة ربيع 2026 — يرموك', status: 'منشور', updated: '2026-04-01', actions: '•••', tenantId: 'uni-1' },
  { id: 'co2', title: 'دليل معمل Python', type: 'وثيقة', cohort: 'دفعة ربيع 2026 — يرموك', status: 'منشور', updated: '2026-03-28', actions: '•••', tenantId: 'uni-1' },
  { id: 'co3', title: 'قراءة أسبوعية — أمن الشبكات', type: 'وثيقة', cohort: 'دفعة خريف 2025 — أردنية', status: 'مسودة', updated: '2026-04-06', actions: '•••', tenantId: 'uni-2' },
  { id: 'co4', title: 'محاضرة مسجّلة — تحليل SWOT', type: 'مرئي', cohort: 'دفعة ربيع 2026 — سمية', status: 'منشور', updated: '2026-03-30', actions: '•••', tenantId: 'uni-3' },
  { id: 'co5', title: 'روابط أدوات التصور', type: 'رابط', cohort: 'دفعة ربيع 2026 — يرموك', status: 'منشور', updated: '2026-04-07', actions: '•••', tenantId: 'uni-1' },
];

export const ADMIN_LEARNING_OUTCOMES = [
  { id: 'lo1', code: 'LO-AI-01', title: 'فهم مفاهيم التعلم الآلي الخاضع للإشراف', credential: 'أساسيات الذكاء الاصطناعي', status: 'معتمد', actions: '•••', tenantId: 'uni-1' },
  { id: 'lo2', code: 'LO-AI-02', title: 'تطبيق خط أنابيب بيانات بسيط', credential: 'أساسيات الذكاء الاصطناعي', status: 'معتمد', actions: '•••', tenantId: 'uni-1' },
  { id: 'lo3', code: 'LO-SEC-01', title: 'تحليل تهديدات الطبقة التطبيقية', credential: 'أمن المعلومات', status: 'مسودة', actions: '•••', tenantId: 'uni-2' },
  { id: 'lo4', code: 'LO-BA-01', title: 'صياغة فرضيات الأعمال من البيانات', credential: 'تحليل الأعمال', status: 'معتمد', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_QA_INDICATORS = [
  { id: 'qi1', name: 'معدل رضا المتعلمين', owner: 'إدارة الجودة', status: 'ضمن الهدف', due: '2026-04-30', actions: '•••', tenantId: 'uni-1' },
  { id: 'qi2', name: 'اكتمال التوثيق', owner: 'البرامج الأكاديمية', status: 'يحتاج متابعة', due: '2026-05-15', actions: '•••', tenantId: 'uni-1' },
  { id: 'qi3', name: 'معدل إنجاز التصحيح', owner: 'شؤون التدريس', status: 'ضمن الهدف', due: '2026-04-20', actions: '•••', tenantId: 'uni-2' },
  { id: 'qi4', name: 'تغطية معايير الاعتماد', owner: 'الاعتماد الأكاديمي', status: 'قيد المراجعة', due: '2026-06-01', actions: '•••', tenantId: 'uni-3' },
  { id: 'qi5', name: 'زمن الاستجابة للاستفسارات', owner: 'الدعم الأكاديمي', status: 'ضمن الهدف', due: '2026-04-22', actions: '•••', tenantId: 'uni-1' },
  { id: 'qi6', name: 'معدل إكمال الوحدات', owner: 'إدارة البرامج', status: 'يحتاج متابعة', due: '2026-05-08', actions: '•••', tenantId: 'uni-4' },
  { id: 'qi7', name: 'جودة تقييمات الأقران', owner: 'لجنة التقييم', status: 'ضمن الهدف', due: '2026-04-28', actions: '•••', tenantId: 'uni-5' },
  { id: 'qi8', name: 'تغطية مؤشرات التعلّم', owner: 'الاعتماد الأكاديمي', status: 'قيد المراجعة', due: '2026-05-20', actions: '•••', tenantId: 'uni-2' },
];

export const ADMIN_QA_REVIEWS = [
  { id: 'qr1', title: 'مراجعة داخلية — برنامج الذكاء الاصطناعي', scope: 'كلية الحوسبة', lead: 'د. رنا العمري', status: 'مفتوحة', due: '2026-04-25', actions: '•••', tenantId: 'uni-1' },
  { id: 'qr2', title: 'مراجعة تدقيق — أمن المعلومات', scope: 'قسم الشبكات', lead: 'م. ليث الزعبي', status: 'مجدولة', due: '2026-05-02', actions: '•••', tenantId: 'uni-2' },
  { id: 'qr3', title: 'مراجعة تشغيلية — تحليل الأعمال', scope: 'إدارة البرنامج', lead: 'د. ياسر خطيب', status: 'مغلقة', due: '2026-03-15', actions: '•••', tenantId: 'uni-3' },
  { id: 'qr4', title: 'مراجعة سنوية — سياسات التقييم', scope: 'عمادة الجودة', lead: 'د. هالة مراد', status: 'مجدولة', due: '2026-05-10', actions: '•••', tenantId: 'uni-1' },
  { id: 'qr5', title: 'مراجعة ميدانية — معامل الحاسوب', scope: 'كلية الهندسة', lead: 'م. سامر عودة', status: 'مفتوحة', due: '2026-04-30', actions: '•••', tenantId: 'uni-4' },
  { id: 'qr6', title: 'مراجعة وثائق — الاعتماد المؤسسي', scope: 'إدارة الاعتماد', lead: 'د. لينا الصباغ', status: 'قيد التحضير', due: '2026-06-05', actions: '•••', tenantId: 'uni-5' },
];

export const ADMIN_CORRECTIVE = [
  { id: 'ca1', issue: 'نقص في توثيق حضور الجلسات الافتراضية', owner: 'مكتب الجودة', due: '2026-04-18', status: 'مفتوح', actions: '•••', tenantId: 'uni-1' },
  { id: 'ca2', issue: 'تأخر تصحيح واجب جماعي', owner: 'المدرب المسؤول', due: '2026-04-12', status: 'مكتمل', actions: '•••', tenantId: 'uni-1' },
  { id: 'ca3', issue: 'مرفقات ناقصة في طلب اعتراف', owner: 'إدارة الاعتماد', due: '2026-05-01', status: 'مفتوح', actions: '•••', tenantId: 'uni-2' },
  { id: 'ca4', issue: 'عدم مطابقة سلم التقييم لمعيار البرنامج', owner: 'عميد الكلية', due: '2026-04-28', status: 'مفتوح', actions: '•••', tenantId: 'uni-3' },
  { id: 'ca5', issue: 'تأخر نشر نتائج منتصف الفصل', owner: 'شؤون الامتحانات', due: '2026-04-14', status: 'مكتمل', actions: '•••', tenantId: 'uni-4' },
  { id: 'ca6', issue: 'غياب تقرير متابعة للطلبة المتعثرين', owner: 'الإرشاد الأكاديمي', due: '2026-05-12', status: 'مفتوح', actions: '•••', tenantId: 'uni-5' },
];

export const ADMIN_AT_RISK = [
  { id: 'ar1', learner: 'خالد سعيد', cohort: 'دفعة ربيع 2026 — يرموك', indicator: 'تأخر تسليمات', tier: 'متوسط', owner: 'المرشد الأكاديمي', actions: '•••', tenantId: 'uni-1' },
  { id: 'ar2', learner: 'نورا حسن', cohort: 'دفعة خريف 2025 — أردنية', indicator: 'تراجع درجات', tier: 'مرتفع', owner: 'منسق الدفعة', actions: '•••', tenantId: 'uni-2' },
  { id: 'ar3', learner: 'ليان مصطفى', cohort: 'دفعة ربيع 2026 — سمية', indicator: 'غياب متكرر', tier: 'متوسط', owner: 'شؤون الطلبة', actions: '•••', tenantId: 'uni-3' },
  { id: 'ar4', learner: 'يوسف حماد', cohort: 'دفعة صيف 2026 — يرموك', indicator: 'انخفاض مشاركة', tier: 'منخفض', owner: 'المرشد الأكاديمي', actions: '•••', tenantId: 'uni-1' },
  { id: 'ar5', learner: 'رغد الطراونة', cohort: 'دفعة ربيع 2026 — سمية', indicator: 'تأخر تسليمات', tier: 'مرتفع', owner: 'منسق الدفعة', actions: '•••', tenantId: 'uni-3' },
  { id: 'ar6', learner: 'طارق مناصرة', cohort: 'دفعة خريف 2025 — أردنية', indicator: 'تراجع درجات', tier: 'متوسط', owner: 'الإرشاد الأكاديمي', actions: '•••', tenantId: 'uni-2' },
];

export const ADMIN_RISK_CASES = [
  { id: 'rk1', learner: 'خالد سعيد', cohort: 'دفعة ربيع 2026 — يرموك', level: 'متوسط', owner: 'المرشد الأكاديمي', status: 'مفتوحة', actions: '•••', tenantId: 'uni-1' },
  { id: 'rk2', learner: 'نورا حسن', cohort: 'دفعة خريف 2025 — أردنية', level: 'مرتفع', owner: 'عميد الكلية', status: 'قيد المتابعة', actions: '•••', tenantId: 'uni-2' },
  { id: 'rk3', learner: 'عمر يوسف', cohort: 'دفعة ربيع 2026 — سمية', level: 'منخفض', owner: 'المرشد الأكاديمي', status: 'مغلقة', actions: '•••', tenantId: 'uni-3' },
  { id: 'rk4', learner: 'ميس حمدان', cohort: 'دفعة صيف 2026 — يرموك', level: 'مرتفع', owner: 'عميد الكلية', status: 'مفتوحة', actions: '•••', tenantId: 'uni-1' },
  { id: 'rk5', learner: 'سامي النجار', cohort: 'دفعة خريف 2025 — أردنية', level: 'متوسط', owner: 'المرشد الأكاديمي', status: 'قيد المتابعة', actions: '•••', tenantId: 'uni-2' },
  { id: 'rk6', learner: 'هند أبو زيد', cohort: 'دفعة ربيع 2026 — سمية', level: 'منخفض', owner: 'المرشد الأكاديمي', status: 'مغلقة', actions: '•••', tenantId: 'uni-3' },
];

export const ADMIN_INTEGRITY = [
  { id: 'in1', ref: 'INT-2026-014', type: 'تشابه نصي', party: 'طالب — دفعة يرموك', status: 'قيد التحقيق', updated: '2026-04-07', actions: '•••', tenantId: 'uni-1' },
  { id: 'in2', ref: 'INT-2026-008', type: 'تسريب واجب', party: 'مجموعة — دفعة أردنية', status: 'مغلقة', updated: '2026-03-22', actions: '•••', tenantId: 'uni-2' },
  { id: 'in3', ref: 'INT-2026-021', type: 'هوية دخول مشتركة', party: 'طالبان — دفعة سمية', status: 'مفتوحة', updated: '2026-04-08', actions: '•••', tenantId: 'uni-3' },
  { id: 'in4', ref: 'INT-2026-031', type: 'استخدام أداة غير مصرّح بها', party: 'طالب — دفعة يرموك', status: 'قيد التحقيق', updated: '2026-04-08', actions: '•••', tenantId: 'uni-1' },
  { id: 'in5', ref: 'INT-2026-019', type: 'تزوير توقيع', party: 'طالبة — دفعة أردنية', status: 'مغلقة', updated: '2026-03-30', actions: '•••', tenantId: 'uni-2' },
  { id: 'in6', ref: 'INT-2026-027', type: 'تشابه نصي', party: 'طالب — دفعة سمية', status: 'مفتوحة', updated: '2026-04-06', actions: '•••', tenantId: 'uni-3' },
];

export const STUDENT_SESSION_ROWS = [
  { id: 'ss1', when: '2026-04-09 10:00', title: 'مقدمة المساق — أسبوع 1', course: 'أساسيات الذكاء الاصطناعي', link: 'انضمام', tenantId: 'uni-1' },
  { id: 'ss2', when: '2026-04-10 14:00', title: 'معمل تحليل البيانات', course: 'أساسيات الذكاء الاصطناعي', link: 'انضمام', tenantId: 'uni-1' },
  { id: 'ss3', when: '2026-04-11 09:30', title: 'مراجعة الوحدة الثانية', course: 'أساسيات الذكاء الاصطناعي', link: 'انضمام', tenantId: 'uni-1' },
  { id: 'ss4', when: '2026-04-12 12:00', title: 'ساعة مكتبية', course: 'أساسيات الذكاء الاصطناعي', link: 'حجز', tenantId: 'uni-1' },
  { id: 'ss5', when: '2026-04-13 11:00', title: 'نقاش حول التعلم الخاضع للإشراف', course: 'أساسيات الذكاء الاصطناعي', link: 'انضمام', tenantId: 'uni-1' },
  { id: 'ss6', when: '2026-04-15 16:00', title: 'ورشة pandas', course: 'مهارات البرمجة للتحليل', link: 'انضمام', tenantId: 'uni-1' },
  { id: 'ss7', when: '2026-04-17 09:00', title: 'اختبار قصير — الوحدة الثالثة', course: 'أساسيات الذكاء الاصطناعي', link: 'دخول', tenantId: 'uni-1' },
];

export const STUDENT_PROGRAM_ROWS = [
  { id: 'pr1', name: 'أساسيات الذكاء الاصطناعي', progress: '68%', cohort: 'دفعة ربيع 2026 — يرموك', status: 'مسجّل', tenantId: 'uni-1' },
  { id: 'pr2', name: 'مهارات البرمجة للتحليل', progress: '40%', cohort: 'دفعة ربيع 2026 — يرموك', status: 'مسجّل', tenantId: 'uni-1' },
  { id: 'pr3', name: 'أمن المعلومات التطبيقي', progress: '22%', cohort: 'دفعة ربيع 2026 — يرموك', status: 'مسجّل', tenantId: 'uni-1' },
  { id: 'pr4', name: 'تحليل الأعمال بالبيانات', progress: '55%', cohort: 'دفعة ربيع 2026 — يرموك', status: 'مسجّل', tenantId: 'uni-1' },
];

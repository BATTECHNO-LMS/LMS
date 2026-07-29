'use strict';

/**
 * Idempotent Content CMS seed (help categories, articles, user guides, system popups).
 * Safe to re-run: upserts by slug / guide_key+guide_version / system_key. Does not delete rows.
 */
const { prisma } = require('../src/config/db');
const {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
  FIELD_TRAINING_REVIEWER_GUIDE_KEY,
  FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
} = require('../src/modules/help/help.constants');

const NOW = () => new Date();

const CATEGORIES = [
  {
    slug: 'getting-started',
    title_ar: 'البدء باستخدام المنصة',
    description_ar: 'إنشاء الحساب، استكمال الملف الشخصي، والخطوات الأولى.',
    icon: 'UserRound',
    sort_order: 1,
    target_roles: ['student'],
  },
  {
    slug: 'account-activation',
    title_ar: 'الحساب وتوثيق البريد والتفعيل',
    description_ar: 'توثيق البريد، انتظار التفعيل خلال 48 ساعة، ومتابعة حالة الحساب.',
    icon: 'ShieldCheck',
    sort_order: 2,
    target_roles: ['student'],
  },
  {
    slug: 'training-opportunities',
    title_ar: 'فرص التدريب الميداني',
    description_ar: 'كيفية إيجاد الفرص والتقديم ومتابعة حالة الطلب.',
    icon: 'Briefcase',
    sort_order: 3,
    target_roles: ['student'],
  },
  {
    slug: 'sessions-attendance',
    title_ar: 'الجلسات والحضور',
    description_ar: 'جدول الجلسات، رابط Zoom، ورمز الحضور الإلكتروني.',
    icon: 'CalendarDays',
    sort_order: 4,
    target_roles: ['student'],
  },
  {
    slug: 'tests',
    title_ar: 'الاختبارات',
    description_ar: 'الاختبار القبلي والبعدي وكيفية الإرسال النهائي.',
    icon: 'FileCheck',
    sort_order: 5,
    target_roles: ['student'],
  },
  {
    slug: 'tasks-submissions',
    title_ar: 'المهمات والتسليمات',
    description_ar: 'رفع الملفات، التسليم النهائي، وأنواع التقييم AI وMANUAL وNONE.',
    icon: 'ListChecks',
    sort_order: 6,
    target_roles: ['student'],
  },
  {
    slug: 'progress-hours',
    title_ar: 'التقدم والساعات التدريبية',
    description_ar: 'نسبة الإنجاز، الساعات، والمتطلبات المتبقية.',
    icon: 'BarChart3',
    sort_order: 7,
    target_roles: ['student'],
  },
  {
    slug: 'certificates',
    title_ar: 'الشهادات والوثائق',
    description_ar: 'متى تصدر الشهادة وكيفية تنزيلها.',
    icon: 'Award',
    sort_order: 8,
    target_roles: ['student'],
  },
  {
    slug: 'common-problems',
    title_ar: 'المشاكل الشائعة',
    description_ar: 'حلول سريعة للأخطاء المتكررة.',
    icon: 'AlertTriangle',
    sort_order: 9,
    target_roles: ['student'],
  },
  {
    slug: 'support',
    title_ar: 'التواصل مع الدعم',
    description_ar: 'كيف تطلب المساعدة عند الحاجة.',
    icon: 'LifeBuoy',
    sort_order: 10,
    target_roles: ['student'],
  },
  {
    slug: 'instructor-guide',
    title_ar: 'دليل المدرس',
    description_ar: 'إدارة الجلسات والحضور والمهمات وتقييم الطلاب المسندين.',
    icon: 'GraduationCap',
    sort_order: 11,
    target_roles: ['instructor'],
  },
  {
    slug: 'reviewer-guide',
    title_ar: 'دليل مراجع الجامعة',
    description_ar: 'صلاحيات القراءة ضمن نطاق الجامعة دون تعديل أو اعتماد.',
    icon: 'Eye',
    sort_order: 12,
    target_roles: ['reviewer'],
  },
];

function article(partial) {
  const hasContextual = Boolean(partial.related_route || partial.contextual_key);
  return {
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    target_roles: ['student'],
    is_published: true,
    status: 'PUBLISHED',
    version: 1,
    is_faq: false,
    keywords: [],
    show_in_contextual: hasContextual,
    ...partial,
    show_in_contextual:
      partial.show_in_contextual != null ? partial.show_in_contextual : hasContextual,
  };
}

const ARTICLES = [
  // —— الحساب والتفعيل ——
  article({
    category_slug: 'account-activation',
    slug: 'how-to-create-account',
    title_ar: 'كيفية إنشاء الحساب',
    summary_ar: 'سجّل بالبريد والبيانات الأساسية ثم وثّق البريد.',
    keywords: ['حساب', 'تسجيل', 'إنشاء'],
    related_route: '/register',
    contextual_key: 'account_create',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'من صفحة التسجيل أدخل بياناتك الشخصية والبريد والجامعة والتخصص وكلمة المرور. بعد الإرسال ستصلك رسالة توثيق. أكمل التوثيق قبل متابعة أي خطوة أخرى. تأكد من صحة الجامعة والتخصص لأنهما يحددان فرص التدريب الظاهرة لاحقًا.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'email-verification',
    title_ar: 'توثيق البريد الإلكتروني',
    summary_ar: 'أدخل رمز التحقق المرسل إلى بريدك.',
    keywords: ['توثيق', 'بريد', 'رمز', 'otp'],
    related_route: '/verify-email',
    contextual_key: 'email_verification',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'بعد التسجيل يصل رمز تحقق إلى بريدك. أدخله خلال المدة المحددة. إذا لم يصل الرمز راجع مجلد غير الهام، وتأكد من صحة البريد، ثم اطلب إعادة الإرسال. بدون توثيق البريد لا ينتقل الحساب إلى مراجعة التفعيل.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'email-otp-missing',
    title_ar: 'لم يصلني رمز التحقق',
    summary_ar: 'تحقق من البريد والمجلد غير الهام ثم أعد الإرسال.',
    keywords: ['رمز', 'تحقق', 'بريد', 'otp'],
    sort_order: 3,
    is_faq: true,
    content_ar:
      'تحقق من مجلد الرسائل غير المرغوب فيها، وتأكد من إدخال البريد بشكل صحيح. انتظر مدة قصيرة ثم اطلب إعادة إرسال الرمز. إن استمرت المشكلة تواصل مع الدعم مع ذكر البريد المستخدم.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'how-account-activation-works',
    title_ar: 'كيف يتم تفعيل الحساب؟',
    summary_ar: 'تسجيل، توثيق بريد، مراجعة الإدارة، ثم التفعيل خلال 48 ساعة.',
    keywords: ['تفعيل الحساب', 'توثيق البريد', 'الإدارة', '48 ساعة'],
    related_route: '/account-status',
    contextual_key: 'account_activation_flow',
    sort_order: 4,
    is_faq: true,
    content_ar:
      'بعد إنشاء الحساب يصل رمز توثيق إلى بريدك. بعد التوثيق يدخل الحساب مرحلة مراجعة الإدارة. عادةً يتم التفعيل خلال مدة لا تتجاوز 48 ساعة. قبل التفعيل لا يمكن الدخول إلى لوحة الطالب.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'why-account-pending-activation',
    title_ar: 'لماذا حسابي بانتظار التفعيل؟',
    summary_ar: 'الحسابات الجديدة تحتاج مراجعة إدارية قبل الدخول.',
    keywords: ['بانتظار التفعيل', 'pending', '48 ساعة'],
    related_route: '/account-status',
    contextual_key: 'account_pending_activation',
    sort_order: 5,
    is_faq: true,
    content_ar:
      'هذه حالة طبيعية للحسابات الجديدة. النظام يفصل بين إنشاء الحساب وبين اعتماد الإدارة. سيتم التفعيل خلال مدة لا تتجاوز 48 ساعة بعد توثيق البريد. تابع الحالة من صفحة حالة الحساب.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'activation-delayed-over-48h',
    title_ar: 'مر أكثر من 48 ساعة ولم يتم التفعيل',
    summary_ar: 'تواصل مع الدعم إذا تجاوز الانتظار 48 ساعة.',
    keywords: ['48 ساعة', 'تأخر التفعيل', 'دعم'],
    related_route: '/student/user-guide/support',
    contextual_key: 'activation_delayed_48h',
    sort_order: 6,
    is_faq: true,
    content_ar:
      'إذا تجاوزت مدة الانتظار 48 ساعة بعد توثيق البريد، افتح طلب دعم بعنوان «تأخر تفعيل الحساب». أرفق وصفًا موجزًا وتأكد من صحة البريد والجامعة والتخصص.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'edit-personal-data',
    title_ar: 'تعديل البيانات الشخصية',
    summary_ar: 'حدّث الاسم والهاتف والبيانات الظاهرة في ملفك.',
    keywords: ['ملف', 'شخصي', 'تعديل', 'بيانات'],
    related_route: '/student/dashboard',
    contextual_key: 'profile',
    sort_order: 7,
    is_faq: true,
    content_ar:
      'من لوحة الطالب راجع بياناتك: الاسم الرباعي، الهاتف، والبريد. صحّح الاسم قبل إصدار الشهادة لأن الوثائق تعتمد على البيانات المسجّلة. بعض الحقول قد تتطلب مراجعة إدارية بعد التعديل.',
  }),
  article({
    category_slug: 'account-activation',
    slug: 'fix-university-specialty',
    title_ar: 'تصحيح الجامعة أو التخصص',
    summary_ar: 'الجامعة والتخصص يحددان الفرص الظاهرة لك.',
    keywords: ['جامعة', 'تخصص', 'تصحيح'],
    related_route: '/student/dashboard',
    contextual_key: 'profile_university',
    sort_order: 8,
    is_faq: true,
    content_ar:
      'إذا كانت الجامعة أو التخصص غير صحيحين فقد لا تظهر فرص التدريب المناسبة. عدّل البيانات من الملف الشخصي. إن تعذّر التعديل تواصل مع الدعم مع ذكر الجامعة والتخصص الصحيحين.',
  }),
  article({
    category_slug: 'getting-started',
    slug: 'complete-profile',
    title_ar: 'كيف أستكمل الملف الشخصي؟',
    summary_ar: 'راجع الاسم والجامعة والتخصص والهاتف قبل البدء.',
    keywords: ['ملف', 'شخصي', 'جامعة', 'تخصص', 'هاتف'],
    related_route: '/student/dashboard',
    contextual_key: 'profile',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'افتح لوحة الطالب وراجع بياناتك: الاسم الرباعي، الجامعة، التخصص، الرقم الجامعي إن وجد، الهاتف، والبريد. هذه البيانات تُستخدم في التقارير والشهادات. إذا كانت الجامعة أو التخصص غير صحيحين فقد لا تظهر فرص التدريب المناسبة.',
  }),

  // —— فرص التدريب ——
  article({
    category_slug: 'training-opportunities',
    slug: 'how-opportunities-appear',
    title_ar: 'كيف تظهر فرص التدريب؟',
    summary_ar: 'الظهور يعتمد على الجامعة والتخصص وحالة الحساب والفرصة.',
    keywords: ['فرصة', 'ظهور', 'جامعة', 'تخصص'],
    related_route: '/student/field-training',
    contextual_key: 'opportunities',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'تظهر الفرص المخصّصة لجامعتك وتخصصك عندما يكون الحساب مفعّلًا والفرصة منشورة ضمن فترة التسجيل. راجع ملفك الشخصي أولًا، ثم افتح قائمة فرص التدريب الميداني.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'how-to-apply',
    title_ar: 'كيف أسجل في فرصة التدريب؟',
    summary_ar: 'افتح الفرصة، راجع المتطلبات، ثم قدّم الطلب.',
    keywords: ['تسجيل', 'تقديم', 'طلب'],
    related_route: '/student/field-training',
    contextual_key: 'opportunities',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'من قائمة التدريب الميداني افتح الفرصة المناسبة، راجع الوصف والمتطلبات وعدد الساعات ومواعيد البداية والنهاية، ثم أرسل طلب التقديم. ستظهر حالة الطلب لاحقًا لمتابعتها.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'application-statuses',
    title_ar: 'ما معنى حالات طلب التدريب؟',
    summary_ar: 'قيد المراجعة، مقبول، مرفوض، وبدء التدريب.',
    keywords: ['طلب', 'مقبول', 'مرفوض', 'مراجعة'],
    related_route: '/student/field-training',
    contextual_key: 'application',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'قيد المراجعة: الطلب بانتظار قرار الإدارة. مقبول: يمكنك متابعة الخطوات التالية مثل الاختبار القبلي. مرفوض: راجع سبب الرفض إن وُجد. بعد القبول قد تنتقل إلى بدء التدريب ثم الإكمال وفق متطلبات الفرصة.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'why-opportunity-missing',
    title_ar: 'لماذا لا تظهر لي فرصة التدريب؟',
    summary_ar: 'الظهور يعتمد على الجامعة والتخصص وحالة التسجيل.',
    keywords: ['فرصة', 'غير ظاهرة', 'تخصص', 'جامعة'],
    related_route: '/student/field-training',
    contextual_key: 'opportunities',
    sort_order: 4,
    is_faq: true,
    content_ar:
      'قد لا تظهر الفرصة إذا: غير مخصصة لجامعتك، تخصصك غير مشمول، التسجيل لم يبدأ أو انتهى، الحساب غير مفعل، بيانات الجامعة/التخصص غير صحيحة، لديك طلب قيد المراجعة، أو الفرصة مكتملة/مغلقة. راجع ملفك الشخصي ثم قائمة فرص التدريب.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'opportunity-hours-and-dates',
    title_ar: 'الساعات المطلوبة ومواعيد الفرصة',
    summary_ar: 'راجع عدد الساعات وموعد البداية والنهاية قبل التقديم.',
    keywords: ['ساعات', 'موعد', 'بداية', 'نهاية'],
    related_route: '/student/field-training',
    contextual_key: 'opportunities',
    sort_order: 5,
    content_ar:
      'كل فرصة تحدد عدد الساعات التدريبية المطلوبة وفترة البداية والنهاية وفترة التسجيل. التزم بالمواعيد لأن الجلسات والاختبارات والمهمات تُجدول ضمن هذه الفترة. الساعات تُحتسب وفق الحضور المعتمد وإعدادات الفرصة.',
  }),

  // —— الجلسات والحضور ——
  article({
    category_slug: 'sessions-attendance',
    slug: 'where-to-find-sessions',
    title_ar: 'أين أجد الجلسات؟',
    summary_ar: 'من تفاصيل فرصة التدريب ضمن تبويب الجلسات.',
    keywords: ['جلسات', 'جدول', 'موعد'],
    related_route: '/student/field-training',
    contextual_key: 'sessions',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'بعد قبول طلبك افتح تفاصيل فرصة التدريب ثم تبويب الجلسات. ستجد العنوان والتاريخ والوقت وما إذا كانت الجلسة إلزامية. حدّث الصفحة إذا لم تظهر الجلسات بعد نشرها من الإدارة أو المدرس.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'where-to-find-zoom',
    title_ar: 'أين أجد رابط Zoom؟',
    summary_ar: 'رابط اللقاء يظهر داخل تفاصيل الجلسة عند توفره.',
    keywords: ['زوم', 'zoom', 'رابط'],
    related_route: '/student/field-training',
    contextual_key: 'sessions',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'افتح الجلسة من جدولك وستجد رابط Zoom إن أضافه المدرس أو الإدارة. الدخول إلى Zoom وحده لا يسجّل الحضور؛ يجب إدخال رمز الحضور داخل المنصة عند فتح النافذة.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'how-to-mark-attendance',
    title_ar: 'كيف أسجل حضوري؟',
    summary_ar: 'أدخل رمز الحضور داخل المنصة أثناء فتح النافذة.',
    keywords: ['حضور', 'رمز', 'زوم', 'نافذة', 'PRESENT'],
    related_route: '/student/field-training',
    contextual_key: 'attendance',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'يجب أن تكون مسجلاً دخولًا داخل المنصة. عند فتح المدرس نافذة الحضور سيظهر تنبيه لإدخال الرمز وتأكيد الحضور خلال المدة المحددة. فتح Zoom وحده لا يكفي.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'attendance-statuses-explained',
    title_ar: 'معنى حالات الحضور',
    summary_ar: 'PRESENT وABSENT وLATE وEXCUSED وUNCONFIRMED.',
    keywords: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'UNCONFIRMED', 'حضور', 'غياب'],
    related_route: '/student/field-training',
    contextual_key: 'attendance',
    sort_order: 4,
    is_faq: true,
    content_ar:
      'PRESENT (حاضر): تم تأكيد حضورك بنجاح. ABSENT (غائب): لم يُسجَّل حضور معتمد. LATE (متأخر): سُجّل حضورك بعد النافذة العادية أو وُسِم متأخرًا. EXCUSED (غياب بعذر): غياب معتمد بعذر. UNCONFIRMED (غير مؤكد): لم تُعتمد الحالة بعد، غالبًا عند انتهاء النافذة دون إدخال الرمز أو بانتظار قرار المدرس.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'attendance-popup-missing',
    title_ar: 'لم تظهر نافذة الحضور',
    summary_ar: 'تأكد من تسجيل الدخول وتحديث الصفحة وأن النافذة ما زالت مفتوحة.',
    keywords: ['نافذة', 'حضور', 'لم تظهر', 'Popup'],
    related_route: '/student/field-training',
    contextual_key: 'attendance',
    sort_order: 5,
    is_faq: true,
    content_ar:
      'حدّث الصفحة وتأكد أنك داخل حساب الطالب الصحيح وأن المدرس فتح نافذة الحضور. إذا انتهت المدة قد تظهر حالتك غير مؤكدة (UNCONFIRMED) أو غائب (ABSENT) حسب اعتماد المسؤول. راجع المدرس إن كنت حاضرًا.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'zoom-not-enough',
    title_ar: 'حضرت Zoom لكن حالتي غائب',
    summary_ar: 'الحضور يُسجَّل عبر رمز المنصة وليس عبر Zoom فقط.',
    keywords: ['زوم', 'غائب', 'حضور', 'ABSENT'],
    related_route: '/student/field-training',
    contextual_key: 'attendance',
    sort_order: 6,
    is_faq: true,
    content_ar:
      'رابط Zoom للدخول إلى اللقاء فقط. تسجيل الحضور يتم بإدخال الرمز في المنصة أثناء فتح النافذة. يمكن للمدرس تعديل الحضور يدويًا عند وجود سبب واضح.',
  }),

  // —— الاختبارات ——
  article({
    category_slug: 'tests',
    slug: 'pre-post-tests',
    title_ar: 'ما الفرق بين الاختبار القبلي والبعدي؟',
    summary_ar: 'القبلي قبل التدريب والبعدي بعد استكمال المتطلبات.',
    keywords: ['اختبار', 'قبلي', 'بعدي'],
    related_route: '/student/field-training',
    contextual_key: 'assessments',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'الاختبار القبلي يقيس المستوى قبل البدء وقد يكون شرطًا لبدء التدريب. الاختبار البعدي يتاح بعد إكمال الجلسات/المهمات وفق إعدادات الفرصة. اضغط إرسال الإجابات نهائيًا ولا تعتمد على الحفظ المؤقت فقط.',
  }),
  article({
    category_slug: 'tests',
    slug: 'test-time-and-submit',
    title_ar: 'الوقت المتاح والحفظ مقابل الإرسال النهائي',
    summary_ar: 'الحفظ المؤقت لا يغني عن الإرسال النهائي قبل انتهاء الوقت.',
    keywords: ['وقت', 'حفظ', 'إرسال', 'اختبار'],
    related_route: '/student/field-training',
    contextual_key: 'assessments',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'لكل اختبار مدة محددة تظهر قبل البدء. يمكنك حفظ الإجابات مؤقتًا أثناء الحل، لكن يجب الضغط على الإرسال النهائي قبل انتهاء الوقت. بعد الإرسال النهائي لا تعتمد على الحفظ وحده لاحتساب المحاولة.',
  }),
  article({
    category_slug: 'tests',
    slug: 'test-retry-and-disconnect',
    title_ar: 'إعادة المحاولة وانقطاع الإنترنت',
    summary_ar: 'راجع المحاولات المسموحة وماذا تفعل عند انقطاع الاتصال.',
    keywords: ['محاولة', 'إنترنت', 'انقطاع', 'اختبار'],
    related_route: '/student/field-training',
    contextual_key: 'assessments',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'إذا سمحت إعدادات التقييم بإعادة المحاولة ستظهر محاولة جديدة بعد استيفاء الشروط. عند انقطاع الإنترنت أعد الاتصال فورًا ولا تغلق الصفحة إن أمكن، ثم أعد الإرسال. إن ظهر أن الوقت انتهى أو تجاوزت المحاولات فراجع الإدارة.',
  }),
  article({
    category_slug: 'tests',
    slug: 'cannot-start-test',
    title_ar: 'لماذا لا أستطيع بدء الاختبار؟',
    summary_ar: 'قد لا يكون منشورًا أو لم تتحقق شروط الإتاحة.',
    keywords: ['اختبار', 'غير متاح', 'بدء'],
    related_route: '/student/field-training',
    contextual_key: 'assessments',
    sort_order: 4,
    is_faq: true,
    content_ar:
      'تأكد أن طلبك مقبول، وأن التقييم منشور، وأنك ضمن المرحلة الصحيحة (مثلاً بعد القبول للقبلي أو بعد المتطلبات للبعدي). إن ظهر أن الوقت انتهى أو تجاوزت المحاولات المسموحة فراجع الإدارة.',
  }),

  // —— المهمات ——
  article({
    category_slug: 'tasks-submissions',
    slug: 'how-to-submit-task',
    title_ar: 'كيف أسلم المهمة؟',
    summary_ar: 'ارفع الملفات ثم اضغط تسليم المهمة وانتظر رسالة النجاح.',
    keywords: ['مهمة', 'تسليم', 'رفع', 'ملف'],
    related_route: '/student/field-training',
    contextual_key: 'tasks',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'افتح المهمة واقرأ التعليمات وموعد التسليم. يمكنك إضافة وصف ورفع ملفات أو رابط حسب الإعدادات. لا تغلق الصفحة أثناء الرفع. الرفع وحده لا يكفي؛ يجب الضغط على «تسليم المهمة» وظهور رسالة نجاح.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'grading-modes',
    title_ar: 'أنواع تقييم المهمات AI و MANUAL و NONE',
    summary_ar: 'ذكاء اصطناعي، يدوي، أو بدون تقييم، والمهمة النهائية مستقلة.',
    keywords: ['تقييم', 'AI', 'MANUAL', 'NONE', 'ذكاء', 'يدوي'],
    related_route: '/student/field-training',
    contextual_key: 'tasks',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'AI: تقييم أولي بالذكاء الاصطناعي على الملفات المدعومة مع ملاحظات أولية. MANUAL: يبقى التسليم قيد المراجعة حتى اعتماد المدرس. NONE: تُحتسب مكتملة عند التسليم الناجح دون درجة. صفة المهمة النهائية مستقلة عن نوع التقييم وقد تكون شرطًا للشهادة.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'uploaded-not-submitted',
    title_ar: 'رفعت الملف لكن المهمة لم تُحتسب',
    summary_ar: 'تأكد من الضغط على تسليم المهمة بعد اكتمال الرفع.',
    keywords: ['رفع', 'لم تحتسب', 'تسليم'],
    related_route: '/student/field-training',
    contextual_key: 'tasks',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'تم رفع الملف لا يعني إرسال المهمة. بعد اكتمال الرفع اضغط «تسليم المهمة». راجع حالة التسليم: لم يتم التسليم، تم التسليم، قيد المراجعة، مطلوب تعديل، مقبول، أو مرفوض.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'task-resubmit-and-feedback',
    title_ar: 'إعادة التسليم وملاحظات المدرس وAI',
    summary_ar: 'عند «مطلوب تعديل» أعد التسليم بعد قراءة الملاحظات.',
    keywords: ['إعادة تسليم', 'ملاحظات', 'مطلوب تعديل', 'AI'],
    related_route: '/student/field-training',
    contextual_key: 'tasks',
    sort_order: 4,
    is_faq: true,
    content_ar:
      'إذا ظهرت حالة «مطلوب تعديل» راجع ملاحظات المدرس أو نتيجة AI ثم ارفع نسخة مصحّحة وسلّم مجددًا. الملفات المضغوطة ZIP قد تُقبل للرفع لكن الذكاء الاصطناعي قد لا يحللها. التسليم بالرابط متاح إذا سمحت إعدادات المهمة.',
  }),

  // —— التقدم والساعات ——
  article({
    category_slug: 'progress-hours',
    slug: 'progress-checklist',
    title_ar: 'كيف أتابع تقدمي والمتطلبات المتبقية؟',
    summary_ar: 'من نظرة عامة على التدريب تظهر المتطلبات مكتملة/متبقية.',
    keywords: ['تقدم', 'ساعات', 'متطلبات', 'إنجاز'],
    related_route: '/student/field-training',
    contextual_key: 'progress',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'تابع: قبول الطلب، الاختبار القبلي، الجلسات والحضور، المهمات والمهمة النهائية، الاختبار البعدي، التقييم الذاتي إن لزم، ثم اعتماد التدريب. النسبة لا تصل 100% إذا بقيت متطلبات غير معتمدة.',
  }),
  article({
    category_slug: 'progress-hours',
    slug: 'how-hours-and-attendance-count',
    title_ar: 'كيف تُحسب الساعات ونسبة الحضور؟',
    summary_ar: 'الساعات والحضور وفق إعدادات الفرصة والحالات المعتمدة.',
    keywords: ['ساعات', 'حضور', 'نسبة'],
    related_route: '/student/field-training',
    contextual_key: 'progress',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'تُحسب الساعات وفق إعدادات الفرصة والحضور المعتمد للجلسات الإلزامية عادةً. حالات مثل PRESENT وLATE وEXCUSED قد تُحتسب ضمن الحضور حسب القواعد، بينما ABSENT لا يُحتسب. راجع تبويب التقدم لمعرفة المكتمل والمتبقي.',
  }),
  article({
    category_slug: 'progress-hours',
    slug: 'why-progress-not-100',
    title_ar: 'لماذا لا تصل النسبة إلى 100%؟',
    summary_ar: 'متطلبات ناقصة أو بانتظار الاعتماد تمنع الاكتمال.',
    keywords: ['100%', 'نسبة', 'اعتماد'],
    related_route: '/student/field-training',
    contextual_key: 'progress',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'النسبة لا تصل 100% إذا بقيت جلسات غائبة، مهمات غير مسلّمة أو بانتظار المراجعة، اختبارات غير مكتملة، أو اعتماد التدريب لم يصدر بعد. أكمل المتبقية من صفحة التقدم ثم انتظر اعتماد الجهات المخولة.',
  }),

  // —— الشهادات ——
  article({
    category_slug: 'certificates',
    slug: 'when-certificate-issued',
    title_ar: 'متى تصدر الشهادة؟',
    summary_ar: 'بعد اكتمال المتطلبات واعتماد الإدارة، وليست تلقائية بعد آخر جلسة.',
    keywords: ['شهادة', 'خطاب', 'إصدار'],
    related_route: '/student/field-training',
    contextual_key: 'certificates',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'الشهادة أو خطاب التدريب يظهر بعد استكمال الحضور والمهمات والنتائج واعتماد الجهات المخولة. أكمل المتبقية من صفحة التقدم، وصحّح بيانات الاسم قبل الإصدار. يمكنك تنزيل الوثيقة من تبويب الإكمال عند توفرها.',
  }),
  article({
    category_slug: 'certificates',
    slug: 'certificate-missing-reasons',
    title_ar: 'لماذا لا تظهر الشهادة؟',
    summary_ar: 'تحقق من المتطلبات المتبقية وحالة الاعتماد والاسم.',
    keywords: ['شهادة', 'غير ظاهرة', 'تنزيل'],
    related_route: '/student/certificate',
    contextual_key: 'certificates',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'قد لا تظهر الشهادة إذا لم تكتمل المتطلبات، أو لم يُعتمد التدريب بعد، أو ما زال الاسم بحاجة لتصحيح. راجع صفحة التقدم ثم الشهادات. عند التوفر يمكنك تنزيل الشهادة وخطاب التدريب من المكان المخصّص.',
  }),

  // —— مشاكل ودعم ——
  article({
    category_slug: 'common-problems',
    slug: 'common-issues-index',
    title_ar: 'دليل سريع للمشاكل الشائعة',
    summary_ar: 'رمز تحقق، فرصة غير ظاهرة، حضور، تسليم، وشهادة.',
    keywords: ['مشاكل', 'خطأ', 'دعم'],
    sort_order: 1,
    is_faq: true,
    content_ar:
      'لم يصل رمز التحقق: راجع البريد وأعد الإرسال. الفرصة غير ظاهرة: راجع الجامعة/التخصص. رمز الحضور لا يعمل: تأكد من النافذة المفتوحة والرموز الصحيحة. الملف كبير: قلّل الحجم أو قسّم الملفات. الشهادة غير متاحة: أكمل المتطلبات المتبقية ثم انتظر الاعتماد. إن لم يُحل الأمر أنشئ تذكرة دعم من قسم الدعم.',
  }),
  article({
    category_slug: 'support',
    slug: 'how-to-contact-support',
    title_ar: 'كيف أتواصل مع الدعم؟',
    summary_ar: 'راجع الدليل أولًا ثم أنشئ تذكرة منظمة.',
    keywords: ['دعم', 'تذكرة', 'مساعدة'],
    related_route: '/student/user-guide/support',
    contextual_key: 'support',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'قبل فتح تذكرة، ابحث في دليل المستخدم. إذا لم تجد الحل، أنشئ طلب دعم واختر نوع المشكلة واكتب وصفًا واضحًا مع ربط الفرصة/الجلسة/المهمة عند الحاجة. لا تحتاج لإعادة إدخال بيانات حسابك؛ تُؤخذ من الجلسة تلقائيًا.',
  }),

  // —— دليل المدرس ——
  article({
    category_slug: 'instructor-guide',
    slug: 'instructor-assigned-sessions',
    title_ar: 'الجلسات المسندة إليك',
    summary_ar: 'اعرض الجلسات ضمن الفرص المسندة لك كمدرس.',
    keywords: ['مدرس', 'جلسات', 'مسند'],
    related_route: '/instructor/field-training',
    contextual_key: 'instructor_sessions',
    sort_order: 1,
    is_faq: true,
    target_roles: ['instructor'],
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    content_ar:
      'كمدرس تظهر لك الفرص والجلسات المسندة إليك. راجع الجدول والتواريخ وروابط اللقاء. حدّث رابط الجلسة إن كانت صلاحياتك تسمح بذلك، وتأكد من وضوح العنوان والوقت للطلاب.',
  }),
  article({
    category_slug: 'instructor-guide',
    slug: 'instructor-attendance-window',
    title_ar: 'فتح نافذة الحضور ورمز الحضور',
    summary_ar: 'افتح النافذة، شارك الرمز، ويمكن وضع الكل حاضرًا عند الحاجة.',
    keywords: ['حضور', 'رمز', 'نافذة', 'مدرس'],
    related_route: '/instructor/field-training',
    contextual_key: 'instructor_attendance',
    sort_order: 2,
    is_faq: true,
    target_roles: ['instructor'],
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    content_ar:
      'من الجلسة افتح نافذة الحضور ليتمكن الطلاب من إدخال الرمز داخل المنصة. يمكنك مشاركة الرمز أثناء اللقاء. عند الحاجة استخدم وضع «الكل حاضر» ثم راجع الحالات يدويًا. يمكنك تعديل الحضور يدويًا واعتماد الغياب أو الحالات الأخرى (حاضر، غائب، متأخر، بعذر، غير مؤكد).',
  }),
  article({
    category_slug: 'instructor-guide',
    slug: 'instructor-tasks-and-grading',
    title_ar: 'إدارة المهمات والتقييم اليدوي ومراجعة AI',
    summary_ar: 'أنشئ أو أدِر المهمات وراجع التسليمات والتقييم الآلي.',
    keywords: ['مهام', 'تقييم', 'AI', 'يدوي'],
    related_route: '/instructor/field-training',
    contextual_key: 'instructor_tasks',
    sort_order: 3,
    is_faq: true,
    target_roles: ['instructor'],
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    content_ar:
      'حسب صلاحياتك يمكنك إنشاء أو إدارة مهمات الفرصة وتحديد نوع التقييم (AI أو MANUAL أو NONE). راجع تسليمات الطلاب، واعتمد التقييم اليدوي، وراجع ملاحظات الذكاء الاصطناعي قبل اعتماد النتيجة، واطلب التعديل عند الحاجة.',
  }),
  article({
    category_slug: 'instructor-guide',
    slug: 'instructor-student-reports',
    title_ar: 'تقارير الطلاب المسندين إليك',
    summary_ar: 'تابع تقدم الطلاب ضمن نطاق الفرص المسندة.',
    keywords: ['تقارير', 'طلاب', 'تقدم'],
    related_route: '/instructor/field-training',
    contextual_key: 'instructor_reports',
    sort_order: 4,
    target_roles: ['instructor'],
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    content_ar:
      'من لوحة المدرس يمكنك متابعة حضور الطلاب وتسليماتهم ونتائج الاختبارات ضمن الفرص المسندة إليك. استخدم التقارير لمتابعة المتأخرين والمتطلبات الناقصة قبل اعتماد المراحل النهائية.',
  }),

  // —— دليل المراجع ——
  article({
    category_slug: 'reviewer-guide',
    slug: 'reviewer-scope-readonly',
    title_ar: 'نطاق مراجع الجامعة وصلاحية القراءة فقط',
    summary_ar: 'مرتبط بجامعة محددة ويطّلع دون تعديل أو اعتماد.',
    keywords: ['مراجع', 'جامعة', 'قراءة', 'reviewer'],
    related_route: '/reviewer',
    contextual_key: 'reviewer_scope',
    sort_order: 1,
    is_faq: true,
    target_roles: ['reviewer'],
    guide_version: FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
    content_ar:
      'دور المراجع (reviewer) مرتبط بجامعة محددة. تملك صلاحية قراءة فقط ضمن نطاق جامعتك: عرض الطلاب وتفاصيل التدريب والحضور والمهمات والاختبارات والتقدم والساعات والتقارير والشهادات. لا تستطيع تعديل أو اعتماد أي بيانات.',
  }),
  article({
    category_slug: 'reviewer-guide',
    slug: 'reviewer-what-you-can-view',
    title_ar: 'ماذا يستطيع مراجع الجامعة عرضه؟',
    summary_ar: 'طلاب الجامعة، الحضور، المهمات، الاختبارات، التقدم، والشهادات.',
    keywords: ['مراجع', 'عرض', 'تقارير', 'حضور'],
    related_route: '/reviewer',
    contextual_key: 'reviewer_views',
    sort_order: 2,
    is_faq: true,
    target_roles: ['reviewer'],
    guide_version: FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
    content_ar:
      'يمكنك عرض طلاب جامعتك، تفاصيل فرص التدريب، سجلات الحضور، المهمات والتسليمات، الاختبارات، التقدم والساعات، والتقارير والشهادات المرتبطة بنطاقك. أي محاولة تعديل أو اعتماد خارج صلاحياتك ستُرفض من النظام.',
  }),
];

const STUDENT_GUIDE_STEPS = [
  {
    tour_target: 'student-profile',
    title_ar: 'الملف الشخصي',
    body_ar: 'راجع بياناتك والجامعة والتخصص قبل التقديم على فرص التدريب.',
    related_route: '/student/dashboard',
    icon: 'UserRound',
    sort_order: 1,
  },
  {
    tour_target: 'training-opportunities',
    title_ar: 'فرص التدريب',
    body_ar: 'استعرض الفرص المتاحة لجامعتك وتخصصك وقدّم طلبك.',
    related_route: '/student/field-training',
    icon: 'Briefcase',
    sort_order: 2,
  },
  {
    tour_target: 'training-sessions',
    title_ar: 'الجلسات',
    body_ar: 'تابع جدول الجلسات وروابط Zoom من تفاصيل الفرصة.',
    related_route: '/student/field-training',
    icon: 'CalendarDays',
    sort_order: 3,
  },
  {
    tour_target: 'attendance',
    title_ar: 'الحضور',
    body_ar: 'أدخل رمز الحضور داخل المنصة عند فتح النافذة؛ Zoom وحده لا يكفي.',
    related_route: '/student/field-training',
    icon: 'ClipboardCheck',
    sort_order: 4,
  },
  {
    tour_target: 'tasks',
    title_ar: 'المهمات',
    body_ar: 'ارفع الملفات ثم اضغط تسليم المهمة وانتظر رسالة النجاح.',
    related_route: '/student/field-training',
    icon: 'ListChecks',
    sort_order: 5,
  },
  {
    tour_target: 'tests',
    title_ar: 'الاختبارات',
    body_ar: 'أكمل الاختبار القبلي والبعدي وأرسل الإجابات نهائيًا قبل انتهاء الوقت.',
    related_route: '/student/field-training',
    icon: 'FileCheck',
    sort_order: 6,
  },
  {
    tour_target: 'progress',
    title_ar: 'التقدم والساعات',
    body_ar: 'راقب نسبة الإنجاز والمتطلبات المتبقية وحالة الاعتماد.',
    related_route: '/student/field-training',
    icon: 'BarChart3',
    sort_order: 7,
  },
  {
    tour_target: 'certificates',
    title_ar: 'الشهادات',
    body_ar: 'بعد اكتمال المتطلبات والاعتماد يمكنك تنزيل الشهادة والخطاب.',
    related_route: '/student/certificate',
    icon: 'Award',
    sort_order: 8,
  },
  {
    tour_target: 'user-guide',
    title_ar: 'دليل المستخدم',
    body_ar: 'ارجع إلى الدليل في أي وقت للأسئلة الشائعة وطلب الدعم.',
    related_route: '/student/user-guide',
    icon: 'BookOpen',
    sort_order: 9,
  },
];

const INSTRUCTOR_GUIDE_STEPS = [
  {
    tour_target: 'instructor-opportunities',
    title_ar: 'الفرص المسندة',
    body_ar: 'اعرض الفرص والطلاب المسندين إليك كمدرس.',
    related_route: '/instructor/field-training',
    icon: 'Briefcase',
    sort_order: 1,
  },
  {
    tour_target: 'training-sessions',
    title_ar: 'الجلسات',
    body_ar: 'راجع الجلسات وحدّث رابط Zoom عند الحاجة.',
    related_route: '/instructor/field-training',
    icon: 'CalendarDays',
    sort_order: 2,
  },
  {
    tour_target: 'attendance',
    title_ar: 'الحضور',
    body_ar: 'افتح نافذة الحضور، شارك الرمز، وعدّل الحالات يدويًا عند اللزوم.',
    related_route: '/instructor/field-training',
    icon: 'ClipboardCheck',
    sort_order: 3,
  },
  {
    tour_target: 'tasks',
    title_ar: 'المهمات والتقييم',
    body_ar: 'أدِر المهمات وراجع التسليمات والتقييم اليدوي وملاحظات AI.',
    related_route: '/instructor/field-training',
    icon: 'ListChecks',
    sort_order: 4,
  },
  {
    tour_target: 'progress',
    title_ar: 'تقارير التقدم',
    body_ar: 'تابع تقدم الطلاب المسندين إليك والمتطلبات الناقصة.',
    related_route: '/instructor/field-training',
    icon: 'BarChart3',
    sort_order: 5,
  },
];

const REVIEWER_GUIDE_STEPS = [
  {
    tour_target: 'reviewer-university',
    title_ar: 'نطاق جامعتك',
    body_ar: 'أنت مرتبط بجامعة محددة وتعرض بياناتها فقط.',
    related_route: '/reviewer',
    icon: 'Building2',
    sort_order: 1,
  },
  {
    tour_target: 'reviewer-students',
    title_ar: 'طلاب الجامعة',
    body_ar: 'اطّلع على طلاب جامعتك وتفاصيل تدريبهم دون تعديل.',
    related_route: '/reviewer',
    icon: 'Users',
    sort_order: 2,
  },
  {
    tour_target: 'attendance',
    title_ar: 'مراجعة الحضور',
    body_ar: 'راجع سجلات الحضور للقراءة فقط ضمن نطاقك.',
    related_route: '/reviewer',
    icon: 'ClipboardCheck',
    sort_order: 3,
  },
  {
    tour_target: 'tasks',
    title_ar: 'مراجعة المهمات',
    body_ar: 'اعرض المهمات والتسليمات دون اعتماد أو تعديل.',
    related_route: '/reviewer',
    icon: 'ListChecks',
    sort_order: 4,
  },
  {
    tour_target: 'progress',
    title_ar: 'التقدم والشهادات',
    body_ar: 'اعرض التقدم والساعات والتقارير والشهادات ضمن جامعتك.',
    related_route: '/reviewer',
    icon: 'BarChart3',
    sort_order: 5,
  },
];

const USER_GUIDES = [
  {
    name_ar: 'جولة التدريب الميداني للطالب',
    guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    target_role: 'student',
    steps: STUDENT_GUIDE_STEPS,
  },
  {
    name_ar: 'جولة التدريب الميداني للمدرس',
    guide_key: FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY,
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    target_role: 'instructor',
    steps: INSTRUCTOR_GUIDE_STEPS,
  },
  {
    name_ar: 'جولة التدريب الميداني لمراجع الجامعة',
    guide_key: FIELD_TRAINING_REVIEWER_GUIDE_KEY,
    guide_version: FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
    target_role: 'reviewer',
    steps: REVIEWER_GUIDE_STEPS,
  },
];

const SYSTEM_POPUPS = [
  {
    system_key: 'ACCOUNT_PENDING_ACTIVATION',
    admin_name: 'حساب بانتظار التفعيل',
    title_ar: 'حسابك بانتظار التفعيل',
    body_ar:
      'مرحبًا {{student_name}}، تم إنشاء حسابك بنجاح، وحسابك الآن قيد المراجعة والتفعيل من الإدارة. سيتم تفعيل الحساب خلال مدة لا تتجاوز {{activation_wait_hours}} ساعة (48 ساعة).',
    popup_type: 'INFO',
    display_rule: 'UNTIL_ACKNOWLEDGED',
    icon: 'Clock',
    priority: 10,
    requires_acknowledgement: true,
    is_dismissible: true,
    target_roles: ['student'],
    cta_label: 'متابعة حالة الحساب',
    cta_url: '/account-status',
  },
  {
    system_key: 'ACCOUNT_ACTIVATION_OVERDUE',
    admin_name: 'تأخر تفعيل الحساب',
    title_ar: 'تأخر تفعيل حسابك',
    body_ar:
      'مرحبًا {{student_name}}، مرّت أكثر من {{activation_wait_hours}} ساعة على طلب التفعيل. يمكنك التواصل مع الدعم لمراجعة حالة الحساب.',
    popup_type: 'WARNING',
    display_rule: 'EVERY_LOGIN',
    icon: 'AlertTriangle',
    priority: 5,
    requires_acknowledgement: true,
    is_dismissible: true,
    target_roles: ['student'],
    cta_label: 'التواصل مع الدعم',
    cta_url: '/student/user-guide/support',
  },
];

async function upsertCategories() {
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const row = await prisma.help_categories.upsert({
      where: { slug: cat.slug },
      create: {
        slug: cat.slug,
        title_ar: cat.title_ar,
        description_ar: cat.description_ar,
        icon: cat.icon,
        sort_order: cat.sort_order,
        target_roles: cat.target_roles,
        status: 'PUBLISHED',
        is_active: true,
      },
      update: {
        title_ar: cat.title_ar,
        description_ar: cat.description_ar,
        icon: cat.icon,
        sort_order: cat.sort_order,
        target_roles: cat.target_roles,
        status: 'PUBLISHED',
        is_active: true,
        updated_at: NOW(),
      },
    });
    categoryIds[cat.slug] = row.id;
  }
  return categoryIds;
}

async function upsertArticles(categoryIds) {
  let count = 0;
  for (const art of ARTICLES) {
    const category_id = categoryIds[art.category_slug];
    if (!category_id) {
      throw new Error(`Missing category for article slug=${art.slug} category=${art.category_slug}`);
    }
    const { category_slug, ...data } = art;
    const show_in_contextual = Boolean(
      data.show_in_contextual || data.related_route || data.contextual_key
    );
    await prisma.help_articles.upsert({
      where: { slug: data.slug },
      create: {
        ...data,
        category_id,
        status: 'PUBLISHED',
        is_published: true,
        version: data.version || 1,
        show_in_contextual,
        published_at: NOW(),
      },
      update: {
        category_id,
        title_ar: data.title_ar,
        summary_ar: data.summary_ar,
        content_ar: data.content_ar,
        keywords: data.keywords || [],
        sort_order: data.sort_order,
        is_published: true,
        status: 'PUBLISHED',
        version: data.version || 1,
        is_faq: Boolean(data.is_faq),
        related_route: data.related_route || null,
        contextual_key: data.contextual_key || null,
        show_in_contextual,
        guide_version: data.guide_version || null,
        target_roles: data.target_roles || ['student'],
        updated_at: NOW(),
      },
    });
    count += 1;
  }
  return count;
}

async function upsertGuideSteps(guideId, steps) {
  let upserted = 0;
  for (const step of steps) {
    const existing = await prisma.user_guide_steps.findFirst({
      where: {
        guide_id: guideId,
        tour_target: step.tour_target,
      },
    });
    const payload = {
      title_ar: step.title_ar,
      body_ar: step.body_ar,
      icon: step.icon || null,
      tour_target: step.tour_target,
      related_route: step.related_route || null,
      sort_order: step.sort_order,
      is_required: false,
      can_skip: true,
      status: 'PUBLISHED',
      updated_at: NOW(),
    };
    if (existing) {
      await prisma.user_guide_steps.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await prisma.user_guide_steps.create({
        data: {
          guide_id: guideId,
          ...payload,
        },
      });
    }
    upserted += 1;
  }
  return upserted;
}

async function upsertUserGuides() {
  let guides = 0;
  let steps = 0;
  for (const guide of USER_GUIDES) {
    const row = await prisma.user_guides.upsert({
      where: {
        guide_key_guide_version: {
          guide_key: guide.guide_key,
          guide_version: guide.guide_version,
        },
      },
      create: {
        name_ar: guide.name_ar,
        guide_key: guide.guide_key,
        guide_version: guide.guide_version,
        target_role: guide.target_role,
        status: 'PUBLISHED',
        version: 1,
        auto_show: true,
        can_skip: true,
        reshow_on_new_version: false,
        published_at: NOW(),
      },
      update: {
        name_ar: guide.name_ar,
        target_role: guide.target_role,
        status: 'PUBLISHED',
        auto_show: true,
        can_skip: true,
        updated_at: NOW(),
        published_at: NOW(),
      },
    });
    guides += 1;
    steps += await upsertGuideSteps(row.id, guide.steps);
  }
  return { guides, steps };
}

async function upsertSystemPopups() {
  let count = 0;
  for (const popup of SYSTEM_POPUPS) {
    await prisma.managed_popups.upsert({
      where: { system_key: popup.system_key },
      create: {
        ...popup,
        status: 'PUBLISHED',
        version: 1,
        published_at: NOW(),
      },
      update: {
        admin_name: popup.admin_name,
        title_ar: popup.title_ar,
        body_ar: popup.body_ar,
        popup_type: popup.popup_type,
        display_rule: popup.display_rule,
        icon: popup.icon,
        priority: popup.priority,
        requires_acknowledgement: popup.requires_acknowledgement,
        is_dismissible: popup.is_dismissible,
        target_roles: popup.target_roles,
        cta_label: popup.cta_label,
        cta_url: popup.cta_url,
        status: 'PUBLISHED',
        updated_at: NOW(),
        published_at: NOW(),
      },
    });
    count += 1;
  }
  return count;
}

async function seedHelpContent() {
  const categoryIds = await upsertCategories();
  const articles = await upsertArticles(categoryIds);
  const { guides, steps } = await upsertUserGuides();
  const popups = await upsertSystemPopups();

  return {
    categories: CATEGORIES.length,
    articles,
    guides,
    guide_steps: steps,
    popups,
  };
}

if (require.main === module) {
  seedHelpContent()
    .then((r) => {
      console.log('[seed-help] ok', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed-help] failed', err);
      process.exit(1);
    })
    .finally(async () => {
      try {
        await prisma.$disconnect();
      } catch {
        /* ignore */
      }
    });
}

module.exports = {
  seedHelpContent,
  CATEGORIES,
  ARTICLES,
  USER_GUIDES,
  SYSTEM_POPUPS,
};

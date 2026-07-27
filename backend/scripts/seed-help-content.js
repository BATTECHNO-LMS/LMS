'use strict';

/**
 * Idempotent seed for field-training student help center content.
 * Safe to re-run: upserts by slug.
 */
const { prisma } = require('../src/config/db');
const { FIELD_TRAINING_STUDENT_GUIDE_VERSION } = require('../src/modules/help/help.constants');

const CATEGORIES = [
  {
    slug: 'getting-started',
    title_ar: 'البدء باستخدام المنصة',
    description_ar: 'إنشاء الحساب، توثيق البريد، واستكمال الملف الشخصي.',
    icon: 'UserRound',
    sort_order: 1,
  },
  {
    slug: 'training-opportunities',
    title_ar: 'فرص التدريب الميداني',
    description_ar: 'كيفية إيجاد الفرص والتقديم ومتابعة حالة الطلب.',
    icon: 'Briefcase',
    sort_order: 2,
  },
  {
    slug: 'sessions-attendance',
    title_ar: 'الجلسات والحضور',
    description_ar: 'جدول الجلسات، رابط Zoom، ورمز الحضور الإلكتروني.',
    icon: 'CalendarDays',
    sort_order: 3,
  },
  {
    slug: 'tests',
    title_ar: 'الاختبارات',
    description_ar: 'الاختبار القبلي والبعدي وكيفية الإرسال النهائي.',
    icon: 'FileCheck',
    sort_order: 4,
  },
  {
    slug: 'tasks-submissions',
    title_ar: 'المهمات والتسليم',
    description_ar: 'رفع الملفات، التسليم النهائي، وأنواع التقييم.',
    icon: 'ListChecks',
    sort_order: 5,
  },
  {
    slug: 'progress-hours',
    title_ar: 'التقدم والساعات التدريبية',
    description_ar: 'نسبة الإنجاز، الساعات، والمتطلبات المتبقية.',
    icon: 'BarChart3',
    sort_order: 6,
  },
  {
    slug: 'certificates',
    title_ar: 'الشهادات والوثائق',
    description_ar: 'متى تصدر الشهادة وكيفية تنزيلها.',
    icon: 'Award',
    sort_order: 7,
  },
  {
    slug: 'common-problems',
    title_ar: 'المشاكل الشائعة',
    description_ar: 'حلول سريعة للأخطاء المتكررة.',
    icon: 'AlertTriangle',
    sort_order: 8,
  },
  {
    slug: 'support',
    title_ar: 'التواصل مع الدعم',
    description_ar: 'كيف تطلب المساعدة عند الحاجة.',
    icon: 'LifeBuoy',
    sort_order: 9,
  },
];

function article(partial) {
  return {
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    target_roles: ['student'],
    is_published: true,
    is_faq: false,
    keywords: [],
    ...partial,
  };
}

const ARTICLES = [
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
  article({
    category_slug: 'getting-started',
    slug: 'email-otp-missing',
    title_ar: 'لم يصلني رمز التحقق',
    summary_ar: 'تحقق من البريد والمجلد غير الهام ثم أعد الإرسال.',
    keywords: ['رمز', 'تحقق', 'بريد', 'otp'],
    sort_order: 2,
    is_faq: true,
    content_ar:
      'تحقق من مجلد الرسائل غير المرغوب فيها، وتأكد من إدخال البريد بشكل صحيح. انتظر مدة قصيرة ثم اطلب إعادة إرسال الرمز. إن استمرت المشكلة تواصل مع الدعم مع ذكر البريد المستخدم.',
  }),
  article({
    category_slug: 'getting-started',
    slug: 'account-inactive',
    title_ar: 'لماذا حسابي غير مفعل؟',
    summary_ar: 'الحساب يحتاج توثيق البريد وتفعيل الإدارة عند الحاجة.',
    keywords: ['حساب', 'غير مفعل', 'تفعيل'],
    sort_order: 3,
    is_faq: true,
    content_ar:
      'قد يبقى الحساب غير مفعل إذا لم يتم توثيق البريد أو إذا كانت بيانات الجامعة تحتاج مراجعة. أكمل التوثيق أولاً، ثم تواصل مع الإدارة إن استمرت الحالة.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'why-opportunity-missing',
    title_ar: 'لماذا لا تظهر لي فرصة التدريب؟',
    summary_ar: 'الظهور يعتمد على الجامعة والتخصص وحالة التسجيل.',
    keywords: ['فرصة', 'غير ظاهرة', 'تخصص', 'جامعة'],
    related_route: '/student/field-training',
    contextual_key: 'opportunities',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'قد لا تظهر الفرصة إذا: غير مخصصة لجامعتك، تخصصك غير مشمول، التسجيل لم يبدأ أو انتهى، الحساب غير مفعل، بيانات الجامعة/التخصص غير صحيحة، لديك طلب قيد المراجعة، أو الفرصة مكتملة/مغلقة. راجع ملفك الشخصي ثم قائمة فرص التدريب.',
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
      'من قائمة التدريب الميداني افتح الفرصة المناسبة، راجع الوصف والمتطلبات والمواعيد، ثم أرسل طلب التقديم. ستظهر حالة الطلب: قيد المراجعة، مقبول، مرفوض، أو حالات لاحقة بعد بدء التدريب.',
  }),
  article({
    category_slug: 'training-opportunities',
    slug: 'application-statuses',
    title_ar: 'ما معنى حالات طلب التدريب؟',
    summary_ar: 'قيد المراجعة، مقبول، مرفوض، وبدء التدريب.',
    keywords: ['طلب', 'مقبول', 'مرفوض', 'مراجعة'],
    contextual_key: 'application',
    sort_order: 3,
    content_ar:
      'قيد المراجعة: الطلب بانتظار قرار الإدارة. مقبول: يمكنك متابعة الخطوات التالية مثل الاختبار القبلي. مرفوض: راجع سبب الرفض إن وُجد. بعد القبول قد تنتقل إلى بدء التدريب ثم الإكمال وفق متطلبات الفرصة.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'how-to-mark-attendance',
    title_ar: 'كيف أسجل حضوري؟',
    summary_ar: 'أدخل رمز الحضور داخل المنصة أثناء فتح النافذة.',
    keywords: ['حضور', 'رمز', 'زوم', 'نافذة'],
    related_route: '/student/field-training',
    contextual_key: 'attendance',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'يجب أن تكون مسجلاً دخولًا داخل المنصة. فتح Zoom وحده لا يسجل الحضور. عند فتح المدرس نافذة الحضور سيظهر تنبيه لإدخال الرمز والضغط على تأكيد خلال المدة المحددة. الحالات: حاضر، غائب، متأخر، غياب بعذر، غير مؤكد.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'attendance-popup-missing',
    title_ar: 'لم تظهر نافذة الحضور',
    summary_ar: 'تأكد من تسجيل الدخول وتحديث الصفحة وأن النافذة ما زالت مفتوحة.',
    keywords: ['نافذة', 'حضور', 'لم تظهر'],
    contextual_key: 'attendance',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'حدّث الصفحة وتأكد أنك داخل حساب الطالب الصحيح وأن المدرس فتح نافذة الحضور. إذا انتهت المدة ستظهر حالتك غير مؤكدة أو غائب حسب اعتماد المسؤول. راجع المدرس إن كنت حاضرًا.',
  }),
  article({
    category_slug: 'sessions-attendance',
    slug: 'zoom-not-enough',
    title_ar: 'حضرت Zoom لكن حالتي غائب',
    summary_ar: 'الحضور يُسجَّل عبر رمز المنصة وليس عبر Zoom فقط.',
    keywords: ['زوم', 'غائب', 'حضور'],
    contextual_key: 'attendance',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'رابط Zoom للدخول إلى اللقاء فقط. تسجيل الحضور يتم بإدخال الرمز في المنصة. يمكن للمدرس تعديل الحضور يدويًا عند وجود سبب واضح.',
  }),
  article({
    category_slug: 'tests',
    slug: 'pre-post-tests',
    title_ar: 'ما الفرق بين الاختبار القبلي والبعدي؟',
    summary_ar: 'القبلي قبل التدريب والبعدي بعد استكمال المتطلبات.',
    keywords: ['اختبار', 'قبلي', 'بعدي'],
    contextual_key: 'assessments',
    related_route: '/student/field-training',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'الاختبار القبلي يقيس المستوى قبل البدء وقد يكون شرطًا لبدء التدريب وليس دائمًا نجاحًا/رسوبًا. الاختبار البعدي يتاح بعد إكمال الجلسات/المهمات وفق إعدادات الفرصة. اضغط إرسال الإجابات نهائيًا ولا تعتمد على الحفظ المؤقت فقط.',
  }),
  article({
    category_slug: 'tests',
    slug: 'cannot-start-test',
    title_ar: 'لماذا لا أستطيع بدء الاختبار؟',
    summary_ar: 'قد لا يكون منشورًا أو لم تتحقق شروط الإتاحة.',
    keywords: ['اختبار', 'غير متاح', 'بدء'],
    contextual_key: 'assessments',
    sort_order: 2,
    is_faq: true,
    content_ar:
      'تأكد أن طلبك مقبول، وأن التقييم منشور، وأنك ضمن المرحلة الصحيحة (مثلاً بعد القبول للقبلي أو بعد المتطلبات للبعدي). إن ظهر أن الوقت انتهى أو تجاوزت المحاولات المسموحة فراجع الإدارة.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'how-to-submit-task',
    title_ar: 'كيف أسلم المهمة؟',
    summary_ar: 'ارفع الملفات ثم اضغط تسليم المهمة وانتظر رسالة النجاح.',
    keywords: ['مهمة', 'تسليم', 'رفع', 'ملف'],
    contextual_key: 'tasks',
    related_route: '/student/field-training',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'افتح المهمة واقرأ التعليمات وموعد التسليم. يمكنك إضافة وصف ورفع ملفات أو رابط حسب الإعدادات. لا تغلق الصفحة أثناء الرفع. الرفع وحده لا يكفي؛ يجب الضغط على «تسليم المهمة» وظهور رسالة نجاح. ZIP قد يكون مقبولًا لكن الذكاء الاصطناعي قد لا يحلله.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'grading-modes',
    title_ar: 'أنواع تقييم المهمات',
    summary_ar: 'ذكاء اصطناعي، يدوي، أو بدون تقييم، والمهمة النهائية مستقلة.',
    keywords: ['تقييم', 'ذكاء', 'يدوي', 'نهائية'],
    contextual_key: 'tasks',
    sort_order: 2,
    content_ar:
      'التقييم بالذكاء الاصطناعي يعطي ملاحظات أولية على الملفات المدعومة. التقييم اليدوي يبقى قيد المراجعة حتى اعتماد المدرس. بدون تقييم تُحتسب مكتملة عند التسليم الناجح. صفة المهمة النهائية مستقلة عن نوع التقييم وقد تكون شرطًا للشهادة.',
  }),
  article({
    category_slug: 'tasks-submissions',
    slug: 'uploaded-not-submitted',
    title_ar: 'رفعت الملف لكن المهمة لم تُحتسب',
    summary_ar: 'تأكد من الضغط على تسليم المهمة بعد اكتمال الرفع.',
    keywords: ['رفع', 'لم تحتسب', 'تسليم'],
    contextual_key: 'tasks',
    sort_order: 3,
    is_faq: true,
    content_ar:
      'تم رفع الملف لا يعني إرسال المهمة. بعد اكتمال الرفع اضغط «تسليم المهمة». راجع حالة التسليم: لم يتم التسليم، تم التسليم، قيد المراجعة، مطلوب تعديل، مقبول، أو مرفوض.',
  }),
  article({
    category_slug: 'progress-hours',
    slug: 'progress-checklist',
    title_ar: 'كيف أتابع تقدمي والمتطلبات المتبقية؟',
    summary_ar: 'من صفحة نظرة عامة على التدريب تظهر المتطلبات مكتملة/متبقية.',
    keywords: ['تقدم', 'ساعات', 'متطلبات', 'إنجاز'],
    contextual_key: 'progress',
    related_route: '/student/field-training',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'تابع: قبول الطلب، الاختبار القبلي، الجلسات والحضور، المهمات والمهمة النهائية، الاختبار البعدي، التقييم الذاتي إن لزم، ثم اعتماد التدريب. النسبة لا تصل 100% إذا بقيت متطلبات غير معتمدة. الساعات تُحسب وفق إعدادات الفرصة والحضور المعتمد.',
  }),
  article({
    category_slug: 'certificates',
    slug: 'when-certificate-issued',
    title_ar: 'متى تصدر الشهادة؟',
    summary_ar: 'بعد اكتمال المتطلبات واعتماد الإدارة، وليست تلقائية بعد آخر جلسة.',
    keywords: ['شهادة', 'خطاب', 'إصدار'],
    contextual_key: 'certificates',
    related_route: '/student/field-training',
    sort_order: 1,
    is_faq: true,
    content_ar:
      'الشهادة أو خطاب التدريب يظهر بعد استكمال الحضور والمهمات والنتائج واعتماد الجهات المخولة. أكمل المتبقية من صفحة التقدم، وصحّح بيانات الاسم قبل الإصدار. يمكنك تنزيل الوثيقة من تبويب الإكمال عند توفرها.',
  }),
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
  article({
    category_slug: 'getting-started',
    slug: 'how-account-activation-works',
    title_ar: 'كيف يتم تفعيل الحساب؟',
    summary_ar: 'خطوات: تسجيل، توثيق بريد، مراجعة الإدارة، ثم التفعيل.',
    keywords: ['تفعيل الحساب', 'توثيق البريد', 'الإدارة'],
    related_route: '/account-status',
    contextual_key: 'account_activation_flow',
    sort_order: 20,
    is_faq: true,
    content_ar:
      'بعد إنشاء الحساب يصل رمز توثيق إلى بريدك. بعد التوثيق يدخل الحساب مرحلة مراجعة الإدارة. عادةً يتم التفعيل خلال 48 ساعة. قبل التفعيل لا يمكن الدخول إلى لوحة الطالب.',
  }),
  article({
    category_slug: 'getting-started',
    slug: 'why-account-pending-activation',
    title_ar: 'لماذا حسابي بانتظار التفعيل؟',
    summary_ar: 'الحسابات الجديدة تحتاج مراجعة إدارية قبل الدخول.',
    keywords: ['بانتظار التفعيل', 'pending'],
    related_route: '/account-status',
    contextual_key: 'account_pending_activation',
    sort_order: 21,
    is_faq: true,
    content_ar:
      'هذه حالة طبيعية للحسابات الجديدة. النظام يفصل بين إنشاء الحساب وبين اعتماد الإدارة. إذا تم توثيق البريد وما زال الحساب بانتظار التفعيل، تابع من صفحة حالة الحساب.',
  }),
  article({
    category_slug: 'common-problems',
    slug: 'activation-delayed-over-48h',
    title_ar: 'مر أكثر من 48 ساعة ولم يتم التفعيل',
    summary_ar: 'خطوات المتابعة عند تأخر التفعيل.',
    keywords: ['48 ساعة', 'تأخر التفعيل'],
    related_route: '/student/user-guide/support',
    contextual_key: 'activation_delayed_48h',
    sort_order: 12,
    is_faq: true,
    content_ar:
      'إذا تجاوزت مدة الانتظار 48 ساعة، افتح طلب دعم بعنوان \"تأخر تفعيل الحساب\". أرفق وصفًا موجزًا وتأكد من صحة البريد والجامعة والتخصص.',
  }),
];

async function seedHelpContent() {
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const row = await prisma.help_categories.upsert({
      where: { slug: cat.slug },
      create: {
        ...cat,
        target_roles: ['student'],
        is_active: true,
      },
      update: {
        title_ar: cat.title_ar,
        description_ar: cat.description_ar,
        icon: cat.icon,
        sort_order: cat.sort_order,
        is_active: true,
        updated_at: new Date(),
      },
    });
    categoryIds[cat.slug] = row.id;
  }

  for (const art of ARTICLES) {
    const category_id = categoryIds[art.category_slug];
    if (!category_id) continue;
    const { category_slug, ...data } = art;
    await prisma.help_articles.upsert({
      where: { slug: data.slug },
      create: { ...data, category_id },
      update: {
        category_id,
        title_ar: data.title_ar,
        summary_ar: data.summary_ar,
        content_ar: data.content_ar,
        keywords: data.keywords,
        sort_order: data.sort_order,
        is_published: true,
        is_faq: data.is_faq,
        related_route: data.related_route || null,
        contextual_key: data.contextual_key || null,
        guide_version: data.guide_version,
        updated_at: new Date(),
      },
    });
  }

  return {
    categories: CATEGORIES.length,
    articles: ARTICLES.length,
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
    });
}

module.exports = { seedHelpContent, CATEGORIES, ARTICLES };

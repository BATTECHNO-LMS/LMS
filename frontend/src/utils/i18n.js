/**
 * Bilingual UI helper: pick Arabic or English based on active locale (user choice).
 * @param {boolean} isArabic - `true` when `locale === 'ar'` (see `useLocale().isArabic`)
 * @param {string} ar - Arabic copy
 * @param {string} en - English copy
 */
export function tr(isArabic, ar, en) {
  return isArabic ? ar : en;
}

const AR_TO_EN = {
  'حفظ': 'Save',
  'إلغاء': 'Cancel',
  'حذف': 'Delete',
  'إضافة': 'Add',
  'تعديل': 'Edit',
  'تفاصيل': 'Details',
  'بحث': 'Search',
  'عرض': 'View',
  'الإجراءات': 'Actions',
  'الوقت': 'Time',
  'الحالة': 'Status',
  'الاستحقاق': 'Due date',
  'تاريخ التسليم': 'Submission date',
  'المستخدم': 'User',
  'المتعلّم': 'Learner',
  'العنوان': 'Title',
  'الموضوع': 'Topic',
  'المساق': 'Course',
  'الرابط': 'Link',
  'الدفعة': 'Cohort',
  'المسار': 'Track',
  'الدرجة': 'Score',
  'الدرجات': 'Grades',
  'الجلسة': 'Session',
  'الجلسات': 'Sessions',
  'الحضور': 'Attendance',
  'التقييمات': 'Assessments',
  'التسليمات': 'Submissions',
  'الأدلة': 'Evidence',
  'التقارير': 'Reports',
  'الإشعارات': 'Notifications',
  'الإعدادات': 'Settings',
  'الصفحة الرئيسية': 'Home',
  'الرئيسية': 'Home',
  'لا توجد بيانات': 'No data',
  'لم يتم العثور على سجلات مطابقة.': 'No matching records found.',
  'جاري التحميل': 'Loading',
  'تسجيل الخروج': 'Log out',
  'تسجيل الدخول': 'Sign in',
  'البريد الإلكتروني': 'Email',
  'كلمة المرور': 'Password',
  'لا يوجد محتوى بعد': 'No content yet',
  'هذه الصفحة جاهزة هيكلياً وستُربط بالواجهة الخلفية لاحقاً.':
    'This page scaffold is ready and will be connected to the backend later.',
  'سيتم عرض بيانات الوحدة هنا بعد التكامل مع الخادم.':
    'Module data will appear here after backend integration.',
  'تأكيد الحذف': 'Confirm deletion',
  'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.':
    'Are you sure you want to delete this record? This action cannot be undone.',
  'آخر تحديث': 'Last update',
  'مفتوح': 'Open',
  'تم التسليم': 'Submitted',
  'متأخر': 'Late',
  'تم التقييم': 'Graded',
  'مسودة': 'Draft',
  'الصيغة': 'Format',
  'الفترة': 'Period',
  'السنة': 'Year',
  'كل السنوات': 'All years',
  'كل الدفعات': 'All cohorts',
  'لوحة الإدارة': 'Admin dashboard',
  'لوحة المدرب': 'Instructor dashboard',
  'لوحة الطالب': 'Student dashboard',
  'لوحة المراجع الجامعي': 'Academic reviewer dashboard',
  'يُحدَّث عند الربط بالخادم': 'Updates after backend integration',
  'آخر النشاطات': 'Recent activity',
  'نشاط قريب': 'Upcoming activity',
  'مواعيد قريبة': 'Upcoming schedule',
  'آخر التحديثات': 'Latest updates',
  'بحث بالمتعلم أو الدفعة': 'Search by learner or cohort',
  'بحث بالمتعلّم': 'Search learner',
  'بحث بالدفعة أو الموضوع': 'Search by cohort or topic',
  'بحث بالمساق أو التاريخ': 'Search by course or date',
  'بحث بالتقرير': 'Search reports',
  'تسجيل الحضور لكل متعلم': 'Record attendance for each learner',
  'نوع الغياب': 'Absence type',
  'سبب الغياب': 'Absence reason',
  'بعذر': 'Excused',
  'بدون عذر': 'Unexcused',
  'حاضر': 'Present',
  'غائب': 'Absent',
  'نسبة الحضور (هذه القائمة)': 'Attendance rate (this list)',
  'حاضرون': 'Present',
  'غائبون': 'Absent',
  'جلسة محددة': 'Selected session',
  'نعم': 'Yes',
  'تصدير تقرير': 'Export report',
  'تقارير الجامعة': 'University reports',
  'التقارير المتاحة': 'Available reports',
  'عرض التسليمات': 'View submissions',
  'إدارة Rubric': 'Manage rubric',
  'بدء التصحيح': 'Start grading',
  'نشر Feedback': 'Publish feedback',
  'اسم الطالب': 'Student name',
  'وقت التسليم': 'Submission time',
  'حالة الدرجة': 'Grade status',
  'مسلّم': 'Submitted',
  'مصحّح': 'Graded',
  'بانتظار': 'Pending',
  'عرض التسليم': 'View submission',
  'تصحيح': 'Grade',
  'ملاحظات': 'Feedback',
  'جاهز للنشر': 'Ready to publish',
  'بانتظار النشر': 'Awaiting publish',
  'متوسط الدفعة': 'Cohort average',
  'طلبة': 'Students',
  'أعلى درجة': 'Top score',
  'جدول الدرجات': 'Grades table',
  'الطالب': 'Student',
  'نشر': 'Publish',
  'رفع دليل': 'Upload evidence',
  'بحث بالعنوان أو النوع': 'Search by title or type',
  'ملفات مرفوعة': 'Uploaded files',
  'مستندات': 'Documents',
  'مرفقات': 'Attachments',
  'معتمدة': 'Approved',
  'قائمة الأدلة': 'Evidence list',
  'السبب': 'Reason',
  'المستوى': 'Level',
  'مرتفع': 'High',
  'الطلبة المتعثرون': 'At-risk students',
  'قائمة المتابعة': 'Follow-up list',
  'لا توجد حالات متعثرة مسجّلة': 'No at-risk cases recorded',
  'ستُعرض الحالات عند تفعيل مؤشرات المخاطر الأكاديمية.':
    'Cases will appear here once academic risk indicators are enabled.',
  'حالات نشطة': 'Active cases',
  'يتطلب متابعة': 'Needs follow-up',
  'تنبيهات جديدة': 'New alerts',
  'مؤشرات صحة': 'Health indicators',
  'بحث بالاسم أو الدفعة': 'Search by name or cohort',
  'متابعة / تعليم': 'Follow up / Flag',
};

export function translateText(value, locale) {
  if (value == null) return value;
  const text = String(value);
  if (locale !== 'en') return text;
  return AR_TO_EN[text] ?? text;
}

const TEXT_NODE_ORIGINAL = new WeakMap();
const ATTR_ORIGINAL = new WeakMap();
let isApplyingDomTranslations = false;

function translateElementAttributes(el, locale) {
  const attrs = ['title', 'aria-label', 'placeholder'];
  const original = ATTR_ORIGINAL.get(el) ?? {};

  attrs.forEach((name) => {
    const current = el.getAttribute(name);
    if (current == null) return;
    if (!(name in original)) original[name] = current;
    const base = original[name];
    const next = locale === 'en' ? translateText(base, locale) : base;
    if (next !== current) el.setAttribute(name, next);
  });

  ATTR_ORIGINAL.set(el, original);
}

function translateTextNode(node, locale) {
  const current = node.nodeValue ?? '';
  if (!TEXT_NODE_ORIGINAL.has(node)) TEXT_NODE_ORIGINAL.set(node, current);
  const original = TEXT_NODE_ORIGINAL.get(node) ?? current;
  const next = locale === 'en' ? translateText(original, locale) : original;
  if (next !== current) node.nodeValue = next;
}

function walkAndTranslate(root, locale) {
  if (!root) return;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      translateElementAttributes(el, locale);
      const children = el.childNodes;
      for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) continue;
      translateTextNode(node, locale);
    }
  }
}

export function applyDomTranslations(locale) {
  if (typeof document === 'undefined' || !document.body) return;
  isApplyingDomTranslations = true;
  try {
    walkAndTranslate(document.body, locale);
  } finally {
    isApplyingDomTranslations = false;
  }
}

export function observeDomTranslations(locale) {
  if (typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    if (isApplyingDomTranslations) return;
    isApplyingDomTranslations = true;
    try {
      mutations.forEach((m) => {
        if (m.type === 'characterData' && m.target) {
          translateTextNode(m.target, locale);
          return;
        }
        m.addedNodes?.forEach((n) => walkAndTranslate(n, locale));
      });
    } finally {
      isApplyingDomTranslations = false;
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'aria-label', 'placeholder'],
  });

  return () => observer.disconnect();
}

/**
 * Configured Field Training track curricula for the public internship journey.
 * Major→track ownership lives in internshipJourney.taxonomy.js.
 */

import {
  MAJOR_TO_TRACK as TAXONOMY_MAJOR_TO_TRACK,
  TRACK_NOT_CONFIGURED,
  REQUIRES_REVIEW,
} from './internshipJourney.taxonomy.js';

export { TRACK_NOT_CONFIGURED, REQUIRES_REVIEW };

/** @type {Record<string, object>} */
export const TRACK_CATALOG = {
  MIS: {
    code: 'MIS',
    nameAr: 'مسار نظم المعلومات الإدارية',
    nameEn: 'Business Information Systems & Data Analytics',
    descriptionAr: 'مسار يركز على أنظمة الأعمال، التحليل، البيانات، والأتمتة العملية.',
    icon: 'systems',
    skills: ['Business Information Systems', 'Business Analysis', 'Excel', 'Databases', 'SQL', 'Power BI', 'Automation', 'n8n', 'APIs', 'Basic Web Systems'],
    curriculumModules: ['Business Information Systems', 'Business Analysis', 'Excel & Databases', 'SQL & Power BI', 'Automation, n8n & APIs', 'Basic Web Systems'],
    practicalTasks: [
      'تحليل متطلبات عمل وتحويلها إلى مواصفات نظام',
      'بناء لوحة مؤشرات بسيطة على Excel / Power BI',
      'كتابة استعلامات SQL أساسية',
      'أتمتة مهمة مكتبية باستخدام n8n أو أداة مشابهة',
      'توثيق تدفق بيانات عبر API',
    ],
    finalProject: 'Business Management Information System',
    artifacts: 'Task Board • Dashboard / System Demo • Portfolio • Training Report',
    configured: true,
    active: true,
  },
  DIGITAL_MARKETING: {
    code: 'DIGITAL_MARKETING',
    nameAr: 'مسار التسويق الرقمي',
    nameEn: 'Digital Marketing & Content Strategy',
    descriptionAr: 'مسار يركز على العلامة، المحتوى، القنوات الرقمية، والتحليل التسويقي.',
    icon: 'campaign',
    skills: ['Digital Marketing Fundamentals', 'Branding', 'Content Strategy', 'Copywriting', 'Social Media', 'Canva / Content Creation', 'Paid Ads Concepts', 'SEO', 'Analytics', 'AI for Marketing', 'CRM', 'Marketing Automation'],
    curriculumModules: ['Digital Marketing Fundamentals', 'Branding & Content Strategy', 'Social Media & Copywriting', 'Paid Ads Concepts & SEO', 'Analytics, CRM & Automation', 'AI for Marketing'],
    practicalTasks: [
      'إعداد خطة محتوى لحملة قصيرة',
      'تصميم أصول بصرية باستخدام Canva',
      'كتابة نصوص إعلانية لمنصات التواصل',
      'تحليل أداء منشورات أو حملة تجريبية',
      'إعداد قائمة جمهور وCRM مبسّط',
    ],
    finalProject: 'Complete Digital Marketing Campaign',
    artifacts: 'Campaign Brief • Content Pack • Analytics Summary • Portfolio • Training Report',
    configured: true,
    active: true,
  },
  FINANCE_BANKING: {
    code: 'FINANCE_BANKING',
    nameAr: 'مسار المالية والمصرفية',
    nameEn: 'Financial Analysis, Banking & FinTech',
    descriptionAr: 'مسار يركز على التحليل المالي، العمليات المصرفية، المخاطر، وتقنيات المالية.',
    icon: 'finance',
    skills: ['Financial Fundamentals', 'Financial Statements', 'Excel for Finance', 'Financial Analysis', 'Banking Operations', 'Credit Analysis', 'Risk Management', 'KYC / AML Awareness', 'FinTech', 'Power BI for Finance', 'AI for Finance'],
    curriculumModules: ['Financial Fundamentals', 'Financial Statements & Excel for Finance', 'Financial & Credit Analysis', 'Banking Operations', 'Risk, KYC / AML Awareness', 'FinTech, Power BI & AI for Finance'],
    practicalTasks: [
      'تحليل قوائم مالية لحالة دراسية',
      'بناء نموذج Excel للتحليل المالي',
      'إعداد ملخص ائتماني مبسّط',
      'مراجعة وعي KYC / AML لحالة تدريبية',
      'لوحة مؤشرات مالية على Power BI',
    ],
    finalProject: 'Financial Performance & Banking Analysis',
    artifacts: 'Financial Model • Analysis Memo • Dashboard • Portfolio • Training Report',
    configured: true,
    active: true,
  },
  BUSINESS_ADMINISTRATION: {
    code: 'BUSINESS_ADMINISTRATION',
    nameAr: 'مسار إدارة الأعمال',
    nameEn: 'Business Operations & Management',
    descriptionAr: 'مسار يركز على العمليات، الإدارة، المشاريع، والمبيعات مدعومة بالبيانات.',
    icon: 'operations',
    skills: ['Business Fundamentals', 'Strategic Management', 'Project Management', 'Operations Management', 'Human Resources', 'Sales & CRM', 'Finance for Managers', 'Data-Driven Management', 'Power BI Basics', 'Entrepreneurship', 'AI for Business'],
    curriculumModules: ['Business Fundamentals', 'Strategic & Operations Management', 'Project Management', 'HR, Sales & CRM', 'Finance for Managers', 'Data-Driven Management, Power BI & AI'],
    practicalTasks: [
      'تحليل عملية تشغيلية واقتراح تحسين',
      'إعداد خطة مشروع قصيرة مع معالم واضحة',
      'بناء لوحة متابعة مهام فريق',
      'سيناريو مبيعات وCRM مبسّط',
      'ملخص إداري مدعوم بمؤشرات',
    ],
    finalProject: 'Business Improvement Project',
    artifacts: 'Improvement Brief • Project Plan • Dashboard • Portfolio • Training Report',
    configured: true,
    active: true,
  },
  /** Reuses legacy Full-Stack / Software family content for IT majors. */
  SOFTWARE_DEVELOPMENT: {
    code: 'SOFTWARE_DEVELOPMENT',
    nameAr: 'مسار هندسة البرمجيات وتطوير الأنظمة',
    nameEn: 'Software Development & Information Systems',
    descriptionAr: 'مسار يركز على تطوير البرمجيات، المتطلبات، والجودة لتخصصات الحوسبة.',
    icon: 'systems',
    skills: ['User Stories', 'React / Next.js', 'API', 'Git', 'PostgreSQL', 'Quality & Release'],
    curriculumModules: ['Product & Requirements', 'Full-Stack Feature Delivery', 'Quality & Release'],
    practicalTasks: [
      'صياغة User Stories مع Acceptance Criteria',
      'بناء واجهة متجاوبة وقابلة للاستخدام',
      'إنشاء endpoint مرتبط بقاعدة البيانات',
      'إرسال Pull Request بعد الاختبار',
      'إجراء Demo و Retrospective',
    ],
    finalProject: 'Full-Stack Feature or Information System Delivery',
    artifacts: 'GitHub Repository • Task Board • Working Demo • Technical Report',
    configured: true,
    active: true,
  },
  /** Reuses legacy pentest/security family — authorized labs only. */
  CYBERSECURITY: {
    code: 'CYBERSECURITY',
    nameAr: 'مسار الأمن السيبراني',
    nameEn: 'Cybersecurity & Defensive Operations',
    descriptionAr: 'مسار أمني عملي ضمن مختبرات مصرّح بها فقط، مع تقارير وإعادة اختبار.',
    icon: 'systems',
    skills: ['Scope', 'OWASP', 'Burp Suite', 'Reporting', 'CVSS', 'Retest'],
    curriculumModules: ['Recon & Scope', 'Web Security Labs', 'Reporting & Retesting'],
    practicalTasks: [
      'كتابة Rules of Engagement ونطاق التفويض',
      'فحص ثغرات ويب ضمن مختبر مصرّح',
      'توثيق أثر كل نتيجة بأدلة منزوعة الأسرار',
      'كتابة Vulnerability Report قابلة للتنفيذ',
      'إعادة اختبار بعد المعالجة',
    ],
    finalProject: 'Authorized Web Security Assessment Report',
    artifacts: 'Written Authorization • Lab Evidence • Findings • Remediation • Retest Report',
    note: 'جميع المختبرات محلية أو ضمن أنظمة يوجد تفويض صريح لفحصها.',
    configured: true,
    active: true,
  },
  /** Reuses legacy AI / Data family. */
  DATA_AI: {
    code: 'DATA_AI',
    nameAr: 'مسار البيانات والذكاء الاصطناعي',
    nameEn: 'Data Science & AI Applications',
    descriptionAr: 'مسار يركز على تحليل البيانات، الذكاء الاصطناعي التطبيقي، وقياس الجودة.',
    icon: 'systems',
    skills: ['Python', 'SQL', 'Power BI', 'RAG', 'Embeddings', 'Evaluation'],
    curriculumModules: ['Data Cleaning & SQL', 'BI & Insights', 'AI Application Basics'],
    practicalTasks: [
      'تنظيف بيانات وكتابة استعلامات تجميع',
      'بناء Dashboard بمؤشرات أعمال',
      'بناء مساعد معرفي مبسّط مع مصادر',
      'قياس جودة الإجابات والقيود',
      'تقديم Demo مع Known Limitations',
    ],
    finalProject: 'Data / AI Application with Evaluation Notes',
    artifacts: 'Notebook / Repo • Dashboard or Demo • Technical Report',
    configured: true,
    active: true,
  },
  [TRACK_NOT_CONFIGURED]: {
    code: TRACK_NOT_CONFIGURED,
    nameAr: 'مسار قيد التجهيز',
    nameEn: 'Track Pending Configuration',
    descriptionAr: 'سيتم تجهيز المسار التدريبي المناسب لهذا التخصص.',
    icon: 'operations',
    skills: [],
    curriculumModules: ['سيتم الإعلان عن محاور التخصص قريباً'],
    practicalTasks: ['سيتم تجهيز المهام العملية بعد اعتماد المسار'],
    finalProject: 'يُحدد بعد تجهيز المسار',
    artifacts: 'Training Report',
    configured: false,
    active: true,
  },
  [REQUIRES_REVIEW]: {
    code: REQUIRES_REVIEW,
    nameAr: 'يتطلب مراجعة الفريق',
    nameEn: 'Requires Review',
    descriptionAr: 'تخصص/كلية خارج المسارات الجاهزة حالياً — سيراجع فريق eprojecto طلبك.',
    icon: 'operations',
    skills: [],
    curriculumModules: ['مراجعة يدوية من فريق التدريب'],
    practicalTasks: ['التواصل مع فريق eprojecto لاستكمال التصنيف'],
    finalProject: 'يُحدد بعد المراجعة',
    artifacts: 'Intake Review',
    configured: false,
    active: true,
  },
};

export const MAJOR_TO_TRACK = TAXONOMY_MAJOR_TO_TRACK;

export function getActiveTracks() {
  return Object.values(TRACK_CATALOG).filter((t) => t.active !== false && t.configured !== false);
}

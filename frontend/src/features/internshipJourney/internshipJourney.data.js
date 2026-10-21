export const MIN_HOURS = 80;
export const MAX_HOURS = 300;
export const HOURS_STEP = 10;
export const DEFAULT_HOURS = 160;

export const OTHER_UNIVERSITY = 'other';
export const OTHER_FACULTY = 'other';

export const ACADEMIC_PROFILE_STORAGE_KEY = 'eprojecto.internshipAcademicProfile';

export const HOURS_OPTIONS = Array.from(
  { length: (MAX_HOURS - MIN_HOURS) / HOURS_STEP + 1 },
  (_, i) => MIN_HOURS + i * HOURS_STEP
);

/** Workload distribution — scales with selected hours; not an academic grade. */
export const ALLOCATION_PERCENT = {
  foundation: 20,
  specialization: 45,
  tasks: 20,
  finalProject: 15,
};

export const WEEKLY_HOURS_MODEL = 20;
export const PASS_SCORE = 80;
export const PRACTICAL_TASKS_PREVIEW_COUNT = 8;

export const INTENSITY_BANDS = [
  { id: 'foundation', min: 80, max: 110, labelAr: 'مسار تأسيسي', labelEn: 'Foundation Track' },
  { id: 'standard', min: 120, max: 170, labelAr: 'مسار قياسي', labelEn: 'Standard Track' },
  { id: 'extended', min: 180, max: 230, labelAr: 'مسار موسّع', labelEn: 'Extended Track' },
  { id: 'advanced', min: 240, max: 300, labelAr: 'مسار تدريب ميداني متقدم', labelEn: 'Advanced Field Training Track' },
];

export const PROFESSIONAL_FOUNDATION = {
  name: 'الأساس المهني المشترك',
  title: 'Professional Foundation',
  emoji: '🎒',
  desc: 'مهارات مهنية مشتركة لكل التخصصات: تواصل، أدوات عمل، ذكاء اصطناعي للعمل، وسيرة مهنية.',
  color: '#3A5F8A',
  tags: ['Communication', 'Microsoft 365', 'Excel', 'AI for Work', 'LinkedIn'],
  skills: [
    'Workplace Communication',
    'Professional Email',
    'Microsoft 365 / Google Workspace',
    'Excel Fundamentals',
    'AI for Work',
    'Prompt Engineering',
    'CV using ATS principles',
    'LinkedIn Optimization',
    'Job Interview Preparation',
    'Time Management',
    'Teamwork',
    'Professional Reporting',
  ],
  tasks: [
    'كتابة إيميل عمل احترافي',
    'إعداد سيرة ذاتية وفق مبادئ ATS',
    'تحسين ملف LinkedIn',
    'تمرين مقابلة عمل قصيرة',
  ],
};

export const SPECIALIZATION_STAGE_STYLE = { ordinal: 'الثانية', emoji: '🧩', color: '#327D82' };
export const TASKS_STAGE_STYLE = { ordinal: 'الثالثة', emoji: '⚡', color: '#516B85' };
export const FINAL_STAGE_STYLE = { ordinal: 'الأخيرة', emoji: '🏆', color: '#C9A227' };

export const ROADMAP_LEGEND = [
  { color: '#3A5F8A', label: 'الأساس المهني 20%' },
  { color: '#327D82', label: 'التخصص 45%' },
  { color: '#516B85', label: 'المهام العملية 20%' },
  { color: '#C9A227', label: 'المشروع النهائي 15%' },
];

export const STAGE_FLOATING_ASSETS = ['🪁', '🛰️', '💡', '🎨', '🏁', '🎊'];

/** EPROJECTO final-grade weights. The pre-assessment is diagnostic and intentionally excluded. */
export const EVALUATION_WEIGHTS = [
  { key: 'attendance', percent: 20, label: '📅 الحضور' },
  { key: 'postAssessment', percent: 20, label: '🧠 الاختبار البعدي' },
  { key: 'practicalTasks', percent: 40, label: '🛠️ المهام العملية' },
  { key: 'professionalBehavior', percent: 20, label: '🤝 السلوك المهني' },
];

export const CAREER_FLOW_STEPS = [
  { title: '01 — حدد مسارك', body: 'اختر جامعتك وكليتك وتخصصك وساعات التدريب المطلوبة.', tone: 'sand' },
  { title: '02 — التحق بالتدريب', body: 'تواصل معنا وأحضر كتاب الالتحاق الجامعي إلى الشركة.', tone: 'slate' },
  { title: '03 — تدرب ونفّذ', body: 'جلسات، محاضرات مسجّلة، مهام عملية، ومراجعات مشرف.', tone: 'sage' },
  { title: '04 — سلّم ووثّق', body: 'مشروع نهائي، Portfolio، تقرير تدريب ومستندات الإكمال عند الاستحقاق.', tone: 'gold' },
];

export const OUTCOME_CARDS = [
  { icon: '🎯', title: 'تدريب ميداني متخصص', body: 'مسار مرتبط بتخصصك وعدد ساعات جامعتك.' },
  { icon: '🛠️', title: 'مهام عملية', body: 'تحديات قابلة للتسليم مع مراجعة المشرف.' },
  { icon: '🏆', title: 'مشروع نهائي', body: 'مخرج عملي يُعرض في نهاية المسار.' },
  { icon: '📁', title: 'Portfolio', body: 'ملف أعمال يوثّق ما أنجزته خلال التدريب.' },
  { icon: '📄', title: 'تقرير التدريب', body: 'توثيق تقدّم وساعات ومخرجات ضمن منصة eprojecto.' },
  { icon: '✅', title: 'مستندات الإكمال', body: 'خطابات وتقارير إكمال عند استيفاء متطلبات الجامعة والشركة.' },
];

export const ENROLLMENT_PHONES = [
  { display: '0791433341', international: '962791433341' },
  { display: '0798040280', international: '962798040280' },
];

export const WHATSAPP_NUMBER = '962791433341';
export const WHATSAPP_MESSAGE = 'مرحبا، أرغب بالالتحاق بالتدريب الميداني';
export const COMPANY_MAP_URL = 'https://maps.app.goo.gl/dGpq6DDF6xymechq7';

/** Fallback directory when the public API is unavailable. Not a second source of truth when API succeeds. */
export const FALLBACK_UNIVERSITIES = [
  'الجامعة الأردنية',
  'جامعة العلوم والتكنولوجيا الأردنية',
  'جامعة اليرموك',
  'الجامعة الهاشمية',
  'جامعة البلقاء التطبيقية',
  'جامعة آل البيت',
  'جامعة مؤتة',
  'جامعة الحسين بن طلال',
  'جامعة الطفيلة التقنية',
  'الجامعة الألمانية الأردنية',
  'جامعة الأميرة سمية للتكنولوجيا',
  'جامعة عمان الأهلية',
  'جامعة العلوم التطبيقية الخاصة',
  'جامعة الزيتونة الأردنية',
  'جامعة الإسراء',
  'جامعة عمان العربية',
  'جامعة الشرق الأوسط',
  'جامعة العقبة للتكنولوجيا',
  'جامعة جدارا',
  'جامعة فيلادلفيا',
  'جامعة الزرقاء',
];

/** @deprecated Use FALLBACK_UNIVERSITIES — kept for older imports/tests during transition. */
export const UNIVERSITIES = FALLBACK_UNIVERSITIES;

/**
 * Faculty intake options — there is no canonical Faculty model in the DB.
 * Values are intake metadata only; "other" requires a free-text name.
 */
export const FACULTY_OPTIONS = [
  { code: 'BUSINESS', labelAr: 'كلية الأعمال' },
  { code: 'IT', labelAr: 'كلية تكنولوجيا المعلومات' },
  { code: 'ECONOMICS_ADMIN', labelAr: 'كلية الاقتصاد والعلوم الإدارية' },
  { code: 'FINANCE_BANKING', labelAr: 'كلية العلوم المالية والمصرفية' },
  { code: 'ENGINEERING', labelAr: 'كلية الهندسة' },
  { code: 'SCIENCE', labelAr: 'كلية العلوم' },
  { code: 'ARTS', labelAr: 'كلية الآداب' },
  { code: OTHER_FACULTY, labelAr: 'كلية أخرى' },
];

export function phoneHref(international) {
  return `tel:+${international}`;
}

export function whatsappHref(number = WHATSAPP_NUMBER, message = WHATSAPP_MESSAGE) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildEnrollmentWhatsAppMessage(profile) {
  if (!profile) return WHATSAPP_MESSAGE;
  const lines = [
    WHATSAPP_MESSAGE,
    `الجامعة: ${profile.universityName}`,
    `الكلية: ${profile.facultyName}`,
    `التخصص: ${profile.majorLabelAr || profile.majorCode}`,
    `ساعات التدريب: ${profile.trainingHours}`,
    `المسار: ${profile.trackNameAr || profile.trackCode}`,
  ];
  return lines.join('\n');
}

/** Clip regions and entry offsets for the four logo fragments of the intro animation. */
export const LOGO_FRAGMENTS = [
  { clip: 'polygon(0 0,33% 0,33% 100%,0 100%)', tx: '-190px', ty: '-70px', rot: '-25deg', delay: '0s' },
  { clip: 'polygon(32% 0,100% 0,100% 49%,32% 49%)', tx: '200px', ty: '-150px', rot: '12deg', delay: '.24s' },
  { clip: 'polygon(32% 48%,100% 48%,100% 100%,32% 100%)', tx: '210px', ty: '120px', rot: '-10deg', delay: '.48s' },
  { clip: 'polygon(12% 0,30% 0,30% 100%,12% 100%)', tx: '-40px', ty: '155px', rot: '19deg', delay: '.7s' },
];

export const INTRO_AUTO_CLOSE_MS = 4300;
export const INTRO_FADE_MS = 900;

export const CONFETTI_PIECES = 65;
export const CONFETTI_COLORS = ['#132D4A', '#3A5F8A', '#327D82', '#C9A227', '#D5DDE8'];
export const CONFETTI_LIFETIME_MS = 3800;
export const JOURNEY_SCROLL_DELAY_MS = 170;

export const MIN_HOURS = 80;
export const MAX_HOURS = 300;
export const HOURS_STEP = 10;
export const DEFAULT_HOURS = 160;
export const DEFAULT_MAJOR = 'cs';
export const OTHER_UNIVERSITY = 'other';

export const HOURS_OPTIONS = Array.from(
  { length: (MAX_HOURS - MIN_HOURS) / HOURS_STEP + 1 },
  (_, i) => MIN_HOURS + i * HOURS_STEP
);

/** Whole-number percentages so allocation never depends on floating-point rounding. */
export const ALLOCATION_PERCENT = {
  softSkills: 10,
  commonIt: 15,
  specialized: 75,
};

/** Share of specialized hours given to each of the three track modules (last one takes the remainder). */
export const MODULE_SHARE_PERCENT = [29, 32, 39];

export const WEEKLY_HOURS_MODEL = 20;
export const PASS_SCORE = 80;

export const SOFT_SKILLS_STAGE = {
  name: 'المحطة الأولى: تجهيز حقيبتك',
  title: 'Soft Skills',
  emoji: '🎒',
  desc: 'تواصل احترافي، عمل جماعي، تنظيم الوقت، الاجتماعات والتغذية الراجعة.',
  color: '#3A5F8A',
  tags: ['Communication', 'Teamwork', 'Career Skills'],
  tasks: ['كتابة إيميل عمل احترافي', 'المشاركة في اجتماع فريق', 'إعداد Task Board شخصي'],
};

export const COMMON_IT_STAGE = {
  name: 'المحطة الثانية: أدوات المغامر',
  title: 'Common IT Toolkit',
  emoji: '🧰',
  desc: 'نتعلم فقط الأدوات المشتركة التي ستساعدك في شغلك اليومي.',
  color: '#1E5A8A',
  tags: ['Git & GitHub', 'APIs / Data', 'AI-Assisted Work'],
  tasks: ['إنشاء Repository و Pull Request', 'قراءة استجابة API', 'توثيق خطوات حل مشكلة تقنية'],
};

export const MODULE_STAGE_STYLES = [
  { ordinal: 'الثالثة', emoji: '🧩', color: '#327D82' },
  { ordinal: 'الرابعة', emoji: '⚡', color: '#516B85' },
  { ordinal: 'الخامسة', emoji: '🚀', color: '#A8861C' },
];

export const FINAL_STAGE = {
  name: 'المحطة الأخيرة: الإطلاق',
  title: 'Final Demo & Evaluation',
  emoji: '🏆',
  desc: 'عرض أعمالك أمام المشرف، مراجعة الأدلة، الاختبار البعدي وإتمام التقييم.',
  color: '#C9A227',
  tags: ['Portfolio', 'Demo', 'Post-Assessment'],
  tasks: ['تسليم الأدلة والملفات', 'تقديم Demo للمشروع', 'إكمال Post-Assessment'],
};

export const STAGE_FLOATING_ASSETS = ['🪁', '🛰️', '💡', '🎨', '🏁', '🎊'];

export const ROADMAP_LEGEND = [
  { color: '#fa83b3', label: 'المهارات المهنية 10%' },
  { color: '#6c9df2', label: 'المهارات التقنية المشتركة 15%' },
  { color: '#34c5a8', label: 'التدريب التخصصي 75%' },
];

export const PRACTICAL_TASKS_PREVIEW_COUNT = 7;

/** EPROJECTO final-grade weights. The pre-assessment is diagnostic and intentionally excluded. */
export const EVALUATION_WEIGHTS = [
  { key: 'attendance', percent: 20, label: '📅 الحضور' },
  { key: 'postAssessment', percent: 20, label: '🧠 الاختبار البعدي' },
  { key: 'practicalTasks', percent: 40, label: '🛠️ المهام العملية' },
  { key: 'professionalBehavior', percent: 20, label: '🤝 السلوك المهني' },
];

export const CAREER_FLOW_STEPS = [
  { title: '01 — اكتشف مستواك', body: 'تقييم قبلي غير محتسب، ثم تحديد خطة ملائمة لساعاتك ولمستواك.', tone: 'sand' },
  { title: '02 — اشتغل على Tickets', body: 'كل مهمة معها هدف واضح، دليل تسليم، و Acceptance Criteria.', tone: 'slate' },
  { title: '03 — خذ مراجعة المشرف', body: 'تتلقى ملاحظات وتصحيحات، وتعيد الإرسال إلى أن تحقق المطلوب.', tone: 'sage' },
  { title: '04 — سلّم Portfolio', body: 'مشروع وتوثيق و Demo واختبار بعدي وتقييم EPROJECTO.', tone: 'gold' },
];

export const ENROLLMENT_PHONES = [
  { display: '0791433341', international: '962791433341' },
  { display: '0798040280', international: '962798040280' },
];

export const WHATSAPP_NUMBER = '962791433341';
export const WHATSAPP_MESSAGE = 'مرحبا، أرغب بالالتحاق بالتدريب الميداني';
export const COMPANY_MAP_URL = 'https://maps.app.goo.gl/dGpq6DDF6xymechq7';

export function phoneHref(international) {
  return `tel:+${international}`;
}

export function whatsappHref(number = WHATSAPP_NUMBER, message = WHATSAPP_MESSAGE) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
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

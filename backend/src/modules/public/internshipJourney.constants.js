const {
  MAJOR_TO_TRACK,
  TRACK_NOT_CONFIGURED,
  REQUIRES_REVIEW,
} = require('./internshipJourney.taxonomy');

const MIN_HOURS = 80;
const MAX_HOURS = 300;
const HOURS_STEP = 10;

const HOURS_OPTIONS = Array.from(
  { length: (MAX_HOURS - MIN_HOURS) / HOURS_STEP + 1 },
  (_, i) => MIN_HOURS + i * HOURS_STEP
);

const ALLOCATION_PERCENT = {
  foundation: 20,
  specialization: 45,
  tasks: 20,
  finalProject: 15,
};

const TRACK_SUMMARIES = {
  MIS: {
    code: 'MIS',
    nameAr: 'مسار نظم المعلومات الإدارية',
    nameEn: 'Business Information Systems & Data Analytics',
    finalProject: 'Business Management Information System',
    configured: true,
  },
  DIGITAL_MARKETING: {
    code: 'DIGITAL_MARKETING',
    nameAr: 'مسار التسويق الرقمي',
    nameEn: 'Digital Marketing & Content Strategy',
    finalProject: 'Complete Digital Marketing Campaign',
    configured: true,
  },
  FINANCE_BANKING: {
    code: 'FINANCE_BANKING',
    nameAr: 'مسار المالية والمصرفية',
    nameEn: 'Financial Analysis, Banking & FinTech',
    finalProject: 'Financial Performance & Banking Analysis',
    configured: true,
  },
  BUSINESS_ADMINISTRATION: {
    code: 'BUSINESS_ADMINISTRATION',
    nameAr: 'مسار إدارة الأعمال',
    nameEn: 'Business Operations & Management',
    finalProject: 'Business Improvement Project',
    configured: true,
  },
  SOFTWARE_DEVELOPMENT: {
    code: 'SOFTWARE_DEVELOPMENT',
    nameAr: 'مسار هندسة البرمجيات وتطوير الأنظمة',
    nameEn: 'Software Development & Information Systems',
    finalProject: 'Full-Stack Feature or Information System Delivery',
    configured: true,
  },
  CYBERSECURITY: {
    code: 'CYBERSECURITY',
    nameAr: 'مسار الأمن السيبراني',
    nameEn: 'Cybersecurity & Defensive Operations',
    finalProject: 'Authorized Web Security Assessment Report',
    configured: true,
  },
  DATA_AI: {
    code: 'DATA_AI',
    nameAr: 'مسار البيانات والذكاء الاصطناعي',
    nameEn: 'Data Science & AI Applications',
    finalProject: 'Data / AI Application with Evaluation Notes',
    configured: true,
  },
  [TRACK_NOT_CONFIGURED]: {
    code: TRACK_NOT_CONFIGURED,
    nameAr: 'مسار قيد التجهيز',
    nameEn: 'Track Pending Configuration',
    finalProject: 'يُحدد بعد تجهيز المسار',
    configured: false,
  },
  [REQUIRES_REVIEW]: {
    code: REQUIRES_REVIEW,
    nameAr: 'يتطلب مراجعة الفريق',
    nameEn: 'Requires Review',
    finalProject: 'يُحدد بعد المراجعة',
    configured: false,
  },
};

const INTENSITY_BANDS = [
  { id: 'foundation', min: 80, max: 110, labelAr: 'مسار تأسيسي', labelEn: 'Foundation Track' },
  { id: 'standard', min: 120, max: 170, labelAr: 'مسار قياسي', labelEn: 'Standard Track' },
  { id: 'extended', min: 180, max: 230, labelAr: 'مسار موسّع', labelEn: 'Extended Track' },
  { id: 'advanced', min: 240, max: 300, labelAr: 'مسار تدريب ميداني متقدم', labelEn: 'Advanced Field Training Track' },
];

function isSupportedHours(hours) {
  return Number.isInteger(hours) && HOURS_OPTIONS.includes(hours);
}

function allocateHours(totalHours) {
  const foundation = Math.round((totalHours * ALLOCATION_PERCENT.foundation) / 100);
  const specialization = Math.round((totalHours * ALLOCATION_PERCENT.specialization) / 100);
  const tasks = Math.round((totalHours * ALLOCATION_PERCENT.tasks) / 100);
  const finalProject = totalHours - foundation - specialization - tasks;
  return { total: totalHours, foundation, specialization, tasks, finalProject };
}

function getIntensityBand(hours) {
  return INTENSITY_BANDS.find((band) => hours >= band.min && hours <= band.max) || null;
}

module.exports = {
  MIN_HOURS,
  MAX_HOURS,
  HOURS_STEP,
  HOURS_OPTIONS,
  ALLOCATION_PERCENT,
  MAJOR_TO_TRACK,
  TRACK_SUMMARIES,
  INTENSITY_BANDS,
  isSupportedHours,
  allocateHours,
  getIntensityBand,
};

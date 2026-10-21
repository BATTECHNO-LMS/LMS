const OTHER_FACULTY = 'OTHER';
const OTHER_MAJOR = 'OTHER';
const TRACK_NOT_CONFIGURED = 'TRACK_NOT_CONFIGURED';
const REQUIRES_REVIEW = 'REQUIRES_REVIEW';

const FACULTIES = {
  BUSINESS: {
    code: 'BUSINESS',
    labelAr: 'كلية الأعمال والعلوم الإدارية',
    active: true,
  },
  INFORMATION_TECHNOLOGY: {
    code: 'INFORMATION_TECHNOLOGY',
    labelAr: 'كلية تكنولوجيا المعلومات والحوسبة',
    active: true,
  },
  OTHER: {
    code: OTHER_FACULTY,
    labelAr: 'كلية أخرى',
    active: true,
  },
};

const MAJORS = [
  { code: 'BUSINESS_ADMINISTRATION', labelAr: 'إدارة الأعمال', facultyCode: 'BUSINESS', trackCode: 'BUSINESS_ADMINISTRATION' },
  { code: 'DIGITAL_MARKETING', labelAr: 'التسويق الرقمي', facultyCode: 'BUSINESS', trackCode: 'DIGITAL_MARKETING' },
  { code: 'MARKETING', labelAr: 'التسويق', facultyCode: 'BUSINESS', trackCode: 'DIGITAL_MARKETING' },
  { code: 'FINANCE_BANKING', labelAr: 'المالية والمصرفية', facultyCode: 'BUSINESS', trackCode: 'FINANCE_BANKING' },
  { code: 'FINANCE_BANKING_SCIENCES', labelAr: 'العلوم المالية والمصرفية', facultyCode: 'BUSINESS', trackCode: 'FINANCE_BANKING' },
  { code: 'MIS', labelAr: 'نظم المعلومات الإدارية (MIS)', facultyCode: 'BUSINESS', trackCode: 'MIS' },
  { code: 'ACCOUNTING', labelAr: 'المحاسبة', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'HUMAN_RESOURCES', labelAr: 'إدارة الموارد البشرية', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'ENTREPRENEURSHIP', labelAr: 'ريادة الأعمال', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'FINTECH', labelAr: 'التكنولوجيا المالية (FinTech)', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'BUSINESS_INTELLIGENCE', labelAr: 'ذكاء الأعمال وتحليل البيانات', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'SUPPLY_CHAIN', labelAr: 'إدارة سلاسل التوريد واللوجستيات', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'OTHER_BUSINESS', labelAr: 'تخصص آخر (أعمال)', facultyCode: 'BUSINESS', trackCode: REQUIRES_REVIEW, isOther: true },

  { code: 'COMPUTER_SCIENCE', labelAr: 'علم الحاسوب', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT' },
  { code: 'COMPUTER_SCIENCES', labelAr: 'علوم الحاسوب', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT' },
  { code: 'SOFTWARE_ENGINEERING', labelAr: 'هندسة البرمجيات', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT' },
  { code: 'COMPUTER_INFORMATION_SYSTEMS', labelAr: 'نظم المعلومات الحاسوبية', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT' },
  { code: 'BUSINESS_INFORMATION_TECHNOLOGY', labelAr: 'تكنولوجيا معلومات الأعمال', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT' },
  { code: 'CYBERSECURITY', labelAr: 'الأمن السيبراني', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY' },
  { code: 'INFORMATION_SECURITY', labelAr: 'أمن المعلومات', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY' },
  { code: 'COMPUTER_NETWORKS', labelAr: 'شبكات الحاسوب', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY' },
  { code: 'ARTIFICIAL_INTELLIGENCE', labelAr: 'الذكاء الاصطناعي', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI' },
  { code: 'DATA_SCIENCE', labelAr: 'علم البيانات', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI' },
  { code: 'AI_DATA_SCIENCE', labelAr: 'علم البيانات والذكاء الاصطناعي', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI' },
  { code: 'CLOUD_COMPUTING', labelAr: 'الحوسبة السحابية', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'XR_TECHNOLOGY', labelAr: 'الواقع الافتراضي والواقع المعزز', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: TRACK_NOT_CONFIGURED },
  { code: 'OTHER_IT', labelAr: 'تخصص آخر (تكنولوجيا)', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: REQUIRES_REVIEW, isOther: true },
];

const MAJOR_BY_CODE = Object.fromEntries(MAJORS.map((m) => [m.code, m]));
const MAJOR_TO_TRACK = Object.fromEntries(MAJORS.map((m) => [m.code, m.trackCode]));

function getMajor(code) {
  return MAJOR_BY_CODE[code] || null;
}

function isMajorAllowedForFaculty(facultyCode, majorCode) {
  if (facultyCode === OTHER_FACULTY) return majorCode === OTHER_MAJOR;
  const major = getMajor(majorCode);
  return Boolean(major && major.facultyCode === facultyCode);
}

function resolveTrackCodeForMajor(majorCode, facultyCode) {
  if (facultyCode === OTHER_FACULTY || majorCode === OTHER_MAJOR) return REQUIRES_REVIEW;
  const major = getMajor(majorCode);
  if (!major) return null;
  return major.trackCode || TRACK_NOT_CONFIGURED;
}

function getMajorsForFaculty(facultyCode) {
  if (!facultyCode || facultyCode === OTHER_FACULTY) return [];
  return MAJORS.filter((m) => m.facultyCode === facultyCode);
}

module.exports = {
  OTHER_FACULTY,
  OTHER_MAJOR,
  TRACK_NOT_CONFIGURED,
  REQUIRES_REVIEW,
  FACULTIES,
  MAJORS,
  MAJOR_TO_TRACK,
  getMajor,
  isMajorAllowedForFaculty,
  resolveTrackCodeForMajor,
  getMajorsForFaculty,
};

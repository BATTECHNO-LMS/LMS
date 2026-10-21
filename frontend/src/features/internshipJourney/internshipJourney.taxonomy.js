/**
 * Field Training academic taxonomy — single source of truth.
 * Faculty → majors; major → track. University does not own majors.
 */

export const OTHER_FACULTY = 'OTHER';
export const OTHER_MAJOR = 'OTHER';

export const TRACK_NOT_CONFIGURED = 'TRACK_NOT_CONFIGURED';
export const REQUIRES_REVIEW = 'REQUIRES_REVIEW';

/** @type {Record<string, { code: string, labelAr: string, labelEn: string, helperAr: string, aliases: string[], active: boolean }>} */
export const FACULTIES = {
  BUSINESS: {
    code: 'BUSINESS',
    labelAr: 'كلية الأعمال والعلوم الإدارية',
    labelEn: 'Business & Administrative Sciences',
    helperAr: 'اختر تخصصك ضمن مسارات الأعمال والعلوم الإدارية.',
    aliases: [
      'كلية الأعمال',
      'كلية العلوم الإدارية والمالية',
      'كلية المال والأعمال',
      'كلية الاقتصاد والعلوم الإدارية',
      'كلية الاقتصاد والأعمال',
      'كلية العلوم المالية والمصرفية',
    ],
    active: true,
  },
  INFORMATION_TECHNOLOGY: {
    code: 'INFORMATION_TECHNOLOGY',
    labelAr: 'كلية تكنولوجيا المعلومات والحوسبة',
    labelEn: 'Information Technology & Computing',
    helperAr: 'اختر تخصصك ضمن مسارات تكنولوجيا المعلومات والحوسبة.',
    aliases: [
      'كلية تكنولوجيا المعلومات',
      'كلية تقنية المعلومات',
      'كلية الحوسبة',
      'كلية علوم الحاسوب',
      'كلية العلوم الحاسوبية والمعلوماتية',
      'كلية الملك عبدالله الثاني لتكنولوجيا المعلومات',
      'كلية الملك الحسين لعلوم الحوسبة',
      'كلية العلوم وتكنولوجيا المعلومات',
    ],
    active: true,
  },
  OTHER: {
    code: OTHER_FACULTY,
    labelAr: 'كلية أخرى',
    labelEn: 'Other Faculty',
    helperAr: 'أدخل اسم كليتك وتخصصك؛ سيراجع فريق eprojecto طلبك.',
    aliases: ['كلية أخرى', 'اخرى'],
    active: true,
  },
};

/**
 * Canonical majors. facultyCode is authoritative for UI filtering and server validation.
 * trackCode null / TRACK_NOT_CONFIGURED means no curriculum configured yet.
 */
export const MAJORS = [
  // BUSINESS — configured tracks
  { code: 'BUSINESS_ADMINISTRATION', labelAr: 'إدارة الأعمال', labelEn: 'Business Administration', facultyCode: 'BUSINESS', trackCode: 'BUSINESS_ADMINISTRATION', active: true },
  { code: 'DIGITAL_MARKETING', labelAr: 'التسويق الرقمي', labelEn: 'Digital Marketing', facultyCode: 'BUSINESS', trackCode: 'DIGITAL_MARKETING', active: true },
  { code: 'MARKETING', labelAr: 'التسويق', labelEn: 'Marketing', facultyCode: 'BUSINESS', trackCode: 'DIGITAL_MARKETING', active: true },
  { code: 'FINANCE_BANKING', labelAr: 'المالية والمصرفية', labelEn: 'Finance & Banking', facultyCode: 'BUSINESS', trackCode: 'FINANCE_BANKING', active: true },
  { code: 'FINANCE_BANKING_SCIENCES', labelAr: 'العلوم المالية والمصرفية', labelEn: 'Financial & Banking Sciences', facultyCode: 'BUSINESS', trackCode: 'FINANCE_BANKING', active: true },
  { code: 'MIS', labelAr: 'نظم المعلومات الإدارية (MIS)', labelEn: 'Management Information Systems', facultyCode: 'BUSINESS', trackCode: 'MIS', active: true },
  // BUSINESS — not yet configured (never invent mapping)
  { code: 'ACCOUNTING', labelAr: 'المحاسبة', labelEn: 'Accounting', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'HUMAN_RESOURCES', labelAr: 'إدارة الموارد البشرية', labelEn: 'Human Resources', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'ENTREPRENEURSHIP', labelAr: 'ريادة الأعمال', labelEn: 'Entrepreneurship', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'FINTECH', labelAr: 'التكنولوجيا المالية (FinTech)', labelEn: 'FinTech', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'BUSINESS_INTELLIGENCE', labelAr: 'ذكاء الأعمال وتحليل البيانات', labelEn: 'Business Intelligence', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'SUPPLY_CHAIN', labelAr: 'إدارة سلاسل التوريد واللوجستيات', labelEn: 'Supply Chain & Logistics', facultyCode: 'BUSINESS', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'OTHER_BUSINESS', labelAr: 'تخصص آخر (أعمال)', labelEn: 'Other Business Major', facultyCode: 'BUSINESS', trackCode: REQUIRES_REVIEW, active: true, isOther: true },

  // IT — reuse platform technology track families
  { code: 'COMPUTER_SCIENCE', labelAr: 'علم الحاسوب', labelEn: 'Computer Science', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT', active: true },
  { code: 'COMPUTER_SCIENCES', labelAr: 'علوم الحاسوب', labelEn: 'Computer Sciences', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT', active: true },
  { code: 'SOFTWARE_ENGINEERING', labelAr: 'هندسة البرمجيات', labelEn: 'Software Engineering', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT', active: true },
  { code: 'COMPUTER_INFORMATION_SYSTEMS', labelAr: 'نظم المعلومات الحاسوبية', labelEn: 'Computer Information Systems', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT', active: true },
  { code: 'BUSINESS_INFORMATION_TECHNOLOGY', labelAr: 'تكنولوجيا معلومات الأعمال', labelEn: 'Business Information Technology', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'SOFTWARE_DEVELOPMENT', active: true },
  { code: 'CYBERSECURITY', labelAr: 'الأمن السيبراني', labelEn: 'Cybersecurity', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY', active: true },
  { code: 'INFORMATION_SECURITY', labelAr: 'أمن المعلومات', labelEn: 'Information Security', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY', active: true },
  { code: 'COMPUTER_NETWORKS', labelAr: 'شبكات الحاسوب', labelEn: 'Computer Networks', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'CYBERSECURITY', active: true },
  { code: 'ARTIFICIAL_INTELLIGENCE', labelAr: 'الذكاء الاصطناعي', labelEn: 'Artificial Intelligence', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI', active: true },
  { code: 'DATA_SCIENCE', labelAr: 'علم البيانات', labelEn: 'Data Science', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI', active: true },
  { code: 'AI_DATA_SCIENCE', labelAr: 'علم البيانات والذكاء الاصطناعي', labelEn: 'Data Science & AI', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: 'DATA_AI', active: true },
  { code: 'CLOUD_COMPUTING', labelAr: 'الحوسبة السحابية', labelEn: 'Cloud Computing', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'XR_TECHNOLOGY', labelAr: 'الواقع الافتراضي والواقع المعزز', labelEn: 'VR / AR', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: TRACK_NOT_CONFIGURED, active: true },
  { code: 'OTHER_IT', labelAr: 'تخصص آخر (تكنولوجيا)', labelEn: 'Other IT Major', facultyCode: 'INFORMATION_TECHNOLOGY', trackCode: REQUIRES_REVIEW, active: true, isOther: true },
];

export function getActiveFaculties() {
  return Object.values(FACULTIES).filter((f) => f.active !== false);
}

export function getFaculty(code) {
  return FACULTIES[code] ?? null;
}

export function getMajorsForFaculty(facultyCode) {
  if (!facultyCode || facultyCode === OTHER_FACULTY) return [];
  return MAJORS.filter((m) => m.active !== false && m.facultyCode === facultyCode);
}

export function getMajor(code) {
  return MAJORS.find((m) => m.code === code && m.active !== false) ?? null;
}

/** Server/UI guard: major must belong to faculty. */
export function isMajorAllowedForFaculty(facultyCode, majorCode) {
  if (facultyCode === OTHER_FACULTY) return majorCode === OTHER_MAJOR;
  const major = getMajor(majorCode);
  return Boolean(major && major.facultyCode === facultyCode);
}

export function resolveTrackCodeForMajor(majorCode, facultyCode) {
  if (facultyCode === OTHER_FACULTY || majorCode === OTHER_MAJOR) return REQUIRES_REVIEW;
  const major = getMajor(majorCode);
  if (!major) return null;
  return major.trackCode || TRACK_NOT_CONFIGURED;
}

/** Flat major→track map for configured + not-configured codes (never invents wrong mappings). */
export const MAJOR_TO_TRACK = Object.fromEntries(MAJORS.map((m) => [m.code, m.trackCode]));

/** @deprecated Prefer MAJORS — kept for transitional imports. */
export const ACADEMIC_MAJORS = MAJORS.map((m) => ({
  value: m.code,
  label: m.labelAr,
  labelEn: m.labelEn,
  trackCode: m.trackCode,
  facultyCode: m.facultyCode,
  active: m.active,
}));

export function getActiveMajors() {
  return ACADEMIC_MAJORS.filter((m) => m.active !== false);
}

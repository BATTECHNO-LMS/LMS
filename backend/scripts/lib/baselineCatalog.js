/**
 * Shared catalog for real baseline seed (Jordanian universities + global specialties).
 * Specialties are global — Field Training visibility uses specialty_id only.
 */

const REAL_BASELINE_MARKER = 'real_baseline=true';

/**
 * Real Jordanian universities — stored in DB; registration loads from API.
 * `name` is the canonical Arabic name (unique in universities.name).
 */
const REAL_UNIVERSITIES = [
  {
    name: 'جامعة مؤتة',
    nameEn: 'Mutah University',
    domain: 'mutah.edu.jo',
    website: 'https://www.mutah.edu.jo/',
    city: 'Karak',
    country: 'Jordan',
    contact_email: 'info@mutah.edu.jo',
  },
  {
    name: 'جامعة الطفيلة التقنية',
    nameEn: 'Tafila Technical University',
    domain: 'ttu.edu.jo',
    website: 'https://www.ttu.edu.jo/',
    city: 'Tafila',
    country: 'Jordan',
    contact_email: 'info@ttu.edu.jo',
  },
  {
    name: 'جامعة الحسين التقنية',
    nameEn: 'Al Hussein Technical University',
    domain: 'htu.edu.jo',
    website: 'https://www.htu.edu.jo/',
    city: 'Amman',
    country: 'Jordan',
    contact_email: 'info@htu.edu.jo',
  },
  {
    name: 'جامعة الزيتونة الأردنية',
    nameEn: 'Al-Zaytoonah University of Jordan',
    domain: 'zuj.edu.jo',
    website: 'https://www.zuj.edu.jo/',
    city: 'Amman',
    country: 'Jordan',
    contact_email: 'info@zuj.edu.jo',
  },
  {
    name: 'جامعة اليرموك',
    nameEn: 'Yarmouk University',
    domain: 'yu.edu.jo',
    website: 'https://www.yu.edu.jo/',
    city: 'Irbid',
    country: 'Jordan',
    contact_email: 'info@yu.edu.jo',
  },
];

const REQUIRED_ROLES = [
  { code: 'super_admin', name: 'Super Admin', scope: 'global' },
  { code: 'admin', name: 'Admin', scope: 'university', description: 'University or staff admin (scoped by primary_university_id).' },
  { code: 'instructor', name: 'Instructor', scope: 'university' },
  { code: 'student', name: 'Student', scope: 'university' },
  { code: 'academic_reviewer', name: 'Academic Reviewer', scope: 'university', description: 'Read-only university reviewer.' },
];

const SPECIALTY_CATALOG = [
  { name_ar: 'الأمن السيبراني', name_en: 'Cybersecurity', code: 'CYB' },
  { name_ar: 'هندسة البرمجيات', name_en: 'Software Engineering', code: 'SWE' },
  { name_ar: 'الذكاء الاصطناعي', name_en: 'Artificial Intelligence', code: 'AI' },
  { name_ar: 'علم البيانات', name_en: 'Data Science', code: 'DS' },
  { name_ar: 'علم الحاسوب', name_en: 'Computer Science', code: 'CS' },
  { name_ar: 'تكنولوجيا المعلومات', name_en: 'Information Technology', code: 'IT' },
  { name_ar: 'الشبكات', name_en: 'Networks', code: 'NET' },
  { name_ar: 'نظم المعلومات الحاسوبية', name_en: 'Computer Information Systems', code: 'CIS' },
  { name_ar: 'هندسة الحاسوب', name_en: 'Computer Engineering', code: 'CE' },
  { name_ar: 'نظم المعلومات الإدارية', name_en: 'Management Information Systems', code: 'MIS' },
  { name_ar: 'حوسبة الأجهزة الذكية', name_en: 'Smart Devices Computing', code: 'SMART_DEVICES_COMPUTING' },
  {
    name_ar: 'علم البيانات والذكاء الاصطناعي',
    name_en: 'Data Science and Artificial Intelligence',
    code: 'DS_AI',
  },
  {
    name_ar: 'الذكاء الاصطناعي وعلم البيانات',
    name_en: 'Artificial Intelligence and Data Science',
    code: 'AI_DS',
  },
  {
    name_ar: 'تطوير وتصميم الألعاب',
    name_en: 'Game Development and Design',
    code: 'GAME_DEV',
  },
  {
    name_ar: 'تكنولوجيا معلومات الأعمال',
    name_en: 'Business Information Technology',
    code: 'BIT',
  },
  {
    name_ar: 'الواقع الرقمي وتطوير الألعاب',
    name_en: 'Digital Reality and Game Development',
    code: 'DRGD',
  },
];

/**
 * University-specific IT programs for student registration.
 * `canonicalCode` links to SPECIALTY_CATALOG for Field Training matching.
 */
const UNIVERSITY_SPECIALTY_CATALOG = [
  {
    universityDomain: 'mutah.edu.jo',
    collegeNameAr: 'كلية تكنولوجيا المعلومات',
    collegeNameEn: 'College of Information Technology',
    programs: [
      {
        name_ar: 'علم الحاسوب',
        name_en: 'Computer Science',
        code: 'COMPUTER_SCIENCE',
        canonicalCode: 'CS',
      },
      {
        name_ar: 'أمن المعلومات والأدلة الرقمية',
        name_en: 'Information Security and Digital Forensics',
        code: 'INFORMATION_SECURITY_DIGITAL_FORENSICS',
        canonicalCode: 'CYB',
      },
      {
        name_ar: 'نظم المعلومات الحاسوبية',
        name_en: 'Computer Information Systems',
        code: 'COMPUTER_INFORMATION_SYSTEMS',
        canonicalCode: 'CIS',
      },
      {
        name_ar: 'علم البيانات والذكاء الاصطناعي',
        name_en: 'Data Science and Artificial Intelligence',
        code: 'DATA_SCIENCE_AI',
        canonicalCode: 'DS_AI',
      },
      {
        name_ar: 'هندسة البرمجيات',
        name_en: 'Software Engineering',
        code: 'SOFTWARE_ENGINEERING',
        canonicalCode: 'SWE',
      },
    ],
  },
  {
    universityDomain: 'ttu.edu.jo',
    collegeNameAr: 'كلية تكنولوجيا المعلومات والاتصالات',
    collegeNameEn: 'College of Information Technology and Communications',
    programs: [
      {
        name_ar: 'نظم المعلومات الحاسوبية',
        name_en: 'Computer Information Systems',
        code: 'COMPUTER_INFORMATION_SYSTEMS',
        canonicalCode: 'CIS',
      },
      {
        name_ar: 'حوسبة الأجهزة الذكية',
        name_en: 'Smart Devices Computing',
        code: 'SMART_DEVICES_COMPUTING',
        canonicalCode: 'SMART_DEVICES_COMPUTING',
      },
      {
        name_ar: 'الذكاء الاصطناعي وعلم البيانات',
        name_en: 'Artificial Intelligence and Data Science',
        code: 'AI_DATA_SCIENCE',
        canonicalCode: 'AI_DS',
      },
      {
        name_ar: 'الأمن السيبراني',
        name_en: 'Cybersecurity',
        code: 'CYBERSECURITY',
        canonicalCode: 'CYB',
      },
    ],
  },
  {
    universityDomain: 'htu.edu.jo',
    collegeNameAr: 'كلية الحوسبة والمعلوماتية',
    collegeNameEn: 'College of Computing and Informatics',
    programs: [
      {
        name_ar: 'علم الحاسوب',
        name_en: 'Computer Science',
        code: 'COMPUTER_SCIENCE',
        canonicalCode: 'CS',
      },
      {
        name_ar: 'الأمن السيبراني',
        name_en: 'Cybersecurity',
        code: 'CYBERSECURITY',
        canonicalCode: 'CYB',
      },
      {
        name_ar: 'علم البيانات والذكاء الاصطناعي',
        name_en: 'Data Science and Artificial Intelligence',
        code: 'DATA_SCIENCE_AI',
        canonicalCode: 'DS_AI',
      },
      {
        name_ar: 'برنامج تطوير وتصميم الألعاب',
        name_en: 'Game Development and Design',
        code: 'GAME_DEVELOPMENT_DESIGN',
        canonicalCode: 'GAME_DEV',
      },
    ],
  },
  {
    universityDomain: 'zuj.edu.jo',
    collegeNameAr: 'كلية تكنولوجيا المعلومات',
    collegeNameEn: 'College of Information Technology',
    programs: [
      {
        name_ar: 'علم حاسوب',
        name_en: 'Computer Science',
        code: 'COMPUTER_SCIENCE',
        canonicalCode: 'CS',
      },
      {
        name_ar: 'هندسة البرمجيات',
        name_en: 'Software Engineering',
        code: 'SOFTWARE_ENGINEERING',
        canonicalCode: 'SWE',
      },
      {
        name_ar: 'علم البيانات والذكاء الاصطناعي',
        name_en: 'Data Science and Artificial Intelligence',
        code: 'DATA_SCIENCE_AI',
        canonicalCode: 'DS_AI',
      },
      {
        name_ar: 'الأمن السيبراني',
        name_en: 'Cybersecurity',
        code: 'CYBERSECURITY',
        canonicalCode: 'CYB',
      },
    ],
  },
  {
    universityDomain: 'yu.edu.jo',
    collegeNameAr: 'كلية تكنولوجيا المعلومات وعلوم الحاسوب',
    collegeNameEn: 'College of Information Technology and Computer Science',
    programs: [
      {
        name_ar: 'علوم الحاسوب',
        name_en: 'Computer Science',
        code: 'COMPUTER_SCIENCE',
        canonicalCode: 'CS',
      },
      {
        name_ar: 'نظم المعلومات الحاسوبية',
        name_en: 'Computer Information Systems',
        code: 'COMPUTER_INFORMATION_SYSTEMS',
        canonicalCode: 'CIS',
      },
      {
        name_ar: 'تكنولوجيا معلومات الأعمال',
        name_en: 'Business Information Technology',
        code: 'BUSINESS_INFORMATION_TECHNOLOGY',
        canonicalCode: 'BIT',
      },
      {
        name_ar: 'الأمن السيبراني',
        name_en: 'Cybersecurity',
        code: 'CYBERSECURITY',
        canonicalCode: 'CYB',
      },
      {
        name_ar: 'علم البيانات والذكاء الاصطناعي',
        name_en: 'Data Science and Artificial Intelligence',
        code: 'DATA_SCIENCE_AI',
        canonicalCode: 'DS_AI',
      },
      {
        name_ar: 'الواقع الرقمي وتطوير الألعاب',
        name_en: 'Digital Reality and Game Development',
        code: 'DIGITAL_REALITY_GAME_DEVELOPMENT',
        canonicalCode: 'DRGD',
      },
    ],
  },
];

/**
 * University-specific programs that must not appear in registration (deactivated, not deleted).
 * Matched by university domain + code and/or Arabic name fragment.
 */
const DEACTIVATE_UNIVERSITY_SPECIALTY_RULES = [
  {
    universityDomain: 'zuj.edu.jo',
    codes: ['MATHEMATICS', 'MATH'],
    nameArIncludes: ['الرياضيات', 'رياضيات'],
  },
];

/** Demo markers — only delete records matching these safe identifiers. */
const DEMO_ANALYTICS_MARKER = 'demo_analytics=true';

const DEMO_UNIVERSITY_NAMES = ['BATTECHNO University', 'Demo LMS University'];

const DEMO_EMAIL_SUFFIXES = ['.analytics.lms', '@demo-lms.test'];

const DEMO_TRACK_PREFIXES = ['DA-TRK-', 'TTU-TRK-'];
const DEMO_MC_PREFIXES = ['DA-MC-', 'TTU-MC-'];
const DEMO_COURSE_SLUG_PREFIX = 'demo-analytics-';
const DEMO_FT_SLUG_PREFIX = 'demo-analytics-ft-';

function buildUniversityNotes({ nameEn, city, country, website }) {
  return `${REAL_BASELINE_MARKER} | en: ${nameEn} | city: ${city} | country: ${country} | website: ${website}`;
}

module.exports = {
  REAL_BASELINE_MARKER,
  REAL_UNIVERSITIES,
  REQUIRED_ROLES,
  SPECIALTY_CATALOG,
  UNIVERSITY_SPECIALTY_CATALOG,
  DEACTIVATE_UNIVERSITY_SPECIALTY_RULES,
  buildUniversityNotes,
  DEMO_ANALYTICS_MARKER,
  DEMO_UNIVERSITY_NAMES,
  DEMO_EMAIL_SUFFIXES,
  DEMO_TRACK_PREFIXES,
  DEMO_MC_PREFIXES,
  DEMO_COURSE_SLUG_PREFIX,
  DEMO_FT_SLUG_PREFIX,
};

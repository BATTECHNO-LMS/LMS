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
  { code: 'program_admin', name: 'Program Admin', scope: 'university' },
  { code: 'university_admin', name: 'University Admin', scope: 'university' },
  { code: 'academic_admin', name: 'Academic Admin', scope: 'university' },
  { code: 'qa_officer', name: 'QA Officer', scope: 'university' },
  { code: 'instructor', name: 'Instructor', scope: 'university' },
  { code: 'student', name: 'Student', scope: 'university' },
  { code: 'university_reviewer', name: 'University Reviewer', scope: 'university' },
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
  buildUniversityNotes,
  DEMO_ANALYTICS_MARKER,
  DEMO_UNIVERSITY_NAMES,
  DEMO_EMAIL_SUFFIXES,
  DEMO_TRACK_PREFIXES,
  DEMO_MC_PREFIXES,
  DEMO_COURSE_SLUG_PREFIX,
  DEMO_FT_SLUG_PREFIX,
};

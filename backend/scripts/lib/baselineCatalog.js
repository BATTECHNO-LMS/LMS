/**
 * Shared catalog for real baseline seed (Mutah University + global specialties).
 * Specialties are global — Field Training visibility uses specialty_id only.
 */

const REAL_BASELINE_MARKER = 'real_baseline=true';

const MUTAH_UNIVERSITY = {
  name: 'جامعة مؤتة',
  type: 'University',
  contact_person: 'إدارة المنصة',
  contact_email: 'info@mutah.edu.jo',
  contact_phone: null,
  status: 'active',
  partnership_state: 'active',
  notes: `${REAL_BASELINE_MARKER} | en: Mutah University | city: Karak | country: Jordan | website: https://www.mutah.edu.jo/`,
};

const MUTAH_EMAIL_DOMAIN = 'mutah.edu.jo';

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
];

/** Demo markers — only delete records matching these safe identifiers. */
const DEMO_ANALYTICS_MARKER = 'demo_analytics=true';

const DEMO_UNIVERSITY_NAMES = [
  'BATTECHNO University',
  'Tafila Technical University',
  'Demo LMS University',
];

const DEMO_EMAIL_SUFFIXES = ['.analytics.lms', '@batuni.edu', '@ttu.edu.jo', '@demo-lms.test'];

const DEMO_TRACK_PREFIXES = ['DA-TRK-', 'TTU-TRK-'];
const DEMO_MC_PREFIXES = ['DA-MC-', 'TTU-MC-'];
const DEMO_COURSE_SLUG_PREFIX = 'demo-analytics-';
const DEMO_FT_SLUG_PREFIX = 'demo-analytics-ft-';

module.exports = {
  REAL_BASELINE_MARKER,
  MUTAH_UNIVERSITY,
  MUTAH_EMAIL_DOMAIN,
  REQUIRED_ROLES,
  SPECIALTY_CATALOG,
  DEMO_ANALYTICS_MARKER,
  DEMO_UNIVERSITY_NAMES,
  DEMO_EMAIL_SUFFIXES,
  DEMO_TRACK_PREFIXES,
  DEMO_MC_PREFIXES,
  DEMO_COURSE_SLUG_PREFIX,
  DEMO_FT_SLUG_PREFIX,
};

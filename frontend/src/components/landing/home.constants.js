/** Keys under landing.features.list.<key>.* in i18n */
export const FEATURE_KEYS = [
  'usersRoles',
  'universities',
  'trainingCourses',
  'microCredentials',
  'gradesAssessments',
  'attendance',
  'fieldTraining',
  'reportsAnalytics',
];

/** Hero stat strip keys → landing.hero.stats.<key> */
export const HERO_STAT_KEYS = ['microCreds', 'universities', 'cohorts'];

/**
 * Ministries & universities for partners section + in-phone preview.
 * `logoUrl` → files in `frontend/public/partners/` (served as `/partners/...`).
 * `descriptionKey` → `landing.institutions.descriptions.<id>` in i18n.
 * @type {ReadonlyArray<{ id: string, nameKey: string, category: 'ministry' | 'university', initials: string, logoUrl: string, descriptionKey: string }>}
 */
export const PARTNER_INSTITUTIONS = [
  {
    id: 'youth',
    nameKey: 'institutions.youthMinistry',
    category: 'ministry',
    initials: 'وش',
    logoUrl: '/partners/ministry-youth-transparent.png',
    descriptionKey: 'institutions.descriptions.youth',
  },
  {
    id: 'ttu',
    nameKey: 'institutions.tafilaTech',
    category: 'university',
    initials: 'طت',
    logoUrl: '/partners/tafila-university-transparent.png',
    descriptionKey: 'institutions.descriptions.ttu',
  },
  {
    id: 'mutah',
    nameKey: 'institutions.mutah',
    category: 'university',
    initials: 'مؤ',
    logoUrl: '/partners/mutah-university-transparent.png',
    descriptionKey: 'institutions.descriptions.mutah',
  },
  {
    id: 'zay',
    nameKey: 'institutions.zaytoonah',
    category: 'university',
    initials: 'ز',
    logoUrl: '/partners/al-zaytoonah-university-transparent.png',
    descriptionKey: 'institutions.descriptions.zay',
  },
  {
    id: 'yarmouk',
    nameKey: 'institutions.yarmouk',
    category: 'university',
    initials: 'ير',
    logoUrl: '/partners/yarmouk-university-transparent.png',
    descriptionKey: 'institutions.descriptions.yarmouk',
  },
];

/** Home layout: narrow phones use simplified stack; tablet+ matches desktop (incl. hero phone). */
export const MOBILE_BREAKPOINT = '(max-width: 767px)';

/** Portal cards → landing.portals.list.<id> */
export const PORTAL_KEYS = ['admin', 'instructor', 'student', 'reviewer'];

/** Lifecycle timeline → landing.lifecycle.steps.<key> */
export const LIFECYCLE_STEP_KEYS = [
  'design',
  'cohort',
  'enrollment',
  'sessions',
  'assessments',
  'certificates',
  'verify',
];

/** Trust section → landing.trust.list.<key> */
export const TRUST_KEYS = ['rbac', 'audit', 'certificates', 'institutions'];

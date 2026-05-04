/** Keys under landing.features.list.<key>.* in i18n */
export const FEATURE_KEYS = [
  'usersRoles',
  'universities',
  'tracks',
  'microCredentials',
  'gradesAssessments',
  'attendance',
  'qualityAccreditation',
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
    logoUrl: '/partners/youth-ministry.png',
    descriptionKey: 'institutions.descriptions.youth',
  },
  {
    id: 'digital',
    nameKey: 'institutions.digitalEconomyMinistry',
    category: 'ministry',
    initials: 'رق',
    logoUrl: '/partners/digital-economy.png',
    descriptionKey: 'institutions.descriptions.digital',
  },
  {
    id: 'ttu',
    nameKey: 'institutions.tafilaTech',
    category: 'university',
    initials: 'طت',
    logoUrl: '/partners/tafila-tech.png',
    descriptionKey: 'institutions.descriptions.ttu',
  },
  {
    id: 'mutah',
    nameKey: 'institutions.mutah',
    category: 'university',
    initials: 'مؤ',
    logoUrl: '/partners/mutah.png',
    descriptionKey: 'institutions.descriptions.mutah',
  },
  {
    id: 'zay',
    nameKey: 'institutions.zaytoonah',
    category: 'university',
    initials: 'ز',
    logoUrl: '/partners/zaytoonah.png',
    descriptionKey: 'institutions.descriptions.zay',
  },
  {
    id: 'yarmouk',
    nameKey: 'institutions.yarmouk',
    category: 'university',
    initials: 'ير',
    logoUrl: '/partners/yarmouk.png',
    descriptionKey: 'institutions.descriptions.yarmouk',
  },
];

/** Home layout: narrow phones use simplified stack; tablet+ matches desktop (incl. hero phone). */
export const MOBILE_BREAKPOINT = '(max-width: 767px)';

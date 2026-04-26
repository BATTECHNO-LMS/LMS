/** Keys under landing.capabilities.items.* in i18n */
export const CAPABILITY_KEYS = [
  'usersRoles',
  'universities',
  'tracks',
  'microCredentials',
  'cohortsSessions',
  'attendanceAssessments',
  'evidenceQuality',
  'recognition',
  'certificates',
  'reportsAnalytics',
];

/** Hero stat strip keys → landing.hero.stats.<key> */
export const HERO_STAT_KEYS = ['microCreds', 'universities', 'cohorts'];

/**
 * Ministries & universities for partners section + in-phone preview.
 * @type {ReadonlyArray<{ id: string, nameKey: string, category: 'ministry' | 'university', initials: string }>}
 */
export const PARTNER_INSTITUTIONS = [
  { id: 'youth', nameKey: 'institutions.youthMinistry', category: 'ministry', initials: 'وش' },
  { id: 'digital', nameKey: 'institutions.digitalEconomyMinistry', category: 'ministry', initials: 'رق' },
  { id: 'ttu', nameKey: 'institutions.tafilaTech', category: 'university', initials: 'طت' },
  { id: 'mutah', nameKey: 'institutions.mutah', category: 'university', initials: 'مؤ' },
  { id: 'zay', nameKey: 'institutions.zaytoonah', category: 'university', initials: 'ز' },
  { id: 'yarmouk', nameKey: 'institutions.yarmouk', category: 'university', initials: 'ير' },
];

/** Home layout: narrow phones use simplified stack; tablet+ matches desktop (incl. hero phone). */
export const MOBILE_BREAKPOINT = '(max-width: 767px)';

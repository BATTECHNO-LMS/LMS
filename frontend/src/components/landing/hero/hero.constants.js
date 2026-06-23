/** @type {ReadonlyArray<{ id: string, titleKey: string, descKey: string, icon: string }>} */
export const HERO_CAPABILITY_KEYS = [
  { id: 'academic', titleKey: 'hero.cockpit.capabilities.academic.title', descKey: 'hero.cockpit.capabilities.academic.desc', icon: 'layers' },
  { id: 'assessment', titleKey: 'hero.cockpit.capabilities.assessment.title', descKey: 'hero.cockpit.capabilities.assessment.desc', icon: 'clipboard' },
  { id: 'quality', titleKey: 'hero.cockpit.capabilities.quality.title', descKey: 'hero.cockpit.capabilities.quality.desc', icon: 'shield' },
  { id: 'portals', titleKey: 'hero.cockpit.capabilities.portals.title', descKey: 'hero.cockpit.capabilities.portals.desc', icon: 'grid' },
];

/** @type {ReadonlyArray<{ id: string, labelKey: string, position: string }>} */
export const HERO_CALLOUT_KEYS = [
  { id: 'certificates', labelKey: 'hero.cockpit.callouts.certificates', position: 'hero-callout--top-start' },
  { id: 'grades', labelKey: 'hero.cockpit.callouts.grades', position: 'hero-callout--top-end' },
  { id: 'attendance', labelKey: 'hero.cockpit.callouts.attendance', position: 'hero-callout--mid-start' },
  { id: 'governance', labelKey: 'hero.cockpit.callouts.governance', position: 'hero-callout--mid-end' },
  { id: 'analytics', labelKey: 'hero.cockpit.callouts.analytics', position: 'hero-callout--bottom-start' },
];

/** @type {ReadonlyArray<{ id: string, labelKey: string, valueKey: string, bar?: number }>} */
export const HERO_STATUS_ROWS = [
  { id: 'programs', labelKey: 'hero.cockpit.systemStatus.programs', valueKey: 'hero.cockpit.systemStatus.programsValue', bar: 100 },
  { id: 'attendance', labelKey: 'hero.cockpit.systemStatus.attendance', valueKey: 'hero.cockpit.systemStatus.attendanceValue', bar: 94 },
  { id: 'certificates', labelKey: 'hero.cockpit.systemStatus.certificates', valueKey: 'hero.cockpit.systemStatus.certificatesValue', bar: 88 },
  { id: 'quality', labelKey: 'hero.cockpit.systemStatus.quality', valueKey: 'hero.cockpit.systemStatus.qualityValue', bar: 72 },
];

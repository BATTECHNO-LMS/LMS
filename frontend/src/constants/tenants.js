/**
 * Frontend-only tenant model (universities as tenants).
 * Not backend security — UI scope simulation only.
 */

/** Sentinel: global admin sees combined data across tenants */
export const TENANT_SCOPE_ALL = '__all__';

/**
 * @typedef {{ id: string, code: string, nameAr: string, nameEn: string }} Tenant
 */

/** @type {Tenant[]} */
export const TENANTS = [
  {
    id: 'uni-1',
    code: 'YU',
    nameAr: 'جامعة اليرموك',
    nameEn: 'Yarmouk University',
  },
  {
    id: 'uni-2',
    code: 'UJ',
    nameAr: 'الجامعة الأردنية',
    nameEn: 'University of Jordan',
  },
  {
    id: 'uni-3',
    code: 'PSUT',
    nameAr: 'جامعة الأميرة سمية للتكنولوجيا',
    nameEn: 'Princess Sumaya University for Technology',
  },
  {
    id: 'uni-4',
    code: 'AHU',
    nameAr: 'جامعة آل البيت',
    nameEn: 'Al al-Bayt University',
  },
  {
    id: 'uni-5',
    code: 'JUST',
    nameAr: 'جامعة العلوم والتكنولوجيا الأردنية',
    nameEn: 'Jordan University of Science and Technology',
  },
];

const BY_ID = Object.fromEntries(TENANTS.map((t) => [t.id, t]));

export function getTenantById(id) {
  return id ? BY_ID[id] ?? null : null;
}

export function getTenantName(tenant, locale) {
  if (!tenant) return '';
  const lng = String(locale || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
  return lng === 'en' ? tenant.nameEn : tenant.nameAr;
}

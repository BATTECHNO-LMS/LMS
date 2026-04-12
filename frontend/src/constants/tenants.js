/**
 * Tenant scope sentinel for global admins (UI scope only — not backend authorization).
 */
export const TENANT_SCOPE_ALL = '__all__';

/**
 * @typedef {{ id: string, code: string, nameAr: string, nameEn: string }} Tenant
 */

/**
 * @param {Tenant | null | undefined} tenant
 * @param {string} locale
 */
export function getTenantName(tenant, locale) {
  if (!tenant) return '';
  const lng = String(locale || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
  return lng === 'en' ? tenant.nameEn : tenant.nameAr;
}

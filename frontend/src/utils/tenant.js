import { TENANT_SCOPE_ALL, getTenantName } from '../constants/tenants.js';

/**
 * @param {Array<object>} rows
 * @param {string} scopeId - TENANT_SCOPE_ALL or tenant id
 * @param {string} [key='tenantId']
 */
export function filterByTenant(rows, scopeId, key = 'tenantId') {
  if (!Array.isArray(rows)) return [];
  if (!scopeId || scopeId === TENANT_SCOPE_ALL) return rows;
  return rows.filter((r) => r?.[key] === scopeId);
}

export function isAllTenantsSelected(scopeId) {
  return !scopeId || scopeId === TENANT_SCOPE_ALL;
}

/**
 * @param {string | null | undefined} scopeId
 * @param {string} locale - i18n language
 * @param {Array<{ id: string, nameAr: string, nameEn: string }>} [catalog]
 */
export function resolveTenantScopeLabel(scopeId, locale, catalog = []) {
  if (isAllTenantsSelected(scopeId)) return null;
  const t = catalog.find((x) => x.id === scopeId);
  return t ? getTenantName(t, locale) : scopeId ?? '';
}

/**
 * Returns tenant ids included in the current UI scope (for aggregations).
 * @param {string} scopeId
 */
export function resolveTenantIdsForScope(scopeId) {
  if (isAllTenantsSelected(scopeId)) {
    return null;
  }
  return [scopeId];
}

/**
 * Count rows matching scope (same as filter then length).
 */
export function countByTenant(rows, scopeId, key = 'tenantId') {
  return filterByTenant(rows, scopeId, key).length;
}

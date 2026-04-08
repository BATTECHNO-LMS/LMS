import { useMemo } from 'react';
import { useTenant } from '../features/tenant/index.js';

/**
 * Returns store rows filtered by current tenant scope (frontend simulation).
 * @param {() => object[]} getAll
 * @param {unknown[]} [extraDeps]
 */
export function useTenantScopeList(getAll, extraDeps = []) {
  const { filterRows, scopeId } = useTenant();
  return useMemo(() => filterRows(getAll()), [filterRows, scopeId, ...extraDeps]);
}

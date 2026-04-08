import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/index.js';
import { TENANTS, TENANT_SCOPE_ALL, getTenantById, getTenantName } from '../../../constants/tenants.js';
import { getStorageItem, setStorageItem, storageKeys } from '../../../utils/storage.js';
import { isAllTenantsSelected } from '../../../utils/tenant.js';

export const TenantContext = createContext(null);

function readStoredScope() {
  const raw = getStorageItem(storageKeys.tenantScope);
  if (raw == null || raw === '') return TENANT_SCOPE_ALL;
  return typeof raw === 'string' ? raw : TENANT_SCOPE_ALL;
}

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isGlobal = Boolean(user?.isGlobal);

  const [scopeId, setScopeIdState] = useState(() => {
    if (!user) return TENANT_SCOPE_ALL;
    if (!user.isGlobal) return user.tenantId || TENANT_SCOPE_ALL;
    return readStoredScope();
  });

  useEffect(() => {
    if (!user) {
      setScopeIdState(TENANT_SCOPE_ALL);
      return;
    }
    if (!user.isGlobal) {
      setScopeIdState(user.tenantId || TENANT_SCOPE_ALL);
      return;
    }
    setScopeIdState(readStoredScope());
  }, [user?.id, user?.tenantId, user?.isGlobal]);

  const setScopeId = useCallback(
    (next) => {
      if (!user?.isGlobal) return;
      const v = next === TENANT_SCOPE_ALL || next === '' ? TENANT_SCOPE_ALL : next;
      setScopeIdState(v);
      setStorageItem(storageKeys.tenantScope, v);
    },
    [user?.isGlobal]
  );

  const currentTenant = useMemo(() => {
    if (isAllTenantsSelected(scopeId)) return null;
    return getTenantById(scopeId);
  }, [scopeId]);

  const lng = i18n.language;

  const currentTenantLabel = useMemo(() => {
    if (!user) return '';
    if (user.isGlobal) {
      if (isAllTenantsSelected(scopeId)) return null;
      const t = getTenantById(scopeId);
      return t ? getTenantName(t, lng) : '';
    }
    if (user.tenantNameAr || user.tenantNameEn) {
      return String(lng || '').toLowerCase().startsWith('en') ? user.tenantNameEn : user.tenantNameAr;
    }
    const t = getTenantById(user.tenantId);
    return t ? getTenantName(t, lng) : '';
  }, [user, scopeId, lng]);

  const value = useMemo(
    () => ({
      scopeId,
      setScopeId,
      currentTenant,
      currentTenantId: user?.isGlobal ? scopeId : user?.tenantId ?? null,
      availableTenants: TENANTS,
      isGlobalTenantAccess: Boolean(user?.isGlobal),
      isAllTenantsSelected: isAllTenantsSelected(scopeId),
      currentTenantLabel,
      filterRows: (rows, key = 'tenantId') => {
        if (!Array.isArray(rows)) return [];
        if (isAllTenantsSelected(scopeId)) return rows;
        return rows.filter((r) => r?.[key] === scopeId);
      },
    }),
    [scopeId, setScopeId, currentTenant, user, currentTenantLabel]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

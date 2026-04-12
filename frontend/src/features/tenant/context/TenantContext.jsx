import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/index.js';
import { TENANT_SCOPE_ALL, getTenantName } from '../../../constants/tenants.js';
import { getStorageItem, setStorageItem, storageKeys } from '../../../utils/storage.js';
import { isAllTenantsSelected } from '../../../utils/tenant.js';
import { fetchUniversitiesList } from '../../universities/universities.service.js';

export const TenantContext = createContext(null);

function readStoredScope() {
  const raw = getStorageItem(storageKeys.tenantScope);
  if (raw == null || raw === '') return TENANT_SCOPE_ALL;
  return typeof raw === 'string' ? raw : TENANT_SCOPE_ALL;
}

function mapUniversitiesToTenants(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((u) => ({
    id: String(u.id),
    code: (String(u.name ?? '').slice(0, 4).toUpperCase() || 'UNI'),
    nameAr: String(u.name ?? ''),
    nameEn: String(u.name ?? ''),
  }));
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

  const { data: uniPayload } = useQuery({
    queryKey: ['tenant-universities-catalog'],
    queryFn: fetchUniversitiesList,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const tenantCatalog = useMemo(() => mapUniversitiesToTenants(uniPayload?.universities ?? []), [uniPayload]);

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
    return tenantCatalog.find((t) => t.id === scopeId) ?? null;
  }, [scopeId, tenantCatalog]);

  const lng = i18n.language;

  const currentTenantLabel = useMemo(() => {
    if (!user) return '';
    if (user.isGlobal) {
      if (isAllTenantsSelected(scopeId)) return null;
      const t = tenantCatalog.find((x) => x.id === scopeId);
      return t ? getTenantName(t, lng) : '';
    }
    if (user.tenantNameAr || user.tenantNameEn) {
      return String(lng || '').toLowerCase().startsWith('en') ? user.tenantNameEn : user.tenantNameAr;
    }
    const t = tenantCatalog.find((x) => x.id === user.tenantId);
    return t ? getTenantName(t, lng) : '';
  }, [user, scopeId, lng, tenantCatalog]);

  const value = useMemo(
    () => ({
      scopeId,
      setScopeId,
      currentTenant,
      currentTenantId: user?.isGlobal ? scopeId : user?.tenantId ?? null,
      availableTenants: user?.isGlobal ? tenantCatalog : [],
      tenantCatalog,
      isGlobalTenantAccess: Boolean(user?.isGlobal),
      isAllTenantsSelected: isAllTenantsSelected(scopeId),
      currentTenantLabel,
      filterRows: (rows, key = 'tenantId') => {
        if (!Array.isArray(rows)) return [];
        if (isAllTenantsSelected(scopeId)) return rows;
        return rows.filter((r) => r?.[key] === scopeId);
      },
    }),
    [scopeId, setScopeId, currentTenant, user, currentTenantLabel, tenantCatalog]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

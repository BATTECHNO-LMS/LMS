import { createContext, useCallback, useMemo, useState } from 'react';
import { login as loginRequest, logout as logoutRequest } from '../auth.service.js';
import { storageKeys, getStorageItem, setStorageItem, removeStorageItem } from '../../../utils/storage.js';
import { getDashboardPathForRole } from '../../../utils/helpers.js';
import { ROLES } from '../../../constants/roles.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';

export const AuthContext = createContext(null);

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const role = raw.role;
  const isGlobal = raw.isGlobal ?? role === ROLES.SUPER_ADMIN;
  const tenantId =
    raw.tenantId != null
      ? raw.tenantId
      : isGlobal
        ? TENANT_SCOPE_ALL
        : 'uni-1';
  return {
    ...raw,
    isGlobal,
    roles: Array.isArray(raw.roles) ? raw.roles : [role],
    tenantId,
  };
}

function readInitialUser() {
  return normalizeUser(getStorageItem(storageKeys.authUser));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readInitialUser);

  const login = useCallback(async ({ email, password, role, scenarioKey }) => {
    const { data } = await loginRequest({ email, password, role, scenarioKey });
    const { token, user: nextUser } = data;
    const normalized = normalizeUser(nextUser);
    if (token) setStorageItem(storageKeys.authToken, token);
    if (normalized) setStorageItem(storageKeys.authUser, normalized);
    setUser(normalized ?? null);
    return { redirectTo: getDashboardPathForRole(normalized?.role) };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    removeStorageItem(storageKeys.authToken);
    removeStorageItem(storageKeys.authUser);
    removeStorageItem(storageKeys.tenantScope);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

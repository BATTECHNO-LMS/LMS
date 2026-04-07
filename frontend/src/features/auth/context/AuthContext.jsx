import { createContext, useCallback, useMemo, useState } from 'react';
import { login as loginRequest, logout as logoutRequest } from '../auth.service.js';
import { storageKeys, getStorageItem, setStorageItem, removeStorageItem } from '../../../utils/storage.js';
import { getDashboardPathForRole } from '../../../utils/helpers.js';

export const AuthContext = createContext(null);

function readInitialUser() {
  return getStorageItem(storageKeys.authUser);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readInitialUser);

  const login = useCallback(async ({ email, password, role }) => {
    const { data } = await loginRequest({ email, password, role });
    const { token, user: nextUser } = data;
    if (token) setStorageItem(storageKeys.authToken, token);
    if (nextUser) setStorageItem(storageKeys.authUser, nextUser);
    setUser(nextUser ?? null);
    return { redirectTo: getDashboardPathForRole(nextUser?.role) };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    removeStorageItem(storageKeys.authToken);
    removeStorageItem(storageKeys.authUser);
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

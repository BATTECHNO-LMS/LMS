import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  login as loginRequest,
  logout as logoutRequest,
  registerStudent as registerStudentRequest,
  fetchCurrentUser,
  setActiveOrganization as setActiveOrganizationRequest,
} from '../auth.service.js';
import { mapAuthUser, pickPrimaryRole } from '../authUserMapper.js';
import { storageKeys, getStorageItem, setStorageItem, removeStorageItem } from '../../../utils/storage.js';
import { ROLES } from '../../../constants/roles.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import { setOnUnauthorized } from '../../../services/authSessionBridge.js';
import { getRememberedPortalLoginPath } from '../../../utils/portal.js';
import { resolveAuthenticatedLandingRoute } from '../../../utils/resolveAuthenticatedLandingRoute.js';
import { PORTAL_SELECTION_PATH } from '../../../constants/portalConfig.js';

export const AuthContext = createContext(null);

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mapped = mapAuthUser(raw);
  if (mapped) return mapped;
  const roles = Array.isArray(raw.roles) ? raw.roles.map(String) : [];
  const role = raw.role ? String(raw.role) : pickPrimaryRole(roles);
  const isGlobal = Boolean(raw.isGlobal ?? role === ROLES.SUPER_ADMIN);
  const primaryUniversityId = raw.primary_university_id != null ? String(raw.primary_university_id) : null;
  const tenantId = raw.tenantId != null ? String(raw.tenantId) : isGlobal ? TENANT_SCOPE_ALL : primaryUniversityId;
  return {
    ...raw,
    role,
    roles: roles.length ? roles : role ? [role] : [],
    isGlobal,
    primary_university_id: primaryUniversityId,
    tenantId,
  };
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const clearSession = useCallback(() => {
    removeStorageItem(storageKeys.authToken);
    removeStorageItem(storageKeys.authUser);
    removeStorageItem(storageKeys.tenantScope);
    setUser(null);
    qc.clear();
  }, [qc]);

  const applySession = useCallback((token, nextUser) => {
    if (token) setStorageItem(storageKeys.authToken, token);
    const normalized = normalizeUser(nextUser);
    if (normalized) setStorageItem(storageKeys.authUser, normalized);
    setUser(normalized ?? null);
  }, []);

  /** Store JWT, then load full profile from GET /api/auth/me (roles, permissions, isGlobal). */
  const persistTokenAndHydrate = useCallback(
    async (token) => {
      if (!token || typeof token !== 'string') {
        throw new Error('Missing authentication token');
      }
      setStorageItem(storageKeys.authToken, token);
      try {
        const { data } = await fetchCurrentUser();
        const normalized = normalizeUser(data?.user);
        if (normalized) {
          setStorageItem(storageKeys.authUser, normalized);
          setUser(normalized);
          return normalized;
        }
      } catch (e) {
        clearSession();
        throw e;
      }
      clearSession();
      throw new Error('Could not load user profile');
    },
    [clearSession]
  );

  const bootstrap = useCallback(async () => {
    const token = getStorageItem(storageKeys.authToken);
    const cached = getStorageItem(storageKeys.authUser);
    const normalizedCached = token && cached ? normalizeUser(cached) : null;

    if (!token) {
      setUser(null);
      setIsAuthReady(true);
      return;
    }

    // Keep a soft cache for paint, but do not mark auth ready until /me rebuilds
    // roles/org from the database (avoids stale student → trainee 403 flashes).
    if (normalizedCached) {
      setUser(normalizedCached);
    }
    setIsAuthReady(false);

    try {
      const { data } = await fetchCurrentUser();
      const normalized = normalizeUser(data?.user);
      if (normalized) {
        setStorageItem(storageKeys.authUser, normalized);
        setUser(normalized);
      } else {
        clearSession();
      }
    } catch {
      if (!normalizedCached) clearSession();
    } finally {
      setIsAuthReady(true);
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handler = () => {
      clearSession();
      setIsAuthReady(true);
      navigate(getRememberedPortalLoginPath(), { replace: true });
    };
    setOnUnauthorized(handler);
    return () => setOnUnauthorized(null);
  }, [clearSession, navigate]);

  const login = useCallback(
    async ({ email, password, portalType, preferredReturnTo } = {}) => {
      qc.clear();
      const { data } = await loginRequest({ email, password, portalType });
      const normalized = await persistTokenAndHydrate(data.token);
      setIsAuthReady(true);
      if (!normalized) {
        throw new Error('تعذر تحميل بيانات حسابك حاليًا. حاول تسجيل الدخول مرة أخرى.');
      }
      const resolution = resolveAuthenticatedLandingRoute(normalized, {
        selectedPortal: portalType || null,
        preferredReturnTo: preferredReturnTo || null,
      });
      // Portal mismatch is enforced by Backend before a token is issued.
      // Soft post-login redirects are no longer used for cross-portal access.
      return {
        redirectTo: resolution.path,
        portalMismatch: false,
        resolution,
        user: normalized,
      };
    },
    [persistTokenAndHydrate, qc]
  );

  const signUp = useCallback(
    async (payload) => {
      const { data } = await registerStudentRequest(payload);
      if (data?.token && typeof data.token === 'string') {
        const normalized = await persistTokenAndHydrate(data.token);
        qc.invalidateQueries({ queryKey: ['users'] });
        qc.invalidateQueries({ queryKey: ['universities'] });
        setIsAuthReady(true);
        const resolution = resolveAuthenticatedLandingRoute(normalized, {});
        return { redirectTo: resolution.path };
      }
      if (data?.requiresEmailVerification) {
        qc.invalidateQueries({ queryKey: ['users'] });
        qc.invalidateQueries({ queryKey: ['universities'] });
        return {
          requiresEmailVerification: true,
          email: data.email ?? payload.email,
        };
      }
      if (data?.pending_approval) {
        qc.invalidateQueries({ queryKey: ['users'] });
        qc.invalidateQueries({ queryKey: ['universities'] });
        return { pendingApproval: true };
      }
      throw new Error('Invalid registration response');
    },
    [persistTokenAndHydrate, qc]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    clearSession();
    setIsAuthReady(true);
    navigate(PORTAL_SELECTION_PATH, { replace: true });
  }, [clearSession, navigate]);

  const refreshProfile = useCallback(async () => {
    const token = getStorageItem(storageKeys.authToken);
    if (!token) return null;
    try {
      const { data } = await fetchCurrentUser();
      const normalized = normalizeUser(data?.user);
      if (normalized) {
        setStorageItem(storageKeys.authUser, normalized);
        setUser(normalized);
        return normalized;
      }
      clearSession();
      return null;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  const setActiveOrganization = useCallback(
    async (organizationId) => {
      const { data } = await setActiveOrganizationRequest(organizationId);
      const normalized = normalizeUser(data?.user);
      if (!normalized) {
        throw new Error('تعذر تحميل بيانات حسابك حاليًا. حاول تسجيل الدخول مرة أخرى.');
      }
      setStorageItem(storageKeys.authUser, normalized);
      setUser(normalized);
      qc.clear();
      return normalized;
    },
    [qc]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAuthReady,
      applySession,
      persistTokenAndHydrate,
      login,
      signUp,
      logout,
      refreshProfile,
      clearSession,
      setActiveOrganization,
    }),
    [
      user,
      isAuthReady,
      applySession,
      persistTokenAndHydrate,
      login,
      signUp,
      logout,
      refreshProfile,
      clearSession,
      setActiveOrganization,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

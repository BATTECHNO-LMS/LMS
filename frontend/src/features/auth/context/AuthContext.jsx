import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getRememberedPortalLoginPath, portalTypeFromToken } from '../../../utils/portal.js';
import { resolveAuthenticatedLandingRoute } from '../../../utils/resolveAuthenticatedLandingRoute.js';
import { PORTAL_SELECTION_PATH } from '../../../constants/portalConfig.js';
import { endCurrentSession } from '../session/sessionApi.js';
import { SessionManager } from '../session/SessionManager.jsx';
import { StepUpProvider } from '../mfa/components/StepUpProvider.jsx';
import { getSecurityPathForUser } from '../../../utils/securityPath.js';
import {
  AUTH_CHANNEL_NAME,
  LAST_ACTIVITY_PING_STORAGE_KEY,
  LAST_ACTIVITY_STORAGE_KEY,
  LOGOUT_REASON_STORAGE_KEY,
  RETURN_TO_STORAGE_KEY,
  authBroadcastEvent,
  loginPathWithReason,
  sanitizeReturnTo,
} from '../session/sessionPolicy.js';

export const AuthContext = createContext(null);

function openAuthChannel() {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return null;
  try {
    return new window.BroadcastChannel(AUTH_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function rememberReturnTo() {
  if (typeof window === 'undefined') return;
  const current = `${window.location.pathname}${window.location.search}`;
  const safe = sanitizeReturnTo(current);
  try {
    if (safe) window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, safe);
  } catch {
    /* ignore */
  }
}

function clearActivityMarkers() {
  try {
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_PING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

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

  const channelRef = useRef(null);
  const endingRef = useRef(false);
  const userRef = useRef(null);
  userRef.current = user;
  /** Portal of the signed-in session, kept per tab: another tab may clear the shared token first. */
  const portalRef = useRef(null);
  useEffect(() => {
    if (user) portalRef.current = portalTypeFromToken(getStorageItem(storageKeys.authToken)) ?? portalRef.current;
  }, [user]);

  const clearSession = useCallback(() => {
    removeStorageItem(storageKeys.authToken);
    removeStorageItem(storageKeys.authUser);
    removeStorageItem(storageKeys.tenantScope);
    clearActivityMarkers();
    setUser(null);
    qc.clear();
  }, [qc]);

  const broadcastLogout = useCallback((reason) => {
    try {
      window.localStorage.setItem(LOGOUT_REASON_STORAGE_KEY, String(reason || 'SESSION_ENDED'));
    } catch {
      /* ignore */
    }
    try {
      channelRef.current?.postMessage({
        type: 'logout',
        event: authBroadcastEvent(reason),
        reason: reason || 'SESSION_ENDED',
      });
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Local end of an already-ended (or rejected) session: clear auth, inform other tabs,
   * and send the user to the right portal login with the reason. Never renews silently.
   */
  const expireSession = useCallback(
    (code, { broadcast = true } = {}) => {
      const hadSession = Boolean(userRef.current) || Boolean(getStorageItem(storageKeys.authToken));
      if (!hadSession || endingRef.current) return;
      endingRef.current = true;
      const portalType = portalTypeFromToken(getStorageItem(storageKeys.authToken)) ?? portalRef.current;
      rememberReturnTo();
      if (broadcast) broadcastLogout(code);
      clearSession();
      setIsAuthReady(true);
      navigate(loginPathWithReason(getRememberedPortalLoginPath(portalType), code || 'SESSION_ENDED'), {
        replace: true,
      });
    },
    [broadcastLogout, clearSession, navigate]
  );

  useEffect(() => {
    const channel = openAuthChannel();
    channelRef.current = channel;
    function onMessage(event) {
      if (event?.data?.type === 'logout') expireSession(event.data.reason, { broadcast: false });
    }
    function onStorage(event) {
      if (event.key !== storageKeys.authToken || event.newValue != null) return;
      let reason = 'SESSION_ENDED';
      try {
        reason = window.localStorage.getItem(LOGOUT_REASON_STORAGE_KEY) || reason;
      } catch {
        /* ignore */
      }
      expireSession(reason, { broadcast: false });
    }
    channel?.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
  }, [expireSession]);

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
      endingRef.current = false;
      try {
        window.localStorage.removeItem(LOGOUT_REASON_STORAGE_KEY);
      } catch {
        /* ignore */
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
    setOnUnauthorized((code) => expireSession(code || 'UNAUTHORIZED'));
    return () => setOnUnauthorized(null);
  }, [expireSession]);

  /** Token issued (password-only or after MFA) → hydrate profile → landing route. */
  const completeLogin = useCallback(
    async (token, { portalType, preferredReturnTo } = {}) => {
      const normalized = await persistTokenAndHydrate(token);
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
    [persistTokenAndHydrate]
  );

  /**
   * Password step. MFA accounts get `{ mfa }` (challenge, no token) and must finish through
   * the MFA screen, which then calls `completeLogin(token)`.
   */
  const login = useCallback(
    async ({ email, password, portalType, preferredReturnTo } = {}) => {
      qc.clear();
      const { data } = await loginRequest({ email, password, portalType });
      if (data?.mfa) return { mfa: data.mfa };
      return completeLogin(data.token, { portalType, preferredReturnTo });
    },
    [completeLogin, qc]
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

  /** "إنهاء الجلسة": end the server session first so the current JWT is rejected afterwards. */
  const logout = useCallback(async () => {
    endingRef.current = true;
    try {
      await endCurrentSession('USER_LOGOUT');
    } catch {
      await logoutRequest();
    }
    broadcastLogout('USER_LOGOUT');
    clearSession();
    setIsAuthReady(true);
    navigate(PORTAL_SELECTION_PATH, { replace: true });
  }, [broadcastLogout, clearSession, navigate]);

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
      completeLogin,
      signUp,
      logout,
      refreshProfile,
      clearSession,
      expireSession,
      setActiveOrganization,
    }),
    [
      user,
      isAuthReady,
      applySession,
      persistTokenAndHydrate,
      login,
      completeLogin,
      signUp,
      logout,
      refreshProfile,
      clearSession,
      expireSession,
      setActiveOrganization,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user ? <SessionManager onExpire={expireSession} onLogout={logout} /> : null}
      {user ? <StepUpProvider securityPath={getSecurityPathForUser(user)} /> : null}
    </AuthContext.Provider>
  );
}

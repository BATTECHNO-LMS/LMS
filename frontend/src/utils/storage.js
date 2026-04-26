const PREFIX = 'battechno_lms_';

export const storageKeys = {
  authToken: `${PREFIX}auth_token`,
  authUser: `${PREFIX}auth_user`,
  locale: `${PREFIX}locale`,
  /** Active tenant scope for global (multi-tenant) users — frontend simulation only */
  tenantScope: `${PREFIX}tenant_scope`,
};

/** Legacy key from removed dark-mode toggle; cleared on app boot in providers */
export const LEGACY_THEME_STORAGE_KEY = `${PREFIX}theme`;

export function getStorageItem(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStorageItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key) {
  localStorage.removeItem(key);
}

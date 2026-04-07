const PREFIX = 'battechno_lms_';

export const storageKeys = {
  authToken: `${PREFIX}auth_token`,
  authUser: `${PREFIX}auth_user`,
};

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

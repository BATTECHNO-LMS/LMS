import { getStorageItem, setStorageItem, storageKeys } from './storage.js';

export const SUPPORTED_THEMES = ['light', 'dark'];
export const DEFAULT_THEME = 'light';

export function normalizeTheme(value) {
  const v = String(value || '').toLowerCase();
  return SUPPORTED_THEMES.includes(v) ? v : DEFAULT_THEME;
}

function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme() {
  const stored = getStorageItem(storageKeys.theme);
  if (stored) return normalizeTheme(stored);
  return getSystemTheme();
}

export function setStoredTheme(theme) {
  setStorageItem(storageKeys.theme, normalizeTheme(theme));
}

export function applyDocumentTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', normalizeTheme(theme));
}

import { getStorageItem, setStorageItem, storageKeys } from './storage.js';

export const SUPPORTED_LOCALES = ['ar', 'en'];
export const DEFAULT_LOCALE = 'ar';

const LOCALE_META = {
  ar: { lang: 'ar', dir: 'rtl' },
  en: { lang: 'en', dir: 'ltr' },
};

export function normalizeLocale(value) {
  if (!value) return DEFAULT_LOCALE;
  const v = String(value).toLowerCase();
  if (v.startsWith('ar')) return 'ar';
  if (v.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

export function getStoredLocale() {
  return normalizeLocale(getStorageItem(storageKeys.locale));
}

export function setStoredLocale(locale) {
  setStorageItem(storageKeys.locale, normalizeLocale(locale));
}

export function getLocaleMeta(locale) {
  return LOCALE_META[normalizeLocale(locale)] ?? LOCALE_META[DEFAULT_LOCALE];
}

export function getCurrentLocale() {
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    return normalizeLocale(document.documentElement.lang);
  }
  return getStoredLocale();
}

export function applyDocumentLocale(locale) {
  if (typeof document === 'undefined') return;
  const next = getLocaleMeta(locale);
  document.documentElement.lang = next.lang;
  document.documentElement.dir = next.dir;
  if (document.body) {
    document.body.setAttribute('dir', next.dir);
    document.body.setAttribute('lang', next.lang);
  }
}

export function formatNumber(value, locale = getCurrentLocale(), options = {}) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(n);
}

export function formatDate(value, locale = getCurrentLocale(), options = {}) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value ?? '');
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(d);
}

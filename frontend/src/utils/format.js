import i18n from '../i18n/config.js';
import { formatDate as formatDateLocale, formatNumber as formatNumberLocale, normalizeLocale } from './locale.js';

/** Date formatted for the active UI language (react-i18next). */
export function formatDate(value, options = {}) {
  return formatDateLocale(value, normalizeLocale(i18n.language), options);
}

/** Number formatted for the active UI language. */
export function formatNumber(value, options = {}) {
  return formatNumberLocale(value, normalizeLocale(i18n.language), options);
}

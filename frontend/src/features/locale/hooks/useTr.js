import { useMemo } from 'react';
import { tr } from '../../../utils/i18n.js';
import { useLocale } from './useLocale.js';

/**
 * Returns a translator bound to the current UI locale (from user choice in header/settings).
 * - Arabic UI → first argument
 * - English UI → second argument
 *
 * @example
 * const t = useTr();
 * <h1>{t('إدارة المستخدمين', 'User management')}</h1>
 */
export function useTr() {
  const { isArabic } = useLocale();
  return useMemo(() => (ar, en) => tr(isArabic, ar, en), [isArabic]);
}

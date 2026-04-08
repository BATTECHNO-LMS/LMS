import { createContext, useEffect, useMemo, useState } from 'react';
import i18n from '../../../i18n/config.js';
import { getLocaleMeta, normalizeLocale } from '../../../utils/locale.js';

export const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => normalizeLocale(i18n.language));

  useEffect(() => {
    const handler = (lng) => setLocaleState(normalizeLocale(lng));
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const setLocale = (nextLocale) => {
    void i18n.changeLanguage(normalizeLocale(nextLocale));
  };

  const value = useMemo(() => {
    const meta = getLocaleMeta(locale);
    return {
      locale,
      dir: meta.dir,
      lang: meta.lang,
      isArabic: locale === 'ar',
      setLocale,
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

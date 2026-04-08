import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';
import { normalizeLocale } from '../../utils/locale.js';

/**
 * Global language switch: Arabic (default) / English. Persists via i18next + localStorage.
 */
export function LanguageSwitcher({ className }) {
  const { i18n, t } = useTranslation('common');
  const lng = normalizeLocale(i18n.language);

  return (
    <select
      className={cn('app-header__lang-btn app-header__lang-select', className)}
      value={lng}
      aria-label={t('language.choose')}
      onChange={(e) => {
        void i18n.changeLanguage(normalizeLocale(e.target.value));
      }}
    >
      <option value="ar">{t('language.arabic')}</option>
      <option value="en">{t('language.english')}</option>
    </select>
  );
}

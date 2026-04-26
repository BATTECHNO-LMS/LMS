import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { normalizeLocale } from '../../utils/locale.js';

/**
 * Global language switch: Arabic (default) / English. Persists via i18next + localStorage.
 * @param {{ className?: string, compact?: boolean }} props
 */
export function LanguageSwitcher({ className, compact = false }) {
  const { i18n, t } = useTranslation('common');
  const lng = normalizeLocale(i18n.language);

  if (compact) {
    const next = lng === 'ar' ? 'en' : 'ar';
    return (
      <button
        type="button"
        className={cn('app-header__lang-icon-btn', className)}
        aria-label={t('language.choose')}
        title={lng === 'ar' ? t('language.switchToEn') : t('language.switchToAr')}
        onClick={() => void i18n.changeLanguage(next)}
      >
        <Globe size={20} strokeWidth={2} aria-hidden />
        <span className="app-header__lang-icon-btn-code" aria-hidden>
          {lng === 'ar' ? 'ع' : 'EN'}
        </span>
      </button>
    );
  }

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

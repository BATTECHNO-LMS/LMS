import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function LoadingSpinner({ label = 'جاري التحميل', className }) {
  const { locale } = useLocale();
  return (
    <div className={cn('loading-spinner', className)} role="status" aria-live="polite">
      <span className="loading-spinner__ring" aria-hidden />
      <span className="loading-spinner__label">{typeof label === 'string' ? translateText(label, locale) : label}</span>
    </div>
  );
}

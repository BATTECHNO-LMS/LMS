import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function StatCard({ label, value, hint, icon: Icon, className }) {
  const { locale } = useLocale();
  return (
    <article className={cn('stat-card', className)}>
      <div className="stat-card__top">
        <p className="stat-card__label">{typeof label === 'string' ? translateText(label, locale) : label}</p>
        {Icon ? (
          <span className="stat-card__icon-wrap" aria-hidden>
            <Icon className="stat-card__icon" size={20} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="stat-card__value">{value}</p>
      {hint ? <p className="stat-card__hint">{typeof hint === 'string' ? translateText(hint, locale) : hint}</p> : null}
    </article>
  );
}

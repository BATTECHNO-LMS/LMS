import { cn } from '../../utils/helpers.js';

export function StatCard({ label, value, hint, icon: Icon, className }) {
  return (
    <article className={cn('stat-card', className)}>
      <div className="stat-card__top">
        <p className="stat-card__label">{label}</p>
        {Icon ? (
          <span className="stat-card__icon-wrap" aria-hidden>
            <Icon className="stat-card__icon" size={20} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="stat-card__value">{value}</p>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </article>
  );
}

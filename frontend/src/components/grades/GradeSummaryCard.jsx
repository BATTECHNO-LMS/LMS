import { cn } from '../../utils/helpers.js';

export function GradeSummaryCard({ label, value, hint, icon: Icon, className }) {
  return (
    <article className={cn('grade-summary-card', className)}>
      <div className="grade-summary-card__top">
        <p className="grade-summary-card__label">{label}</p>
        {Icon ? (
          <span className="grade-summary-card__icon-wrap" aria-hidden>
            <Icon className="grade-summary-card__icon" size={20} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="grade-summary-card__value">{value}</p>
      {hint ? <p className="grade-summary-card__hint">{hint}</p> : null}
    </article>
  );
}

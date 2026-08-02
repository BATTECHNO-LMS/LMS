import { cn } from '../../../utils/helpers.js';

/**
 * Compact metric tile for assessment summary (duration, questions, attempts, pass score).
 */
export function AssessmentMetricCard({ label, value, icon: Icon, className }) {
  return (
    <article className={cn('ta-metric-card', className)}>
      {Icon ? (
        <span className="ta-metric-card__icon" aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
      ) : null}
      <div className="ta-metric-card__text">
        <p className="ta-metric-card__label">{label}</p>
        <p className="ta-metric-card__value">{value}</p>
      </div>
    </article>
  );
}

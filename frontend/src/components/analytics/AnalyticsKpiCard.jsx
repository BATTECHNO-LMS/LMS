import { cn } from '../../utils/helpers.js';
import { AnalyticsTrendBadge } from './AnalyticsTrendBadge.jsx';

export function AnalyticsKpiCard({ title, value, icon: Icon, trend, helperText, className }) {
  return (
    <div className={cn('analytics-kpi-card', className)}>
      <div className="analytics-kpi-card__head">
        {Icon ? (
          <span className="analytics-kpi-card__icon" aria-hidden>
            <Icon size={22} strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="analytics-kpi-card__meta">
          <p className="analytics-kpi-card__title">{title}</p>
          {trend != null ? <AnalyticsTrendBadge value={trend} /> : null}
        </div>
      </div>
      <p className="analytics-kpi-card__value">{value}</p>
      {helperText ? <p className="analytics-kpi-card__helper">{helperText}</p> : null}
    </div>
  );
}

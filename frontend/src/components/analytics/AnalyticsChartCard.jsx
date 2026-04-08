import { cn } from '../../utils/helpers.js';

/**
 * White card wrapper for Recharts — chart area uses dir="ltr" for stable axes.
 */
export function AnalyticsChartCard({ title, description, children, className, chartClassName }) {
  return (
    <div className={cn('analytics-chart-card', className)}>
      <header className="analytics-chart-card__header">
        <h3 className="analytics-chart-card__title">{title}</h3>
        {description ? <p className="analytics-chart-card__desc">{description}</p> : null}
      </header>
      <div className={cn('analytics-chart-card__chart', chartClassName)} dir="ltr">
        {children}
      </div>
    </div>
  );
}

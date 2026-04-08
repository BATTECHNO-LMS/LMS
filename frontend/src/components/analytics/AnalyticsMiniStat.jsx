import { cn } from '../../utils/helpers.js';

export function AnalyticsMiniStat({ label, value, className }) {
  return (
    <div className={cn('analytics-mini-stat', className)}>
      <span className="analytics-mini-stat__label">{label}</span>
      <span className="analytics-mini-stat__value">{value}</span>
    </div>
  );
}

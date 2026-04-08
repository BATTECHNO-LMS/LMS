import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

export function AnalyticsTrendBadge({ value, className }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const up = n > 0;
  const flat = n === 0;
  return (
    <span
      className={cn(
        'analytics-trend',
        flat && 'analytics-trend--flat',
        !flat && up && 'analytics-trend--up',
        !flat && !up && 'analytics-trend--down',
        className
      )}
    >
      {flat ? <Minus size={14} aria-hidden /> : up ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
      <span>{flat ? '0%' : `${n > 0 ? '+' : ''}${n}%`}</span>
    </span>
  );
}

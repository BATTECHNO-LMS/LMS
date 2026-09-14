import { Info } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { AnalyticsTrendBadge } from './AnalyticsTrendBadge.jsx';

function MiniSparkline({ points = [], dark }) {
  if (!points.length) return null;
  const w = 88;
  const h = 28;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const d = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w;
      const y = h - ((p - min) / span) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="analytics-kpi-card__spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke={dark ? '#7eb6ff' : '#c9a227'} strokeWidth="1.75" />
    </svg>
  );
}

export function AnalyticsKpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendKind,
  helperText,
  className,
  variant = 'standard',
  live,
  info,
  sparkline,
  onClick,
}) {
  const dark = variant === 'highlight';
  return (
    <div
      className={cn(
        'analytics-kpi-card',
        `analytics-kpi-card--${variant}`,
        onClick && 'analytics-kpi-card--action',
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="analytics-kpi-card__head">
        {Icon ? (
          <span className="analytics-kpi-card__icon" aria-hidden>
            <Icon size={22} strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="analytics-kpi-card__meta">
          <p className="analytics-kpi-card__title">
            {title}
            {info ? (
              <button type="button" className="analytics-kpi-card__info" title={info} aria-label={info}>
                <Info size={14} strokeWidth={2} />
              </button>
            ) : null}
            {live ? <span className="analytics-live-dot" aria-hidden /> : null}
          </p>
          {trendKind === 'new' ? (
            <span className="analytics-trend analytics-trend--up">جديد</span>
          ) : trendKind === 'none' ? (
            <span className="analytics-trend analytics-trend--flat">لا توجد بيانات مقارنة</span>
          ) : trend != null ? (
            <AnalyticsTrendBadge value={trend} />
          ) : null}
        </div>
      </div>
      <p className="analytics-kpi-card__value">{value}</p>
      {helperText ? <p className="analytics-kpi-card__helper">{helperText}</p> : null}
      {sparkline?.length ? <MiniSparkline points={sparkline} dark={dark} /> : null}
    </div>
  );
}

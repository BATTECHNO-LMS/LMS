import { cn } from '../../utils/helpers.js';

/**
 * @param {{
 *   variant?: 'row' | 'card',
 *   count?: number,
 *   className?: string,
 * }} props
 */
export function LoadingSkeleton({ variant = 'card', count = 3, className }) {
  const items = Array.from({ length: Math.max(1, count) }, (_, i) => i);
  const itemClass = variant === 'row' ? 'ds-skeleton ds-skeleton--row' : 'ds-skeleton ds-skeleton--card';

  return (
    <div className={cn('ds-skeleton-group', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">جاري التحميل...</span>
      {items.map((i) => (
        <div key={i} className={itemClass} />
      ))}
    </div>
  );
}

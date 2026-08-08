import { cn } from '../../utils/helpers.js';

/**
 * Detail rows for IllustratedStatusLayout.
 * @param {{
 *   details?: Array<{
 *     icon?: React.ReactNode,
 *     label?: React.ReactNode,
 *     value?: React.ReactNode,
 *     badge?: React.ReactNode,
 *     key?: string | number,
 *   }>,
 *   className?: string,
 * }} props
 */
export function StatusDetailList({ details = [], className }) {
  if (!details?.length) return null;

  return (
    <ul className={cn('illustrated-status__details', className)}>
      {details.map((item, index) => (
        <li key={item.key ?? index} className="illustrated-status__detail">
          {item.icon ? (
            <span className="illustrated-status__detail-icon" aria-hidden>
              {item.icon}
            </span>
          ) : (
            <span className="illustrated-status__detail-icon" aria-hidden />
          )}
          <div className="illustrated-status__detail-text">
            {item.label ? <span className="illustrated-status__detail-label">{item.label}</span> : null}
            {item.value != null && item.value !== '' ? (
              <span className="illustrated-status__detail-value">{item.value}</span>
            ) : null}
          </div>
          {item.badge ? <span className="illustrated-status__detail-badge">{item.badge}</span> : null}
        </li>
      ))}
    </ul>
  );
}

import { cn } from '../../utils/helpers.js';

/**
 * Placeholder — wire to notifications API later.
 */
export function NotificationBell({ className, count = 0 }) {
  return (
    <button
      type="button"
      className={cn('notification-bell', className)}
      aria-label="الإشعارات"
    >
      <span className="notification-bell__icon" aria-hidden />
      {count > 0 ? (
        <span className="notification-bell__badge">{count > 9 ? '9+' : count}</span>
      ) : null}
    </button>
  );
}

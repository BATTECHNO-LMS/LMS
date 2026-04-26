import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';
import { useAuth } from '../../features/auth/index.js';
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js';
import { useMarkNotificationRead } from '../../features/notifications/hooks/useMarkNotificationRead.js';
import { getNotificationsPathForUser } from '../../utils/notificationsPath.js';
import { getAdminNotificationDeepLink } from '../../utils/notificationDeepLink.js';

export function NotificationBell({ className }) {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const { data, isLoading } = useNotifications({}, { staleTime: 20_000, enabled: Boolean(user) });
  const markRead = useMarkNotificationRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);
  const preview = useMemo(() => notifications.slice(0, 8), [notifications]);

  const notifPath = getNotificationsPathForUser(user);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div ref={rootRef} className="notification-bell__root">
      <button
        type="button"
        className={cn('notification-bell', className)}
        aria-label={tCommon('notifications')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="notification-bell__icon" aria-hidden />
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">{unreadCount > 9 ? '9+' : String(unreadCount)}</span>
        ) : null}
      </button>
      {open ? (
        <div className="notification-bell__panel">
          {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
          {!isLoading && preview.length === 0 ? <p className="crud-muted">{t('emptyTitle')}</p> : null}
          <ul className="notification-bell__list">
            {preview.map((n) => {
              const deepLink = getAdminNotificationDeepLink(n, user);
              return (
                <li key={n.id} className="notification-bell__item">
                  {deepLink ? (
                    <button
                      type="button"
                      className="notification-bell__item-title-btn"
                      onClick={() => {
                        if (!n.is_read) markRead.mutate(n.id);
                        navigate(deepLink);
                        setOpen(false);
                      }}
                    >
                      {n.title}
                    </button>
                  ) : (
                    <div className="notification-bell__item-title">{n.title}</div>
                  )}
                  {n.body ? <div className="notification-bell__item-body crud-muted">{n.body}</div> : null}
                  {!n.is_read ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm notification-bell__mark-read"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                    >
                      {t('markRead')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="notification-bell__footer">
            <Link className="btn btn--outline btn--sm" to={notifPath} onClick={() => setOpen(false)}>
              {tCommon('actions.details')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
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
        <div
          className="notification-bell__panel"
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            marginTop: 8,
            minWidth: 280,
            maxHeight: 360,
            overflow: 'auto',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #ddd)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 50,
            padding: 8,
          }}
        >
          {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
          {!isLoading && preview.length === 0 ? <p className="crud-muted">{t('emptyTitle')}</p> : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {preview.map((n) => {
              const deepLink = getAdminNotificationDeepLink(n, user);
              return (
                <li key={n.id} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border, #eee)' }}>
                  {deepLink ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.is_read) markRead.mutate(n.id);
                        navigate(deepLink);
                        setOpen(false);
                      }}
                      style={{
                        fontWeight: 600,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'inherit',
                        color: 'inherit',
                        width: '100%',
                      }}
                    >
                      {n.title}
                    </button>
                  ) : (
                    <div style={{ fontWeight: 600 }}>{n.title}</div>
                  )}
                  {n.body ? <div className="crud-muted" style={{ fontSize: 12 }}>{n.body}</div> : null}
                  {!n.is_read ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ marginTop: 4 }}
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
          <div style={{ marginTop: 8 }}>
            <Link className="btn btn--outline btn--sm" to={notifPath} onClick={() => setOpen(false)}>
              {tCommon('actions.details')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

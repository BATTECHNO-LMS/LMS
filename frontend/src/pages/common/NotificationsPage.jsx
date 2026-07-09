import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Inbox,
  UserPlus,
  Settings,
  ClipboardCheck,
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCheck,
  ChevronLeft,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { cn } from '../../utils/helpers.js';
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js';
import { useMarkNotificationRead } from '../../features/notifications/hooks/useMarkNotificationRead.js';
import { useMarkAllNotificationsRead } from '../../features/notifications/hooks/useMarkAllNotificationsRead.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useLocale } from '../../features/locale/index.js';
import { useAuth } from '../../features/auth/index.js';
import { getNotificationLink } from '../../utils/notificationDeepLink.js';

/** Notification type → themed icon (falls back to a bell). */
const TYPE_ICONS = {
  user_pending_activation: UserPlus,
  system: Settings,
  action_required: ClipboardCheck,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: AlertOctagon,
};

/** Filter presets mapped to the existing backend params (is_read / type). */
const FILTERS = [
  { id: 'all' },
  { id: 'unread' },
  { id: 'read' },
  { id: 'registration', type: 'user_pending_activation' },
  { id: 'system', type: 'system' },
  { id: 'action', type: 'action_required' },
];

const NEW_STUDENT_REGISTRATION_TITLE = 'New Student Registration';

function isRegistrationNotification(n) {
  if (n.type === 'user_pending_activation') return true;
  return (
    n.title === NEW_STUDENT_REGISTRATION_TITLE &&
    (n.type === 'system' || n.type === 'warning') &&
    String(n.body || '').includes('requires account activation')
  );
}

export function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();

  const [active, setActive] = useState('all');

  const params = useMemo(() => {
    const preset = FILTERS.find((f) => f.id === active);
    const payload = { page: 1, page_size: 100 };
    if (active === 'unread') payload.is_read = false;
    if (active === 'read') payload.is_read = true;
    if (preset?.type) payload.type = preset.type;
    return payload;
  }, [active]);

  const { data, isLoading, isError, error } = useNotifications(params, { staleTime: 15_000 });
  const needsSeparateSummary = active !== 'all';
  const { data: allData, isLoading: summaryLoading } = useNotifications(
    { page: 1, page_size: 100 },
    { staleTime: 15_000, enabled: needsSeparateSummary }
  );

  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = useMemo(() => {
    const list = data?.notifications ?? [];
    return list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      type: n.type,
      action_url: n.action_url ?? null,
      is_read: n.is_read,
      created_at: n.created_at ? new Date(n.created_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  const summary = useMemo(() => {
    const list = (needsSeparateSummary ? allData : data)?.notifications ?? [];
    return {
      total: list.length,
      unread: list.filter((n) => !n.is_read).length,
      registration: list.filter((n) => isRegistrationNotification(n)).length,
      system: list.filter((n) => n.type === 'system').length,
    };
  }, [needsSeparateSummary, allData, data]);

  const summaryValue = (n) => ((needsSeparateSummary ? summaryLoading : isLoading) ? '—' : String(n));

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <button
            type="button"
            className="btn btn--outline"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck size={16} strokeWidth={2} aria-hidden />
            {t('markAllRead')}
          </button>
        }
      />

      <AdminStatsGrid>
        <StatCard label={t('summary.total')} value={summaryValue(summary.total)} icon={Bell} />
        <StatCard label={t('summary.unread')} value={summaryValue(summary.unread)} icon={Inbox} />
        <StatCard label={t('summary.registration')} value={summaryValue(summary.registration)} icon={UserPlus} />
        <StatCard label={t('summary.system')} value={summaryValue(summary.system)} icon={Settings} />
      </AdminStatsGrid>

      <div className="notif-toolbar" role="tablist" aria-label={t('type')}>
        <div className="notif-chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active === f.id}
              className={cn('notif-chip', active === f.id && 'is-active')}
              onClick={() => setActive(f.id)}
            >
              {t(`filters.${f.id}`)}
              {f.id === 'unread' && !summaryLoading && summary.unread > 0 ? (
                <span className="notif-chip__count">{summary.unread}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="notif-feedback">{tCommon('loading')}</p> : null}
      {isError ? (
        <p className="notif-feedback" role="alert">
          {getApiErrorMessage(error, t('loadError'))}
        </p>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <EmptyState icon={Bell} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : null}

      {items.length > 0 ? (
        <div className="notif-list">
          {items.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const deep = getNotificationLink(
              { type: n.type, title: n.title, body: n.body, action_url: n.action_url },
              user
            );
            return (
              <article key={n.id} className={cn('notif-item', `notif-item--${n.type}`, !n.is_read && 'notif-item--unread')}>
                <span className="notif-item__icon" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </span>
                <div className="notif-item__main">
                  <div className="notif-item__head">
                    <h3 className="notif-item__title">
                      {deep ? (
                        <Link to={deep} onClick={() => { if (!n.is_read) markOne.mutate(n.id); }}>
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </h3>
                    <time className="notif-item__time">{n.created_at}</time>
                  </div>
                  {n.body ? <p className="notif-item__body">{n.body}</p> : null}
                  <div className="notif-item__meta">
                    <span className="notif-badge notif-badge--type">
                      {t(`types.${n.type}`, { defaultValue: n.type })}
                    </span>
                    <span className={cn('notif-badge', n.is_read ? 'notif-badge--read' : 'notif-badge--unread')}>
                      {n.is_read ? t('list.read') : t('unread')}
                    </span>
                    {deep ? (
                      <Link
                        to={deep}
                        className="notif-item__details"
                        onClick={() => { if (!n.is_read) markOne.mutate(n.id); }}
                      >
                        {t('viewDetails')}
                        <ChevronLeft size={14} strokeWidth={2.5} aria-hidden />
                      </Link>
                    ) : null}
                    {!n.is_read ? (
                      <button
                        type="button"
                        className={cn('btn btn--outline btn--sm', !deep && 'notif-item__mark-end')}
                        onClick={() => markOne.mutate(n.id)}
                        disabled={markOne.isPending}
                      >
                        {t('markRead')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

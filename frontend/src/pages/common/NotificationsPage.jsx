import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
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
  ShieldCheck,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { AlertBanner } from '../../components/designSystem/index.js';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { cn } from '../../utils/helpers.js';
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js';
import { useUnreadNotificationCount } from '../../features/notifications/hooks/useUnreadNotificationCount.js';
import { useMarkNotificationRead } from '../../features/notifications/hooks/useMarkNotificationRead.js';
import { useMarkAllNotificationsRead } from '../../features/notifications/hooks/useMarkAllNotificationsRead.js';
import { useArchiveNotification } from '../../features/notifications/hooks/useArchiveNotification.js';
import { useAcknowledgeNotification } from '../../features/notifications/hooks/useAcknowledgeNotification.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useLocale } from '../../features/locale/index.js';
import { useAuth } from '../../features/auth/index.js';
import { getNotificationLink } from '../../utils/notificationDeepLink.js';
import { getNotificationSettingsPathForUser } from '../../utils/notificationSettingsPath.js';

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
  const location = useLocation();
  const isStudentPortal = location.pathname.startsWith('/student');
  const PageHeader = isStudentPortal ? StudentPageHeader : AdminPageHeader;
  const settingsPath = getNotificationSettingsPathForUser(user);

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
  const { data: unreadData } = useUnreadNotificationCount({ staleTime: 15_000 });

  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const archiveOne = useArchiveNotification();
  const ackOne = useAcknowledgeNotification();

  const items = useMemo(() => {
    const list = data?.notifications ?? [];
    return list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      type: n.type,
      action_url: n.action_url ?? null,
      is_read: n.is_read,
      category: n.category ?? null,
      priority: n.priority ?? null,
      is_critical: Boolean(n.is_critical),
      requires_acknowledgement: Boolean(n.requires_acknowledgement),
      acknowledged_at: n.acknowledged_at ?? null,
      created_at: n.created_at ? new Date(n.created_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  const summary = useMemo(() => {
    const list = (needsSeparateSummary ? allData : data)?.notifications ?? [];
    const unreadFromApi =
      typeof unreadData?.unread_count === 'number' ? unreadData.unread_count : null;
    return {
      total: list.length,
      unread: unreadFromApi ?? list.filter((n) => !n.is_read).length,
      registration: list.filter((n) => isRegistrationNotification(n)).length,
      system: list.filter((n) => n.type === 'system').length,
    };
  }, [needsSeparateSummary, allData, data, unreadData]);

  const summaryValue = (n) => ((needsSeparateSummary ? summaryLoading : isLoading) ? '—' : String(n));

  return (
    <div
      className={cn(
        'page page--dashboard page-shell',
        isStudentPortal ? 'page--student' : 'page--admin'
      )}
    >
      <div className="page-shell__header">
        <PageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <div className="page-shell__actions">
              <Link className="btn btn--outline" to={settingsPath}>
                <Settings size={16} strokeWidth={2} aria-hidden />
                {t('preferences', { defaultValue: 'Preferences' })}
              </Link>
              <button
                type="button"
                className="btn btn--outline"
                disabled={markAll.isPending}
                onClick={() => markAll.mutate()}
              >
                <CheckCheck size={16} strokeWidth={2} aria-hidden />
                {t('markAllRead')}
              </button>
            </div>
          }
        />
      </div>

      <div className="page-shell__content">
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
        <AlertBanner variant="danger" title={t('loadError')}>
          {getApiErrorMessage(error, t('loadError'))}
        </AlertBanner>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
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
                    {n.category ? (
                      <span className="notif-badge notif-badge--type">{n.category}</span>
                    ) : null}
                    {n.priority ? (
                      <span className="notif-badge notif-badge--type">{n.priority}</span>
                    ) : null}
                    {n.is_critical ? (
                      <span className="notif-badge notif-badge--unread">{t('critical')}</span>
                    ) : null}
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
                    {n.requires_acknowledgement && !n.acknowledged_at ? (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => ackOne.mutate(n.id)}
                        disabled={ackOne.isPending}
                      >
                        <ShieldCheck size={14} aria-hidden />
                        {t('acknowledge')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => archiveOne.mutate(n.id)}
                      disabled={archiveOne.isPending}
                      title={t('archive')}
                    >
                      <Archive size={14} aria-hidden />
                      {t('archive')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      </div>
    </div>
  );
}

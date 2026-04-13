import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js';
import { useMarkNotificationRead } from '../../features/notifications/hooks/useMarkNotificationRead.js';
import { useMarkAllNotificationsRead } from '../../features/notifications/hooks/useMarkAllNotificationsRead.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useLocale } from '../../features/locale/index.js';

export function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [filter, setFilter] = useState('');
  const params = useMemo(() => {
    if (filter === 'unread') return { is_read: false };
    if (filter === 'read') return { is_read: true };
    return {};
  }, [filter]);

  const { data, isLoading, isError, error } = useNotifications(params, { staleTime: 15_000 });
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const rows = useMemo(() => {
    const list = data?.notifications ?? [];
    return list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      type: n.type,
      is_read: n.is_read,
      created_at: n.created_at ? new Date(n.created_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('title')} description={t('description')} />
      <AdminFilterBar>
        <SelectField id="notif-filter" label={t('type')} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{t('all')}</option>
          <option value="unread">{t('unread')}</option>
          <option value="read">{t('list.read')}</option>
        </SelectField>
        <button type="button" className="btn btn--outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
          {t('markAllRead')}
        </button>
      </AdminFilterBar>
      <SectionCard title={t('title')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        {isError ? (
          <p className="crud-muted" role="alert">
            {getApiErrorMessage(error, t('loadError'))}
          </p>
        ) : null}
        <DataTable
          emptyTitle={t('emptyTitle')}
          emptyDescription={t('emptyDescription')}
          columns={[
            { key: 'created_at', label: t('list.columns.time') },
            { key: 'title', label: t('list.columns.title') },
            { key: 'type', label: t('type') },
            {
              key: 'is_read',
              label: tCommon('status.label'),
              render: (r) => (r.is_read ? tCommon('status.active') : t('unread')),
            },
            {
              key: 'actions',
              label: tCommon('actions.details'),
              render: (r) =>
                r.is_read ? null : (
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => markOne.mutate(r.id)} disabled={markOne.isPending}>
                    {t('markRead')}
                  </button>
                ),
            },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}

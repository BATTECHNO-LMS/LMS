import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { useAuditLogs } from '../../features/auditLogs/hooks/useAuditLogs.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function AuditLogsPage() {
  const { t } = useTranslation('auditLogs');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [q, setQ] = useState('');
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params = useMemo(() => {
    const p = {};
    if (!isAllTenantsSelected && scopeId) p.university_id = scopeId;
    if (actionType) p.action_type = actionType;
    if (entityType) p.entity_type = entityType;
    if (from) p.from = from;
    if (to) p.to = to;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [scopeId, isAllTenantsSelected, q, actionType, entityType, from, to]);

  const { data, isLoading, isError, error } = useAuditLogs(params, { staleTime: 30_000 });
  const rows = useMemo(() => {
    const list = data?.audit_logs ?? [];
    return list.map((r) => ({
      id: r.id,
      time: r.created_at ? new Date(r.created_at).toLocaleString(locale) : '—',
      actor: r.user?.full_name ?? r.user?.email ?? '—',
      action: r.action_type,
      resource: r.entity_type,
      entityId: r.entity_id ?? '—',
      university: r.university?.name ?? '—',
    }));
  }, [data, locale]);

  const emptyTitle = isError ? tCommon('errors.generic') : t('list.emptyTitle');
  const emptyDescription = isError ? getApiErrorMessage(error, t('list.loadError')) : t('list.emptyDescription');

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminActionBar />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="audit-action-type" label={t('list.filters.actionType')} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="">{t('list.filters.allActions')}</option>
          <option value="certificate.issue">certificate.issue</option>
          <option value="certificate.status">certificate.status</option>
          <option value="recognition_request.create">recognition_request.create</option>
          <option value="recognition_request.status">recognition_request.status</option>
          <option value="recognition_document.create">recognition_document.create</option>
          <option value="recognition_document.update">recognition_document.update</option>
          <option value="recognition_document.delete">recognition_document.delete</option>
        </SelectField>
        <SelectField id="audit-entity-type" label={t('list.filters.entityType')} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">{t('list.filters.allEntities')}</option>
          <option value="certificate">certificate</option>
          <option value="recognition_request">recognition_request</option>
          <option value="recognition_document">recognition_document</option>
          <option value="notification">notification</option>
        </SelectField>
        <div className="form-field">
          <label className="form-field__label" htmlFor="audit-from">
            {t('list.filters.from')}
          </label>
          <input id="audit-from" className="form-field__control" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor="audit-to">
            {t('list.filters.to')}
          </label>
          <input id="audit-to" className="form-field__control" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.events')} value={String(rows.length)} icon={ScrollText} />
      </AdminStatsGrid>
      <SectionCard title={t('list.title')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        <DataTable
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            { key: 'time', label: t('list.columns.time') },
            { key: 'actor', label: t('list.columns.user') },
            { key: 'action', label: t('list.columns.action') },
            { key: 'resource', label: t('list.columns.entity') },
            { key: 'entityId', label: t('list.columns.entityId') },
            { key: 'university', label: t('list.columns.university') },
            {
              key: 'actions',
              label: tCommon('actions.view'),
              render: (r) => <TableIconActions viewTo={`/admin/audit-logs/${r.id}`} />,
            },
          ]}
          rows={isError ? [] : rows}
        />
      </SectionCard>
    </div>
  );
}

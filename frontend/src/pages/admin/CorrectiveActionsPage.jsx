import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, Timer } from 'lucide-react';
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
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useCorrectiveActions } from '../../features/correctiveActions/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function CorrectiveActionsPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (status) p.status = status;
    if (overdue === 'true' || overdue === 'false') p.overdue = overdue;
    return p;
  }, [q, status, overdue]);

  const { data, isLoading, isError, error } = useCorrectiveActions(listParams, { staleTime: 30_000 });
  const rows = data?.corrective_actions ?? [];

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === 'open' || r.status === 'overdue').length;
    const overdueCt = rows.filter((r) => r.status === 'overdue').length;
    const resolved = rows.filter((r) => r.status === 'resolved' || r.status === 'closed').length;
    return { total: rows.length, open, overdueCt, resolved };
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/corrective-actions/create`}>
          <Plus size={18} aria-hidden /> {t('add')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="ca-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="open">{statusLabelAr('open', locale)}</option>
          <option value="in_progress">{statusLabelAr('in_progress', locale)}</option>
          <option value="overdue">{statusLabelAr('overdue', locale)}</option>
          <option value="resolved">{statusLabelAr('resolved', locale)}</option>
          <option value="closed">{statusLabelAr('closed', locale)}</option>
        </SelectField>
        <SelectField id="ca-overdue" label={t('filters.overdueOnly')} value={overdue} onChange={(e) => setOverdue(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="true">{t('filters.overdueOnly')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={ClipboardList} />
        <StatCard label={t('stats.open')} value={String(stats.open)} icon={ClipboardList} />
        <StatCard label={t('stats.overdue')} value={String(stats.overdueCt)} icon={Timer} />
        <StatCard label={t('stats.resolved')} value={String(stats.resolved)} icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              {
                key: 'qa',
                label: t('table.qaReview'),
                render: (r) => r.qa_review?.cohort?.title ?? r.qa_review_id ?? '—',
              },
              { key: 'action_text', label: t('table.text') },
              {
                key: 'due_date',
                label: t('table.due'),
                render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : '—'),
              },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              { key: 'assignee', label: t('table.assignee'), render: (r) => r.assignee?.full_name ?? '—' },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`${base}/corrective-actions/${r.id}`} editTo={`${base}/corrective-actions/${r.id}/edit`} />
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}

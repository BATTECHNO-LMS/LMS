import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, ShieldCheck } from 'lucide-react';
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
import { useQaReviews } from '../../features/qa/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

function reviewTypeLabel(t, type) {
  const k = `types.${type}`;
  const v = t(k, { defaultValue: type });
  return v === k ? type : v;
}

export function QAReviewsPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('qaReviews');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (status) p.status = status;
    return p;
  }, [q, status]);

  const { data, isLoading, isError, error } = useQaReviews(listParams, { staleTime: 30_000 });
  const rows = data?.qa_reviews ?? [];

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === 'open').length;
    const inProgress = rows.filter((r) => r.status === 'in_progress').length;
    const closed = rows.filter((r) => r.status === 'closed').length;
    return { total: rows.length, open, inProgress, closed };
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/qa-reviews/create`}>
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
        <SelectField id="qa-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="open">{statusLabelAr('open', locale)}</option>
          <option value="in_progress">{statusLabelAr('in_progress', locale)}</option>
          <option value="resolved">{statusLabelAr('resolved', locale)}</option>
          <option value="closed">{statusLabelAr('closed', locale)}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={ClipboardList} />
        <StatCard label={t('stats.open')} value={String(stats.open)} icon={ShieldCheck} />
        <StatCard label={t('stats.inProgress')} value={String(stats.inProgress)} icon={ClipboardList} />
        <StatCard label={t('stats.closed')} value={String(stats.closed)} icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              {
                key: 'review_date',
                label: t('table.date'),
                render: (r) => (r.review_date ? String(r.review_date).slice(0, 10) : '—'),
              },
              {
                key: 'review_type',
                label: t('table.type'),
                render: (r) => reviewTypeLabel(t, r.review_type),
              },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              { key: 'reviewer', label: t('table.reviewer'), render: (r) => r.reviewer?.full_name ?? '—' },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => <TableIconActions viewTo={`${base}/qa-reviews/${r.id}`} editTo={`${base}/qa-reviews/${r.id}/edit`} />,
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}

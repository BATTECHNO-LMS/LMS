import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { useAssessments } from '../../../features/assessments/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';

function typeLabel(t, type) {
  const k = `typeLabels.${type}`;
  const v = t(k, { defaultValue: type });
  return v === k ? type : v;
}

export function AssessmentsListPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('assessments');
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

  const { data, isLoading, isError, error } = useAssessments(listParams, { staleTime: 30_000 });
  const assessments = data?.assessments ?? [];

  const stats = useMemo(() => {
    const published = assessments.filter((a) => a.status === 'published').length;
    const draft = assessments.filter((a) => a.status === 'draft').length;
    const open = assessments.filter((a) => a.status === 'open').length;
    return { total: assessments.length, published, draft, open };
  }, [assessments]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/assessments/create`}>
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
        <SelectField id="assess-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="draft">{statusLabelAr('draft', locale)}</option>
          <option value="published">{statusLabelAr('published', locale)}</option>
          <option value="open">{statusLabelAr('open', locale)}</option>
          <option value="closed">{statusLabelAr('closed', locale)}</option>
          <option value="archived">{statusLabelAr('archived', locale)}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={ClipboardList} />
        <StatCard label={t('stats.published')} value={String(stats.published)} icon={ClipboardList} />
        <StatCard label={t('stats.drafts')} value={String(stats.draft)} icon={ClipboardList} />
        <StatCard label={t('stats.open', { defaultValue: 'Open' })} value={String(stats.open)} icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'title', label: t('table.name') },
              {
                key: 'type',
                label: t('table.type'),
                render: (r) => typeLabel(t, r.assessment_type),
              },
              { key: 'weight', label: t('table.weight'), render: (r) => `${r.weight ?? '—'}%` },
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              {
                key: 'due_date',
                label: t('table.dueDate'),
                render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : '—'),
              },
              {
                key: 'status',
                label: tCommon('status.label'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`${base}/assessments/${r.id}`} editTo={`${base}/assessments/${r.id}/edit`} />
                ),
              },
            ]}
            rows={assessments}
          />
        )}
      </SectionCard>
    </div>
  );
}

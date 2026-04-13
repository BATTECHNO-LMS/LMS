import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeAlert, Plus, Eye } from 'lucide-react';
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
import { useIntegrityCases } from '../../features/integrity/index.js';
import { useCohorts } from '../../features/cohorts/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function IntegrityCasesPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('integrityCases');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [cohortId, setCohortId] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (status) p.status = status;
    if (cohortId) p.cohort_id = cohortId;
    return p;
  }, [q, status, cohortId]);

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const { data, isLoading, isError, error } = useIntegrityCases(listParams, { staleTime: 30_000 });
  const rows = data?.integrity_cases ?? [];

  const stats = useMemo(() => {
    const reported = rows.filter((r) => r.status === 'reported').length;
    const investigation = rows.filter((r) => r.status === 'under_investigation').length;
    const closed = rows.filter((r) => r.status === 'closed' || r.status === 'resolved').length;
    return { total: rows.length, reported, investigation, closed };
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/integrity-cases/create`}>
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
        <SelectField id="int-cohort" label={t('form.cohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">{t('filters.allCohorts')}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
        <SelectField id="int-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="reported">{statusLabelAr('reported', locale)}</option>
          <option value="under_investigation">{statusLabelAr('under_investigation', locale)}</option>
          <option value="resolved">{statusLabelAr('resolved', locale)}</option>
          <option value="closed">{statusLabelAr('closed', locale)}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={BadgeAlert} />
        <StatCard label={t('stats.reported')} value={String(stats.reported)} icon={BadgeAlert} />
        <StatCard label={t('stats.investigation')} value={String(stats.investigation)} icon={Eye} />
        <StatCard label={t('stats.closed')} value={String(stats.closed)} icon={BadgeAlert} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'case_type', label: t('table.type') },
              { key: 'student', label: t('table.student'), render: (r) => r.student?.full_name ?? '—' },
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              { key: 'assessment', label: t('table.assessment'), render: (r) => r.assessment?.title ?? '—' },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`${base}/integrity-cases/${r.id}`} editTo={`${base}/integrity-cases/${r.id}/edit`} />
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

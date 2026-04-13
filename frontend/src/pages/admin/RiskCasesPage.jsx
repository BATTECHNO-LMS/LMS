import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, ShieldAlert } from 'lucide-react';
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
import { useRiskCases } from '../../features/risks/index.js';
import { useCohorts } from '../../features/cohorts/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export function RiskCasesPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('riskCases');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [cohortId, setCohortId] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (status) p.status = status;
    if (riskLevel) p.risk_level = riskLevel;
    if (cohortId) p.cohort_id = cohortId;
    return p;
  }, [q, status, riskLevel, cohortId]);

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const { data, isLoading, isError, error } = useRiskCases(listParams, { staleTime: 30_000 });
  const rows = data?.risk_cases ?? [];

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === 'open').length;
    const escalated = rows.filter((r) => r.status === 'escalated').length;
    const closed = rows.filter((r) => r.status === 'closed').length;
    return { total: rows.length, open, escalated, closed };
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/risk-cases/create`}>
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
        <SelectField id="risk-cohort" label={t('form.cohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">{t('filters.allCohorts')}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
        <SelectField id="risk-level" label={t('form.riskLevel')} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          {RISK_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </SelectField>
        <SelectField id="risk-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="open">{statusLabelAr('open', locale)}</option>
          <option value="in_progress">{statusLabelAr('in_progress', locale)}</option>
          <option value="escalated">{statusLabelAr('escalated', locale)}</option>
          <option value="resolved">{statusLabelAr('resolved', locale)}</option>
          <option value="closed">{statusLabelAr('closed', locale)}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={AlertTriangle} />
        <StatCard label={t('stats.open')} value={String(stats.open)} icon={AlertTriangle} />
        <StatCard label={t('stats.escalated')} value={String(stats.escalated)} icon={ShieldAlert} />
        <StatCard label={t('stats.closed')} value={String(stats.closed)} icon={ShieldAlert} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'student', label: t('table.student'), render: (r) => r.student?.full_name ?? '—' },
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              { key: 'risk_type', label: t('table.type') },
              { key: 'risk_level', label: t('table.level') },
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
                render: (r) => <TableIconActions viewTo={`${base}/risk-cases/${r.id}`} editTo={`${base}/risk-cases/${r.id}/edit`} />,
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}

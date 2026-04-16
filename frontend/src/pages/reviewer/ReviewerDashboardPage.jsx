import { useMemo } from 'react';
import { FileBadge, BarChart3, FolderOpen, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { useRecognitionRequests } from '../../features/recognition/index.js';
import { useEvidence } from '../../features/evidence/index.js';
import { useReport } from '../../features/reports/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function ReviewerDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { scopeId, isAllTenantsSelected } = useTenant();
  const universityParam = !isAllTenantsSelected && scopeId ? { university_id: scopeId } : {};
  const {
    data: recognitionPayload,
    isLoading: recognitionLoading,
    isError: recognitionError,
    error: recognitionErrorObj,
  } = useRecognitionRequests(universityParam, { staleTime: 30_000 });
  const { data: evidencePayload, isLoading: evidenceLoading } = useEvidence(universityParam, { staleTime: 30_000 });
  const {
    data: reportsPayload,
    isLoading: reportsLoading,
    isError: reportsError,
    error: reportsErrorObj,
  } = useReport('universities', universityParam, { staleTime: 30_000 });

  const recognition = recognitionPayload?.recognition_requests ?? [];
  const reports = reportsPayload?.rows ?? [];
  const evidence = evidencePayload?.evidence ?? [];

  const pendingReview = useMemo(
    () => recognition.filter((r) => r.status === 'submitted' || r.status === 'under_review').length,
    [recognition]
  );

  const latestRows = useMemo(
    () =>
      recognition.map((r) => ({
        id: r.id,
        when: r.created_at ? String(r.created_at).slice(0, 19) : '—',
        what: r.micro_credential?.title ?? r.cohort?.title ?? r.id,
        ref: r.id,
      })),
    [recognition]
  );
  const loading = recognitionLoading || reportsLoading || evidenceLoading;
  const loadError = recognitionError
    ? getApiErrorMessage(recognitionErrorObj, tCommon('errors.generic'))
    : reportsError
      ? getApiErrorMessage(reportsErrorObj, tCommon('errors.generic'))
      : '';

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader
        title={<>{t('reviewer.title')}</>}
        description={<>{t('reviewer.description')}</>}
      />
      <AdminStatsGrid>
        <StatCard
          label={t('reviewer.requests')}
          value={String(pendingReview)}
          hint={t('reviewer.statsHint')}
          icon={FileBadge}
        />
        <StatCard
          label={t('reviewer.reports')}
          value={String(reports.length)}
          hint={t('reviewer.statsHint')}
          icon={BarChart3}
        />
        <StatCard
          label={t('reviewer.evidence')}
          value={String(evidence.length)}
          hint={t('reviewer.statsHint')}
          icon={FolderOpen}
        />
        <StatCard label={t('reviewer.alerts')} value="—" hint={t('reviewer.statsHint')} icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('reviewer.latest')}</>}>
        {loading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!loading ? (
          <DataTable
            emptyTitle={tCommon('tenant.emptyForScope')}
            emptyDescription={tCommon('tenant.emptyGeneric')}
            columns={[
              { key: 'when', label: <>{t('reviewer.table.time')}</> },
              { key: 'what', label: <>{t('reviewer.table.event')}</> },
              { key: 'ref', label: <>{t('reviewer.table.reference')}</> },
            ]}
            rows={loadError ? [] : latestRows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

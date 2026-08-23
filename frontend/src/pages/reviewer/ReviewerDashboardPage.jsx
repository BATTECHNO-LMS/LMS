import { useMemo } from 'react';
import { BarChart3, Bell, Briefcase, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { ContextualHelpButton } from '../../components/help/ContextualHelpButton.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useAuth, resolveAuthUniversityId } from '../../features/auth/index.js';
import { useReport } from '../../features/reports/index.js';
import { useFieldTrainingDashboard } from '../../features/fieldTrainingReports/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function ReviewerDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { t: tFt } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const universityId = resolveAuthUniversityId(user);
  const universityName = user?.university?.name || user?.primary_university?.name || '';
  const universityParam = universityId ? { university_id: universityId } : {};
  const isUniversity = user?.organizationType !== 'INSTITUTION';
  const {
    data: reportsPayload,
    isLoading: reportsLoading,
    isError: reportsError,
    error: reportsErrorObj,
  } = useReport('universities', universityParam, { staleTime: 30_000 });
  const {
    data: ftDashboard,
    isLoading: ftLoading,
    isError: ftError,
    error: ftErrorObj,
  } = useFieldTrainingDashboard(universityParam, {
    enabled: Boolean(universityId) && isUniversity,
    staleTime: 30_000,
    mode: 'academic',
  });

  const reports = reportsPayload?.rows ?? [];
  const ftSummary = ftDashboard?.summary ?? {};
  const loading = reportsLoading || (isUniversity && ftLoading);
  const loadError = reportsError
    ? getApiErrorMessage(reportsErrorObj, tCommon('errors.generic'))
    : ftError
      ? getApiErrorMessage(ftErrorObj, tCommon('errors.generic'))
      : '';

  const latestRows = useMemo(
    () =>
      reports.slice(0, 8).map((r, idx) => ({
        id: r.id ?? String(idx),
        when: r.updated_at || r.created_at || '—',
        what: r.name || r.title || r.university_name || '—',
        ref: r.id || '—',
      })),
    [reports]
  );

  return (
    <div className="page page--dashboard page--reviewer">
      <div className="ug-page-tools">
        <AdminPageHeader
          title={<>{t('reviewer.title')}</>}
          description={
            <>
              {t('reviewer.description')}
              {universityName ? ` — ${universityName}` : ''}
            </>
          }
        />
        <ContextualHelpButton contextualKey="progress" route="/reviewer/dashboard" />
      </div>
      {isUniversity && !universityId ? (
        <SectionCard title={<>{tFt('hub.universityRequiredTitle')}</>}>
          <p className="crud-muted" role="alert">
            {tFt('hub.universityRequired')}
          </p>
        </SectionCard>
      ) : null}
      <AdminStatsGrid>
        <StatCard
          label={t('reviewer.reports')}
          value={String(reports.length)}
          hint={t('reviewer.statsHint')}
          icon={BarChart3}
        />
        <StatCard label={t('reviewer.alerts')} value="—" hint={t('reviewer.statsHint')} icon={Bell} />
        {isUniversity ? (
          <>
            <StatCard
              label={t('reviewer.fieldTrainingApplicants')}
              value={String(ftSummary.total_applicants ?? 0)}
              hint={t('reviewer.fieldTrainingHint')}
              icon={Briefcase}
            />
            <StatCard
              label={t('reviewer.fieldTrainingInTraining')}
              value={String(ftSummary.in_training_students ?? 0)}
              hint={t('reviewer.fieldTrainingHint')}
              icon={Briefcase}
            />
          </>
        ) : (
          <StatCard
            label={t('reviewer.certificates', { defaultValue: 'Certificates' })}
            value="—"
            hint={t('reviewer.statsHint')}
            icon={Award}
          />
        )}
      </AdminStatsGrid>
      {isUniversity && universityParam.university_id ? (
        <p className="crud-muted">
          <Link to="/reviewer/field-training/reports">{t('reviewer.fieldTrainingPortal')}</Link>
        </p>
      ) : null}
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

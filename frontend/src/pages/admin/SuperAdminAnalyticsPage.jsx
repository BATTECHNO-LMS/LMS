import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  GraduationCap,
  Layers,
  Users,
  Percent,
  Clock,
  FileWarning,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  Award,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { useAnalytics } from '../../features/analytics/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useUniversities } from '../../features/universities/hooks/useUniversities.js';
import { useTracks } from '../../features/tracks/hooks/useTracks.js';
import { useMicroCredentials } from '../../features/microCredentials/hooks/useMicroCredentials.js';
import { useCohorts } from '../../features/cohorts/hooks/useCohorts.js';
import { AnalyticsKpiCard } from '../../components/analytics/AnalyticsKpiCard.jsx';
import { AnalyticsSectionCard } from '../../components/analytics/AnalyticsSectionCard.jsx';
import { AnalyticsFilterBar } from '../../components/analytics/AnalyticsFilterBar.jsx';
import { AnalyticsChartCard } from '../../components/analytics/AnalyticsChartCard.jsx';
import { AnalyticsMiniStat } from '../../components/analytics/AnalyticsMiniStat.jsx';
import { AnalyticsInsightList } from '../../components/analytics/AnalyticsInsightList.jsx';
import { AnalyticsAlertCard } from '../../components/analytics/AnalyticsAlertCard.jsx';
import { AnalyticsEmptyState } from '../../components/analytics/AnalyticsEmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import {
  UniversitiesOverviewChart,
  EnrollmentGrowthChart,
  CohortStatusDonutChart,
  AssessmentHealthChart,
  AttendanceTrendChart,
  EvidenceDonutChart,
  QaIntegrityBarChart,
  RecognitionFunnelChart,
  CertificatesLineChart,
  CertificatesByUniversityChart,
  CertificatesByCredentialChart,
} from '../../components/analytics/charts/AnalyticsCharts.jsx';

function AnalyticsModuleHead({ title, to }) {
  const { t } = useTranslation('analytics');
  return (
    <div className="analytics-module-block__head">
      <h3 className="analytics-module-block__title">{title}</h3>
      {to ? (
        <Link to={to} className="analytics-module-block__manage">
          {t('moduleLabels.openModule')}
        </Link>
      ) : null}
    </div>
  );
}

export function SuperAdminAnalyticsPage() {
  const { t, i18n } = useTranslation('analytics');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const { filters, setFilter, setTimePreset, data, loading, isError, error, refresh } = useAnalytics();
  const { data: uniData } = useUniversities();
  const { data: trackData } = useTracks();
  const { data: mcData } = useMicroCredentials();
  const { data: cohortData } = useCohorts(
    {
      university_id: filters.universityId || undefined,
      micro_credential_id: filters.microCredentialId || undefined,
    },
    { staleTime: 30_000 }
  );

  const onExportPdf = useCallback(async () => {
    if (!data || exportingPdf) return;
    setExportingPdf(true);
    try {
      const lang = String(i18n.language || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
      const { exportAnalyticsPdf } = await import('../../features/analytics/analyticsExport.js');
      await exportAnalyticsPdf({ filters, lang });
    } catch (e) {
      console.error(e);
      window.alert(getApiErrorMessage(e, t('export.failed')));
    } finally {
      setExportingPdf(false);
    }
  }, [data, exportingPdf, filters, i18n.language, t]);

  const onExportExcel = useCallback(async () => {
    if (!data || exportingExcel) return;
    setExportingExcel(true);
    try {
      const { exportAnalyticsExcel } = await import('../../features/analytics/analyticsExport.js');
      await exportAnalyticsExcel({ filters });
    } catch (e) {
      console.error(e);
      window.alert(getApiErrorMessage(e, t('export.failed')));
    } finally {
      setExportingExcel(false);
    }
  }, [data, exportingExcel, filters, t]);

  const onExportPowerBi = useCallback(async () => {
    if (!data || exportingExcel) return;
    setExportingExcel(true);
    try {
      const { exportAnalyticsPowerBi } = await import('../../features/analytics/analyticsExport.js');
      exportAnalyticsPowerBi({ data, filters, t });
    } catch (e) {
      console.error(e);
      window.alert(t('export.failed'));
    } finally {
      setExportingExcel(false);
    }
  }, [data, exportingExcel, filters, t]);

  const lng = i18n.language;
  const pickName = useCallback((row) => {
    if (!row) return '';
    return (String(lng).toLowerCase().startsWith('en') ? row.nameEn : row.nameAr) ?? row.nameAr ?? '';
  }, [lng]);

  const universitiesBarData = useMemo(() => {
    if (!data?.universitiesOverview) return [];
    return data.universitiesOverview.map((u) => ({
      ...u,
      label: pickName(u),
    }));
  }, [data?.universitiesOverview, pickName]);

  const enrollmentData = useMemo(() => {
    if (!data?.enrollmentGrowth) return [];
    return data.enrollmentGrowth.map((row) => ({
      ...row,
      label: t(`months.${row.monthKey}`),
    }));
  }, [data?.enrollmentGrowth, t]);

  const cohortPieData = useMemo(() => {
    if (!data?.cohortStatus) return [];
    return data.cohortStatus.map((row) => ({
      ...row,
      label: t(`charts.cohortStatuses.${row.statusKey}`),
    }));
  }, [data?.cohortStatus, t]);

  const assessmentHealthData = useMemo(() => {
    if (!data?.assessmentHealth) return [];
    return data.assessmentHealth.map((row) => ({
      label: t(`charts.assessmentSeries.${row.key}`),
      value: row.value,
    }));
  }, [data?.assessmentHealth, t]);

  const attendanceData = useMemo(() => {
    if (!data?.attendanceTrend) return [];
    return data.attendanceTrend.map((row) => ({
      ...row,
      label: t(`weeks.${row.weekKey}`),
    }));
  }, [data?.attendanceTrend, t]);

  const evidencePieData = useMemo(() => {
    if (!data?.evidenceAnalytics) return [];
    return data.evidenceAnalytics.map((row) => ({
      ...row,
      label: t(`charts.evidenceSeries.${row.key}`),
    }));
  }, [data?.evidenceAnalytics, t]);

  const qaBarData = useMemo(() => {
    if (!data?.qaIntegrityBar) return [];
    return data.qaIntegrityBar.map((row) => ({
      label: t(`charts.qaSeries.${row.key}`),
      value: row.value,
    }));
  }, [data?.qaIntegrityBar, t]);

  const recognitionFunnelData = useMemo(() => {
    if (!data?.recognitionFunnel) return [];
    return data.recognitionFunnel.map((row) => ({
      ...row,
      label: t(`charts.recognitionStatuses.${row.statusKey}`),
    }));
  }, [data?.recognitionFunnel, t]);

  const certMonthData = useMemo(() => {
    if (!data?.certificatesByMonth) return [];
    return data.certificatesByMonth.map((row) => ({
      ...row,
      label: t(`months.${row.monthKey}`),
    }));
  }, [data?.certificatesByMonth, t]);

  const certUniData = useMemo(() => {
    if (!data?.certificatesByUniversity) return [];
    return data.certificatesByUniversity.map((u) => ({
      ...u,
      label: pickName(u),
      count: u.count,
    }));
  }, [data?.certificatesByUniversity, pickName]);

  const certCredData = useMemo(() => {
    if (!data?.certificatesByCredential) return [];
    return data.certificatesByCredential.map((c) => ({
      ...c,
      label: String(lng).toLowerCase().startsWith('en') ? c.nameEn : c.nameAr,
      count: c.count,
    }));
  }, [data?.certificatesByCredential, lng]);

  const kpis = data?.kpis;
  const trends = data?.kpiTrends;
  const modules = data?.modules;

  if (loading && !data) {
    return (
      <div className="page page--admin page--analytics page--analytics-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="page page--admin page--analytics">
        <AdminPageHeader title={<>{t('page.title')}</>} description={<>{t('page.description')}</>} />
        <div className="analytics-empty-state analytics-empty-state--error" role="alert">
          <p className="analytics-empty-state__title">{t('error.title')}</p>
          <p className="analytics-empty-state__desc">{getApiErrorMessage(error, t('error.title'))}</p>
          <p className="analytics-empty-state__desc">{t('error.hint')}</p>
          <button type="button" className="btn btn--primary" onClick={() => refresh()}>
            {t('error.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page page--admin page--analytics">
        <AnalyticsEmptyState />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin page--analytics">
      <AdminPageHeader title={<>{t('page.title')}</>} description={<>{t('page.description')}</>} />

      <AnalyticsFilterBar
        filters={filters}
        onFilterChange={setFilter}
        onTimePreset={setTimePreset}
        onRefresh={refresh}
        onExportPdf={onExportPdf}
        exportingPdf={exportingPdf}
        onExportExcel={onExportExcel}
        exportingExcel={exportingExcel}
        onExportPowerBi={onExportPowerBi}
        universities={uniData?.universities ?? []}
        tracks={trackData?.tracks ?? []}
        microCredentials={mcData?.micro_credentials ?? []}
        cohorts={cohortData?.cohorts ?? []}
      />

      <AnalyticsSectionCard title={<>{t('sections.kpis')}</>} id="analytics-kpis">
        <div className="analytics-kpi-grid">
          <AnalyticsKpiCard
            title={t('kpi.universities')}
            value={String(kpis?.universities ?? '—')}
            icon={Building2}
            trend={trends?.universities?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.microCredentials')}
            value={String(kpis?.microCredentials ?? '—')}
            icon={GraduationCap}
            trend={trends?.microCredentials?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.activeCohorts')}
            value={String(kpis?.activeCohorts ?? '—')}
            icon={Layers}
            trend={trends?.activeCohorts?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.enrolledStudents')}
            value={String(kpis?.enrolledStudents ?? '—')}
            icon={Users}
            trend={trends?.enrolledStudents?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.pendingEnrollments')}
            value={String(kpis?.pendingEnrollments ?? '—')}
            icon={UserPlus}
            trend={trends?.pendingEnrollments?.pct}
            helperText={t('kpi.helperEnrollments')}
          />
          <AnalyticsKpiCard
            title={t('kpi.attendanceRate')}
            value={`${kpis?.attendanceRatePct ?? '—'}%`}
            icon={Percent}
            trend={trends?.attendanceRatePct?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.delayedAssessments')}
            value={String(kpis?.delayedAssessments ?? '—')}
            icon={Clock}
            trend={trends?.delayedAssessments?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.missingEvidence')}
            value={String(kpis?.missingEvidence ?? '—')}
            icon={FileWarning}
            trend={trends?.missingEvidence?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.recognitionReady')}
            value={String(kpis?.recognitionReady ?? '—')}
            icon={FileCheck}
            trend={trends?.recognitionReady?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.openQa')}
            value={String(kpis?.openQaIssues ?? '—')}
            icon={ShieldCheck}
            trend={trends?.openQaIssues?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.openIntegrity')}
            value={String(kpis?.openIntegrityCases ?? '—')}
            icon={ShieldAlert}
            trend={trends?.openIntegrityCases?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.certificatesIssued')}
            value={String(kpis?.certificatesIssued ?? '—')}
            icon={Award}
            trend={trends?.certificatesIssued?.pct}
            helperText={t('kpi.helperDemo')}
          />
          <AnalyticsKpiCard
            title={t('kpi.activeUsers')}
            value={String(kpis?.activeUsers ?? '—')}
            icon={UserCheck}
            trend={trends?.activeUsers?.pct}
            helperText={t('kpi.helperDemo')}
          />
        </div>
      </AnalyticsSectionCard>

      <AnalyticsSectionCard title={<>{t('sections.charts')}</>} id="analytics-charts">
        <div className="analytics-charts-grid">
          <AnalyticsChartCard title={t('charts.universitiesOverview.title')} description={t('charts.universitiesOverview.description')}>
            <UniversitiesOverviewChart
              data={universitiesBarData}
              dataKeys={{
                cohorts: t('charts.series.cohorts'),
                students: t('charts.series.students'),
                recognition: t('charts.series.recognition'),
              }}
            />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.enrollment.title')} description={t('charts.enrollment.description')}>
            <EnrollmentGrowthChart data={enrollmentData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.cohortStatus.title')} description={t('charts.cohortStatus.description')}>
            <CohortStatusDonutChart data={cohortPieData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.assessmentHealth.title')} description={t('charts.assessmentHealth.description')}>
            <AssessmentHealthChart data={assessmentHealthData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.attendance.title')} description={t('charts.attendance.description')}>
            <AttendanceTrendChart data={attendanceData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.evidence.title')} description={t('charts.evidence.description')}>
            <EvidenceDonutChart data={evidencePieData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.qaIntegrity.title')} description={t('charts.qaIntegrity.description')}>
            <QaIntegrityBarChart data={qaBarData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.recognitionFunnel.title')} description={t('charts.recognitionFunnel.description')}>
            <RecognitionFunnelChart data={recognitionFunnelData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.certificatesTime.title')} description={t('charts.certificatesTime.description')}>
            <CertificatesLineChart data={certMonthData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.certificatesUni.title')} description={t('charts.certificatesUni.description')}>
            <CertificatesByUniversityChart data={certUniData} />
          </AnalyticsChartCard>
          <AnalyticsChartCard title={t('charts.certificatesCred.title')} description={t('charts.certificatesCred.description')}>
            <CertificatesByCredentialChart data={certCredData} />
          </AnalyticsChartCard>
        </div>
      </AnalyticsSectionCard>

      <div className="analytics-two-col">
        <AnalyticsSectionCard title={<>{t('sections.insights')}</>} id="analytics-insights">
          <AnalyticsInsightList items={data.insightKeys ?? []} />
        </AnalyticsSectionCard>
        <AnalyticsSectionCard title={<>{t('sections.alerts')}</>} id="analytics-alerts">
          <div className="analytics-alert-stack">
            {(data.alerts ?? []).map((a, i) => (
              <AnalyticsAlertCard key={i} severity={a.severity} messageKey={a.key} params={a.params} />
            ))}
          </div>
        </AnalyticsSectionCard>
      </div>

      <AnalyticsSectionCard title={<>{t('sections.modules')}</>} id="analytics-modules">
        <div className="analytics-modules-grid">
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.users')} to="/admin/users" />
            <div className="analytics-module-block__stats">
              <AnalyticsMiniStat label={t('moduleLabels.totalUsers')} value={String(modules?.users?.total ?? '—')} />
              <AnalyticsMiniStat label={t('moduleLabels.activeUsers')} value={String(modules?.users?.active ?? '—')} />
              <AnalyticsMiniStat label={t('moduleLabels.recentAdds')} value={String(modules?.users?.recentAdds ?? '—')} />
            </div>
            <ul className="analytics-module-block__list">
              {(modules?.users?.byRole ?? []).map((r) => (
                <li key={r.roleKey}>
                  {t(`roles.${r.roleKey}`)}: {r.count}
                </li>
              ))}
            </ul>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.universities')} to="/admin/universities" />
            <AnalyticsMiniStat label={t('moduleLabels.totalUniversities')} value={String(modules?.universities?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.activePartnerships')} value={String(modules?.universities?.activePartnerships ?? '—')} />
            <p className="analytics-module-block__line">
              {t('moduleLabels.topActivity')}: {pickName({ nameAr: modules?.universities?.topActivityNameAr, nameEn: modules?.universities?.topActivityNameEn })}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.tracks')} to="/admin/tracks" />
            <AnalyticsMiniStat label={t('moduleLabels.totalTracks')} value={String(modules?.tracks?.total ?? '—')} />
            <p className="analytics-module-block__line">
              {t('moduleLabels.mostActive')}:{' '}
              {String(lng).toLowerCase().startsWith('en') ? modules?.tracks?.topActiveEn : modules?.tracks?.topActiveAr}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.microCredentials')} to="/admin/micro-credentials" />
            <AnalyticsMiniStat label={t('moduleLabels.totalMc')} value={String(modules?.microCredentials?.total ?? '—')} />
            <AnalyticsMiniStat
              label={t('moduleLabels.activeVsArchived')}
              value={`${modules?.microCredentials?.active ?? '—'} / ${modules?.microCredentials?.archived ?? '—'}`}
            />
            <p className="analytics-module-block__line">
              {t('moduleLabels.mostDelivered')}:{' '}
              {String(lng).toLowerCase().startsWith('en') ? modules?.microCredentials?.topDeliveredEn : modules?.microCredentials?.topDeliveredAr}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.cohorts')} to="/admin/cohorts" />
            <AnalyticsMiniStat label={t('moduleLabels.totalCohorts')} value={String(modules?.cohorts?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.activeCohorts')} value={String(modules?.cohorts?.active ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.completedCohorts')} value={String(modules?.cohorts?.completed ?? '—')} />
            <ul className="analytics-module-block__list">
              {(modules?.cohorts?.byUniversity ?? []).map((u) => (
                <li key={u.id}>
                  {pickName(u)}: {u.count}
                </li>
              ))}
            </ul>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.sessions')} to="/admin/sessions" />
            <AnalyticsMiniStat label={t('moduleLabels.totalSessions')} value={String(modules?.sessions?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.documented')} value={String(modules?.sessions?.documented ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.undocumented')} value={String(modules?.sessions?.undocumented ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.attendance')} to="/admin/attendance" />
            <AnalyticsMiniStat label={t('moduleLabels.overallRate')} value={`${modules?.attendance?.overallRate ?? '—'}%`} />
            <AnalyticsMiniStat label={t('moduleLabels.lowCohorts')} value={String(modules?.attendance?.lowAttendanceCohorts ?? '—')} />
            <p className="analytics-module-block__line">
              {t('moduleLabels.hotspot')}:{' '}
              {String(lng).toLowerCase().startsWith('en') ? modules?.attendance?.hotspotEn : modules?.attendance?.hotspotAr}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.assessments')} to="/admin/assessments" />
            <AnalyticsMiniStat label={t('moduleLabels.totalAssessments')} value={String(modules?.assessments?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.pendingGrading')} value={String(modules?.assessments?.pendingGrading ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.overdue')} value={String(modules?.assessments?.overdue ?? '—')} />
            <p className="analytics-module-block__line">
              {t('moduleLabels.topTypes')}: {(modules?.assessments?.topTypes ?? []).join(', ')}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.rubrics')} to="/admin/rubrics" />
            <AnalyticsMiniStat label={t('moduleLabels.totalRubrics')} value={String(modules?.rubrics?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.usageRate')} value={`${modules?.rubrics?.usageRatePct ?? '—'}%`} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.submissions')} to="/admin/submissions" />
            <AnalyticsMiniStat label={t('moduleLabels.totalSubmissions')} value={String(modules?.submissions?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.onTime')} value={String(modules?.submissions?.onTime ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.late')} value={String(modules?.submissions?.late ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.grades')} to="/admin/grades" />
            <AnalyticsMiniStat label={t('moduleLabels.completionRate')} value={`${modules?.grades?.completionRatePct ?? '—'}%`} />
            <AnalyticsMiniStat label={t('moduleLabels.avgScore')} value={String(modules?.grades?.avgScore ?? '—')} />
            <AnalyticsMiniStat
              label={t('moduleLabels.passFail')}
              value={`${modules?.grades?.pass ?? '—'} / ${modules?.grades?.fail ?? '—'}`}
            />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.evidence')} to="/admin/evidence" />
            <AnalyticsMiniStat label={t('moduleLabels.totalFiles')} value={String(modules?.evidence?.totalFiles ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.missing')} value={String(modules?.evidence?.missing ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.completion')} value={`${modules?.evidence?.completionRatePct ?? '—'}%`} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.qa')} to="/admin/qa-reviews" />
            <AnalyticsMiniStat label={t('moduleLabels.totalReviews')} value={String(modules?.qa?.totalReviews ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.openCases')} value={String(modules?.qa?.openCases ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.unresolvedCorrective')} value={String(modules?.qa?.unresolvedCorrective ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.riskCases')} to="/admin/risk-cases" />
            <AnalyticsMiniStat label={t('moduleLabels.atRiskStudents')} value={String(modules?.riskCases?.totalAtRisk ?? '—')} />
            <p className="analytics-module-block__line">
              {t('moduleLabels.trend')}: {t(`trends.${modules?.riskCases?.trendKey ?? 'stable'}`)}
            </p>
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.integrityCases')} to="/admin/integrity-cases" />
            <AnalyticsMiniStat label={t('moduleLabels.totalCases')} value={String(modules?.integrityCases?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.underInvestigation')} value={String(modules?.integrityCases?.underInvestigation ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.resolved')} value={String(modules?.integrityCases?.resolved ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.recognition')} to="/admin/recognition-requests" />
            <AnalyticsMiniStat label={t('moduleLabels.totalRequests')} value={String(modules?.recognition?.total ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.readyForSubmission')} value={String(modules?.recognition?.readyForSubmission ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.approvedRate')} value={`${modules?.recognition?.approvedRatePct ?? '—'}%`} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.certificates')} to="/admin/certificates" />
            <AnalyticsMiniStat label={t('moduleLabels.totalIssued')} value={String(modules?.certificates?.totalIssued ?? '—')} />
            <AnalyticsMiniStat label={t('moduleLabels.issuedThisMonth')} value={String(modules?.certificates?.issuedThisMonth ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.enrollmentRequests')} to="/admin/enrollments" />
            <AnalyticsMiniStat label={t('moduleLabels.pendingReview')} value={String(modules?.enrollments?.pendingReview ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.learningOutcomes')} to="/admin/learning-outcomes" />
            <AnalyticsMiniStat label={t('moduleLabels.totalOutcomes')} value={String(modules?.learningOutcomes?.total ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.content')} to="/admin/content" />
            <AnalyticsMiniStat label={t('moduleLabels.courseModules')} value={String(modules?.content?.courseModules ?? '—')} />
          </div>
          <div className="analytics-module-block">
            <AnalyticsModuleHead title={t('modules.reportsAudit')} to="/admin/reports" />
            <AnalyticsMiniStat label={t('moduleLabels.reportsGenerated')} value={String(modules?.reportsAudit?.reportsGeneratedPlaceholder ?? '—')} />
            <AnalyticsMiniStat
              label={t('moduleLabels.sensitiveActivities')}
              value={String(modules?.reportsAudit?.sensitiveActivitiesPlaceholder ?? '—')}
            />
            <Link to="/admin/audit-logs" className="analytics-module-block__manage analytics-module-block__manage--inline">
              {t('moduleLabels.openAuditLog')}
            </Link>
          </div>
        </div>
      </AnalyticsSectionCard>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SelectField,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCohorts, useCohortAttendanceSummary } from '../../features/cohorts/index.js';
import { useLocale } from '../../features/locale/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function AttendancePage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation('common');
  const { t: tEn } = useTranslation('enrollments');
  const { locale } = useLocale();
  const [cohortId, setCohortId] = useState('');

  const { data: cohortsPayload, isLoading: cLoading } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const { data: summary, isLoading: sLoading } = useCohortAttendanceSummary(cohortId || undefined, { enabled: Boolean(cohortId) });

  const rows = useMemo(
    () =>
      (summary?.students ?? []).map((s) => ({
        ...s,
        studentName: s.student?.full_name ?? '—',
        locale,
      })),
    [summary, locale]
  );

  const totals = useMemo(() => {
    const list = summary?.students ?? [];
    const p = list.reduce((a, r) => a + (r.total_present ?? 0), 0);
    const ab = list.reduce((a, r) => a + (r.total_absent ?? 0), 0);
    return { p, ab, n: list.length };
  }, [summary]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('summaryTitle')}</>} />
      <AdminActionBar>
        <Link className="btn btn--outline" to={`${base}/cohorts`}>
          {tCommon('actions.backToList')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SelectField id="att-cohort" label={t('selectCohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">—</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tEn('student')} value={String(totals.n)} icon={Percent} />
        <StatCard label={t('present')} value={String(totals.p)} icon={Percent} />
        <StatCard label={t('absent')} value={String(totals.ab)} icon={Percent} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('summaryTitle')}</>}>
        {cLoading ? <LoadingSpinner /> : null}
        {!cohortId ? (
          <p>{t('selectCohort')}</p>
        ) : sLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={tCommon('errors.generic')}
            emptyDescription=""
            columns={[
              { key: 'studentName', label: tEn('student') },
              { key: 'total_sessions', label: t('totalSessions') },
              { key: 'total_present', label: t('present') },
              { key: 'total_late', label: t('late') },
              { key: 'total_absent', label: t('absent') },
              { key: 'total_excused', label: t('excused') },
              { key: 'attendance_percentage', label: t('pct'), render: (r) => `${r.attendance_percentage ?? 0}%` },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}

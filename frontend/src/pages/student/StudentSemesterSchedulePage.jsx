import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useSemesterSchedule } from '../../features/enrollments/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentSemesterSchedulePage() {
  const { t } = useTranslation('enrollments');
  const { data, isLoading, isError, error } = useSemesterSchedule({ staleTime: 45_000 });

  const rows = useMemo(() => {
    const schedule = data?.schedule ?? [];
    return schedule.map((r, i) => ({
      id: r.session_id ?? `row-${i}`,
      track: r.track?.title ?? '—',
      micro: r.micro_credential?.title ?? '—',
      cohort: r.cohort_title ?? '—',
      session: r.session_title ?? '—',
      date: r.session_date ?? '—',
      start: r.start_time ?? '—',
      end: r.end_time ?? '—',
      sessionType: r.session_type ? String(r.session_type) : '—',
      docStatus: r.documentation_status ? String(r.documentation_status) : '—',
    }));
  }, [data]);

  const loadError = isError ? getApiErrorMessage(error) : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title={t('studentEnrollment.semesterSchedule.title')} description={t('studentEnrollment.semesterSchedule.subtitle')} />

      {isLoading ? <LoadingSpinner /> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      {!isLoading && !loadError ? (
        <DataTable
          emptyTitle={t('studentEnrollment.semesterSchedule.empty')}
          emptyDescription=""
          columns={[
            { key: 'track', label: t('studentEnrollment.semesterSchedule.colTrack'), mobileVisible: true },
            { key: 'micro', label: t('studentEnrollment.semesterSchedule.colMicro'), mobileVisible: true },
            { key: 'cohort', label: t('studentEnrollment.semesterSchedule.colCohort'), mobileVisible: true },
            {
              key: 'session',
              label: t('studentEnrollment.semesterSchedule.colSession'),
              mobileTitle: true,
              mobileVisible: true,
            },
            { key: 'date', label: t('studentEnrollment.semesterSchedule.colDate'), mobileSubtitle: true, mobileVisible: true },
            { key: 'start', label: t('studentEnrollment.semesterSchedule.colStart'), mobileVisible: true },
            { key: 'end', label: t('studentEnrollment.semesterSchedule.colEnd'), mobileVisible: true },
            { key: 'sessionType', label: t('studentEnrollment.semesterSchedule.colType'), mobileVisible: true },
            { key: 'docStatus', label: t('studentEnrollment.semesterSchedule.colStatus'), mobileVisible: true },
          ]}
          rows={rows}
        />
      ) : null}
    </div>
  );
}

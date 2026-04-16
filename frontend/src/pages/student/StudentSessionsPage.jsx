import { useMemo } from 'react';
import { CalendarDays, Video, MapPin, Bell } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import { fetchSessionsByCohort } from '../../features/sessions/sessions.service.js';
import { sessionsKeys } from '../../features/sessions/hooks/useSessions.js';
import { tr } from '../../utils/i18n.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentSessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const {
    data: assessmentsPayload,
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    error: assessmentsErrorObj,
  } = useAssessments({}, { staleTime: 30_000 });
  const cohortIds = useMemo(
    () => [...new Set((assessmentsPayload?.assessments ?? []).map((a) => a.cohort?.id ?? a.cohort_id).filter(Boolean))],
    [assessmentsPayload]
  );
  const sessionQueries = useQueries({
    queries: cohortIds.map((cid) => ({
      queryKey: sessionsKeys.byCohort(cid),
      queryFn: () => fetchSessionsByCohort(cid),
      enabled: Boolean(cid),
      staleTime: 30_000,
    })),
  });
  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const sessionsError = sessionQueries.find((q) => q.isError)?.error;

  const rows = useMemo(() => {
    const out = [];
    cohortIds.forEach((cid, idx) => {
      const sess = sessionQueries[idx]?.data?.sessions ?? [];
      const cohortTitle =
        (assessmentsPayload?.assessments ?? []).find((a) => (a.cohort?.id ?? a.cohort_id) === cid)?.cohort?.title ??
        '—';
      for (const s of sess) {
        out.push({
          id: s.id,
          when: `${String(s.session_date ?? '').slice(0, 10)} ${String(s.start_time ?? '').slice(0, 5)}`,
          title: s.title,
          course: cohortTitle,
          link: s.session_type === 'online' ? tr(isArabic, 'انضمام', 'Join') : tr(isArabic, 'حضوري', 'Onsite'),
          session_type: s.session_type,
        });
      }
    });
    return out;
  }, [cohortIds, sessionQueries, assessmentsPayload, isArabic]);

  const online = useMemo(
    () => rows.filter((r) => String(r.session_type).toLowerCase() === 'online').length,
    [rows]
  );
  const onsite = useMemo(() => rows.length - online, [rows, online]);
  const loading = assessmentsLoading || sessionsLoading;
  const loadError = assessmentsError
    ? getApiErrorMessage(assessmentsErrorObj)
    : sessionsError
      ? getApiErrorMessage(sessionsError)
      : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={tr(isArabic, 'الجلسات', 'Sessions')}
        description={tr(
          isArabic,
          'جدول جلساتك الحضورية والافتراضية والروابط والتذكيرات.',
          'Your onsite and online sessions schedule with links and reminders.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمساق أو التاريخ', 'Search by course or date')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'هذا الأسبوع', 'This week')} value={String(rows.length)} icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'عن بُعد', 'Online')} value={String(online)} icon={Video} />
        <StatCard label={tr(isArabic, 'حضوري', 'Onsite')} value={String(onsite)} icon={MapPin} />
        <StatCard label={tr(isArabic, 'تذكيرات', 'Reminders')} value={String(rows.length)} icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'الجلسات القادمة', 'Upcoming sessions')}>
        {loading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!loading ? (
          <DataTable
            emptyTitle={tr(isArabic, 'لا توجد جلسات', 'No sessions')}
            emptyDescription={tr(isArabic, 'لا توجد جلسات مطابقة.', 'No matching sessions.')}
            columns={[
              { key: 'when', label: tr(isArabic, 'الوقت', 'Time') },
              { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
              { key: 'course', label: tr(isArabic, 'المساق', 'Course') },
              { key: 'link', label: tr(isArabic, 'الرابط', 'Link') },
            ]}
            rows={loadError ? [] : rows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ClipboardCheck, Percent, Calendar, UserCheck } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import { fetchSessionsByCohort } from '../../features/sessions/sessions.service.js';
import { sessionsKeys } from '../../features/sessions/hooks/useSessions.js';
import { fetchSessionAttendance } from '../../features/attendance/attendance.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentAttendancePage() {
  const { user } = useAuth();
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
  const sessionList = useMemo(() => {
    const out = [];
    cohortIds.forEach((cid, idx) => {
      const sessions = sessionQueries[idx]?.data?.sessions ?? [];
      for (const s of sessions) out.push(s);
    });
    return out;
  }, [cohortIds, sessionQueries]);
  const attendanceQueries = useQueries({
    queries: sessionList.map((s) => ({
      queryKey: ['attendance', 'session', s.id],
      queryFn: () => fetchSessionAttendance(s.id),
      enabled: Boolean(s.id),
      staleTime: 30_000,
    })),
  });
  const attendanceLoading = attendanceQueries.some((q) => q.isLoading);
  const attendanceError = attendanceQueries.find((q) => q.isError)?.error;

  const rows = useMemo(() => {
    const list = [];
    for (let i = 0; i < sessionList.length; i += 1) {
      const session = sessionList[i];
      const payload = attendanceQueries[i]?.data;
      const mine = (payload?.students ?? []).find((s) => s.student_id === user?.id);
      if (!mine) continue;
      list.push({
        id: `${session.id}-${mine.student_id}`,
        course: session.title,
        sessions: String(session.session_date ?? '').slice(0, 10),
        rate: mine.record?.attendance_status ?? 'absent',
        status: mine.record?.attendance_status ?? 'absent',
      });
    }
    return list;
  }, [sessionList, attendanceQueries, user?.id]);

  const presentCount = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount = rows.filter((r) => r.status === 'absent').length;
  const counted = rows.length;
  const rate = counted ? Math.round((presentCount / counted) * 100) : 0;
  const loading = assessmentsLoading || sessionsLoading || attendanceLoading;
  const loadError = assessmentsError
    ? getApiErrorMessage(assessmentsErrorObj)
    : sessionsError
      ? getApiErrorMessage(sessionsError)
      : attendanceError
        ? getApiErrorMessage(attendanceError)
        : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="الحضور" description="عرض نسب حضورك في الجلسات وفق كل مساق مسجّل." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمساق" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="نسبة الحضور" value={`${rate}%`} icon={Percent} />
        <StatCard label="جلسات محسوبة" value={String(counted)} icon={Calendar} />
        <StatCard label="حضور" value={String(presentCount)} icon={UserCheck} />
        <StatCard label="غياب" value={String(absentCount)} icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title="التفصيل حسب المساق">
        {loading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!loading ? (
          <DataTable
            columns={[
              { key: 'course', label: 'المساق' },
              { key: 'sessions', label: 'الجلسات' },
              { key: 'rate', label: 'النسبة' },
              { key: 'status', label: 'الحالة' },
            ]}
            rows={loadError ? [] : rows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

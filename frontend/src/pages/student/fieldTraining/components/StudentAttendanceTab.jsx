import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../components/admin/AdminStatsGrid.jsx';
import { useStudentFieldTrainingSessions } from '../../../../features/fieldTraining/index.js';
import { Calendar, CheckCircle2, XCircle, Percent } from 'lucide-react';

export function StudentAttendanceTab({ opportunityId, progress, opp, enabled }) {
  const { t } = useTranslation('fieldTraining');
  const { data: sessionsData } = useStudentFieldTrainingSessions(opportunityId, { enabled });

  const sessions = sessionsData?.sessions ?? [];
  const requiredSessions = sessions.filter((s) => s.is_required !== false);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    requiredSessions.forEach((s) => {
      const st = s.attendance?.status;
      if (st === 'present' || st === 'late' || st === 'excused') present += 1;
      else if (st === 'absent') absent += 1;
    });
    return { total: requiredSessions.length, present, absent };
  }, [requiredSessions]);

  const pct = progress?.metrics?.attendance_percentage;
  const minPct = opp?.minimum_attendance_percentage ?? 80;
  const eligible = pct != null && pct >= minPct;

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.attendanceLocked')}</p>;
  }

  return (
    <div className="ft-student-attendance">
      <AdminStatsGrid>
        <StatCard
          label={t('studentTraining.attendance.totalSessions')}
          value={counts.total}
          icon={Calendar}
        />
        <StatCard
          label={t('studentTraining.attendance.present')}
          value={counts.present}
          icon={CheckCircle2}
        />
        <StatCard
          label={t('studentTraining.attendance.absent')}
          value={counts.absent}
          icon={XCircle}
        />
        <StatCard
          label={t('progress.attendance')}
          value={pct != null ? `${pct}%` : '—'}
          hint={t('studentTraining.attendance.minRequired', { min: minPct })}
          icon={Percent}
        />
      </AdminStatsGrid>

      <div
        className={`ft-attendance-eligibility${eligible ? ' ft-attendance-eligibility--ok' : ' ft-attendance-eligibility--warn'}`}
        role="status"
      >
        {eligible
          ? t('studentTraining.attendance.eligible')
          : t('studentTraining.attendance.notEligible')}
      </div>
    </div>
  );
}

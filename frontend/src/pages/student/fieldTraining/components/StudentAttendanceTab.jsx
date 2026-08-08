import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, CheckCircle2, XCircle, Percent, Clock, Shield, HelpCircle } from 'lucide-react';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../components/admin/AdminStatsGrid.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { TrainingHoursProgressCard } from '../../../../components/fieldTraining/TrainingHoursProgressCard.jsx';
import { useStudentFieldTrainingSessions } from '../../../../features/fieldTraining/index.js';
import { StudentActiveAttendanceCard } from './StudentActiveAttendanceCard.jsx';

function attendanceBadgeVariant(status) {
  switch (status) {
    case 'present':
      return 'success';
    case 'absent':
      return 'danger';
    case 'late':
      return 'warning';
    case 'excused':
      return 'info';
    case 'unconfirmed':
      return 'warning';
    default:
      return 'muted';
  }
}

export function StudentAttendanceTab({ opportunityId, progress, opp, enabled }) {
  const { t } = useTranslation('fieldTraining');
  const {
    data: sessionsData,
    isLoading,
    isError,
  } = useStudentFieldTrainingSessions(opportunityId, { enabled });

  const sessions = sessionsData?.sessions ?? [];

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unconfirmed = 0;
    let notRecorded = 0;
    sessions.forEach((s) => {
      const st = s.attendance?.status;
      if (st === 'present') present += 1;
      else if (st === 'absent') absent += 1;
      else if (st === 'late') late += 1;
      else if (st === 'excused') excused += 1;
      else if (st === 'unconfirmed') unconfirmed += 1;
      else notRecorded += 1;
    });
    return {
      total: sessions.length,
      present,
      absent,
      late,
      excused,
      unconfirmed,
      notRecorded,
    };
  }, [sessions]);

  const pct = progress?.metrics?.attendance_percentage;
  const minPct = opp?.minimum_attendance_percentage ?? 80;
  const eligible = pct != null && pct >= minPct;

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.attendanceLocked')}</p>;
  }
  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <p className="form-field__error">{t('studentTraining.loadError')}</p>;
  }

  return (
    <div className="ft-student-attendance">
      <StudentActiveAttendanceCard opportunityId={opportunityId} />
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
          label={t('studentTraining.attendance.late')}
          value={counts.late}
          icon={Clock}
        />
        <StatCard
          label={t('studentTraining.attendance.excused')}
          value={counts.excused}
          icon={Shield}
        />
        <StatCard
          label={t('attendance.statuses.unconfirmed')}
          value={counts.unconfirmed}
          icon={HelpCircle}
        />
        <StatCard
          label={t('progress.attendance')}
          value={pct != null ? `${pct}%` : t('notAvailable')}
          hint={t('studentTraining.attendance.minRequired', { min: minPct })}
          icon={Percent}
        />
      </AdminStatsGrid>

      <TrainingHoursProgressCard
        hours={progress?.hours ?? progress?.metrics}
        className="ft-student-attendance__hours"
      />

      <div
        className={`ft-attendance-eligibility${eligible ? ' ft-attendance-eligibility--ok' : ' ft-attendance-eligibility--warn'}`}
        role="status"
      >
        {eligible
          ? t('studentTraining.attendance.eligible')
          : t('studentTraining.attendance.notEligible')}
      </div>

      <section className="ft-student-attendance__sessions" aria-labelledby="ft-attendance-sessions-heading">
        <h3 id="ft-attendance-sessions-heading" className="ft-student-attendance__sessions-title">
          {t('studentTraining.attendance.sessionListTitle')}
        </h3>
        {!sessions.length ? (
          <p className="ft-manage-empty">{t('studentTraining.noSessions')}</p>
        ) : (
          <ul className="ft-student-sessions">
            {sessions.map((s) => {
              const status = s.attendance?.status;
              return (
                <li key={s.id} className="ft-student-session-card">
                  <div className="ft-student-session-card__main">
                    <Calendar size={18} aria-hidden />
                    <div>
                      <strong>{s.title}</strong>
                      <p>
                        {s.session_date}
                        {s.start_time && s.end_time ? ` · ${s.start_time}–${s.end_time}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="ft-student-session-card__meta">
                    <StatusBadge variant={s.is_required !== false ? 'warning' : 'muted'}>
                      {s.is_required !== false
                        ? t('studentTraining.sessions.required')
                        : t('studentTraining.sessions.optional')}
                    </StatusBadge>
                    {status ? (
                      <StatusBadge variant={attendanceBadgeVariant(status)}>
                        {t(`attendanceStatus.${status}`, {
                          defaultValue: t(`attendance.statuses.${status}`, { defaultValue: status }),
                        })}
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="muted">
                        {t('studentTraining.attendanceNotRecorded')}
                      </StatusBadge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

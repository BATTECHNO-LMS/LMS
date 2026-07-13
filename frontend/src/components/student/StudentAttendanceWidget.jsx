import { useTranslation } from 'react-i18next';

/**
 * @param {{
 *   percentage: number | null,
 *   breakdown?: { present: number, absent: number, late: number, excused: number, total: number, recorded: number } | null,
 *   lowThreshold?: number,
 * }} props
 */
export function StudentAttendanceWidget({ percentage, breakdown = null, lowThreshold = 75 }) {
  const { t } = useTranslation('dashboard');
  const pct =
    percentage == null || Number.isNaN(Number(percentage))
      ? null
      : Math.min(100, Math.max(0, Number(percentage)));
  const deg = pct == null ? 0 : (pct / 100) * 360;
  const low = pct != null && pct < lowThreshold;
  const total = breakdown?.total ?? 0;
  const recorded = breakdown?.recorded ?? 0;

  let emptyMsg = null;
  if (total <= 0) emptyMsg = t('student.dashboard.empty.sessionsNotStarted');
  else if (recorded <= 0) emptyMsg = t('student.dashboard.empty.attendanceNotRecorded');

  return (
    <div className="student-attendance">
      <div className="student-attendance__ring-wrap">
        <div className="student-attendance__ring" style={{ '--p': `${deg}deg` }}>
          <div className="student-attendance__ring-inner">
            {pct == null ? '0%' : `${Math.round(pct)}%`}
          </div>
        </div>
        <p className="student-attendance__hint">
          {emptyMsg || t('student.dashboard.kpi.attendance')}
        </p>
      </div>

      {breakdown && total > 0 ? (
        <ul className="student-attendance__breakdown">
          <li>
            <span>{t('student.dashboard.attendance.required')}</span>
            <strong>{total}</strong>
          </li>
          <li>
            <span>{t('student.dashboard.attendance.present')}</span>
            <strong>{breakdown.present}</strong>
          </li>
          <li>
            <span>{t('student.dashboard.attendance.absent')}</span>
            <strong>{breakdown.absent}</strong>
          </li>
          <li>
            <span>{t('student.dashboard.attendance.late')}</span>
            <strong>{breakdown.late}</strong>
          </li>
          <li>
            <span>{t('student.dashboard.attendance.excused')}</span>
            <strong>{breakdown.excused}</strong>
          </li>
        </ul>
      ) : null}

      {low ? (
        <p className="student-attendance__warn">
          {t('student.dashboard.attendance.lowWarning', { pct: lowThreshold })}
        </p>
      ) : null}
    </div>
  );
}

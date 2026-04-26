import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * @param {{ percentage: number | null, lowThreshold?: number }} props
 */
export function StudentAttendanceWidget({ percentage, lowThreshold = 75 }) {
  const { t } = useTranslation('dashboard');
  const pct = percentage == null || Number.isNaN(Number(percentage)) ? null : Math.min(100, Math.max(0, Number(percentage)));
  const deg = pct == null ? 0 : (pct / 100) * 360;
  const low = pct != null && pct < lowThreshold;

  return (
    <div className="student-attendance">
      <div className="student-attendance__ring-wrap">
        <div className="student-attendance__ring" style={{ '--p': `${deg}deg` }}>
          <div className="student-attendance__ring-inner">{pct == null ? '—' : `${Math.round(pct)}%`}</div>
        </div>
        <p className="crud-muted" style={{ margin: 0, maxWidth: '20rem', fontSize: '0.875rem' }}>
          {pct == null ? t('student.dashboard.empty.attendance') : t('student.dashboard.kpi.attendance')}
        </p>
      </div>
      {low ? (
        <p className="student-attendance__warn">{t('student.dashboard.attendance.lowWarning', { pct: lowThreshold })}</p>
      ) : null}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, BarChart } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * @param {{
 *   programTitle: string,
 *   cohortTitle: string,
 *   progressPercent: number | null,
 *   attendance: string | number,
 *   statusLabel: string,
 *   linkTo: string,
 * }} props
 */
export function StudentProgramCard({
  programTitle,
  cohortTitle,
  progressPercent,
  attendance,
  statusLabel,
  linkTo,
}) {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const showProgress = progressPercent != null && !Number.isNaN(Number(progressPercent));

  return (
    <div className="student-program-card">
      <div className="student-program-card__header">
        <div className="student-program-card__icon">
          <BookOpen size={20} aria-hidden />
        </div>
        <div className="student-program-card__info">
          <h4 className="student-program-card__title">{programTitle}</h4>
          <div className="student-program-card__subtitle">
            <Users size={14} aria-hidden />
            <span>{cohortTitle}</span>
          </div>
        </div>
        <span className="status-badge status-badge--neutral">{statusLabel}</span>
      </div>

      <div className="student-program-card__content">
        {showProgress ? (
          <div className="student-program-card__metric">
            <div className="student-program-card__metric-label">
              <span>{t('student.dashboard.program.progress')}</span>
              <span>{Math.round(Number(progressPercent))}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{ width: `${Math.min(100, Math.max(0, Number(progressPercent)))}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="student-program-card__footer">
          <div className="student-program-card__meta">
            <BarChart size={14} aria-hidden />
            <span>{t('student.dashboard.program.attendanceLabel', { pct: attendance })}</span>
          </div>
          <Link to={linkTo} className="btn btn--outline btn--sm">
            {tCommon('actions.viewDetails')}
          </Link>
        </div>
      </div>
    </div>
  );
}

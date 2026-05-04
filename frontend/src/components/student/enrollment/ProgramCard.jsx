import { Link } from 'react-router-dom';
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/helpers.js';
import { EnrollmentStatusBadge } from './EnrollmentStatusBadge.jsx';

/**
 * @param {{
 *   microCredentialTitle: string,
 *   cohortTitle: string,
 *   status: string,
 *   statusLabel: string,
 *   progressLabel?: string,
 *   progressPercent?: number | null,
 *   enterLabel: string,
 *   to: string,
 *   isRtl?: boolean,
 * }} props
 */
export function ProgramCard({
  microCredentialTitle,
  cohortTitle,
  status,
  statusLabel,
  progressLabel,
  progressPercent,
  enterLabel,
  to,
  isRtl,
}) {
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  const showProgress = progressPercent != null && Number.isFinite(Number(progressPercent));

  return (
    <Link to={to} className={cn('student-program-card-link')}>
      <div className="student-program-card-link__top">
        <div className="student-program-card-link__icon" aria-hidden>
          <GraduationCap size={22} />
        </div>
        <div className="student-program-card-link__body">
          <h3 className="student-program-card-link__title">{microCredentialTitle}</h3>
          <p className="student-program-card-link__sub">{cohortTitle}</p>
        </div>
        <EnrollmentStatusBadge status={status} label={statusLabel} />
      </div>
      {showProgress && progressLabel ? (
        <div className="student-program-card-link__progress">
          <div className="student-program-card-link__progress-label">
            <span>{progressLabel}</span>
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
      <div className="student-program-card-link__footer">
        <span className="btn btn--primary student-program-card-link__cta">
          {enterLabel}
          <Chevron size={18} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

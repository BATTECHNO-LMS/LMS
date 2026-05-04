import { Link } from 'react-router-dom';
import { CalendarRange, Building2, GraduationCap, Users, Route as RouteIcon } from 'lucide-react';
import { Button } from '../../common/Button.jsx';
import { EnrollmentStatusBadge } from './EnrollmentStatusBadge.jsx';
import { cn } from '../../../utils/helpers.js';

/**
 * @param {{
 *   cohort: Record<string, unknown>,
 *   enrollment?: Record<string, unknown> | null,
 *   catalogStatusLabel: string,
 *   cohortStatusLabel: string,
 *   pendingLabel: string,
 *   registerLabel: string,
 *   waitLabel: string,
 *   rejectedLabel: string,
 *   registeredLabel: string,
 *   enterProgramLabel: string,
 *   rejectedRequestLabel: string,
 *   trackLabel: string,
 *   capacityLine: string,
 *   onRegister: () => void,
 *   registerDisabled?: boolean,
 *   isArabic?: boolean,
 * }} props
 */
export function CohortCard({
  cohort,
  enrollment,
  catalogStatusLabel,
  cohortStatusLabel,
  pendingLabel,
  registerLabel,
  waitLabel,
  rejectedLabel,
  registeredLabel,
  enterProgramLabel,
  rejectedRequestLabel,
  trackLabel,
  capacityLine,
  onRegister,
  registerDisabled,
  isArabic: _isArabic,
}) {
  const mc = cohort.micro_credential;
  const track = mc?.track;
  const uni = cohort.university;
  const desc = mc?.description || '';
  const enStatus = enrollment?.enrollment_status;
  const isPending = enStatus === 'pending';
  const isRejected = enStatus === 'rejected' || enStatus === 'cancelled';
  const isEnrolled = enStatus === 'enrolled' || enStatus === 'completed';

  return (
    <article className="student-cohort-card">
      <div className="student-cohort-card__head">
        <div className="student-cohort-card__titles">
          <h3 className="student-cohort-card__name">{cohort.title}</h3>
          <p className="student-cohort-card__mc">
            <GraduationCap size={16} aria-hidden />
            <span>{mc?.title ?? '—'}</span>
          </p>
        </div>
        <span className="student-cohort-card__catalog-badge">{catalogStatusLabel}</span>
      </div>

      <div className="student-cohort-card__meta">
        <div className="student-cohort-card__meta-row">
          <Building2 size={16} aria-hidden />
          <span>{uni?.name ?? '—'}</span>
        </div>
        <div className="student-cohort-card__meta-row">
          <CalendarRange size={16} aria-hidden />
          <span>
            {cohort.start_date} — {cohort.end_date}
          </span>
        </div>
        <div className="student-cohort-card__meta-row">
          <Users size={16} aria-hidden />
          <span>{cohortStatusLabel}</span>
        </div>
        {track?.title ? (
          <div className="student-cohort-card__meta-row">
            <RouteIcon size={16} aria-hidden />
            <span>
              {trackLabel}: {track.title}
            </span>
          </div>
        ) : null}
        {capacityLine ? <p className="student-cohort-card__capacity">{capacityLine}</p> : null}
      </div>

      {desc ? <p className="student-cohort-card__desc">{desc}</p> : null}

      <div className="student-cohort-card__actions">
        {enrollment && isEnrolled ? (
          <EnrollmentStatusBadge status={enStatus} label={registeredLabel} />
        ) : null}
        {enrollment && (isPending || isRejected) ? (
          <EnrollmentStatusBadge
            status={enStatus}
            label={isPending ? pendingLabel : isRejected ? rejectedLabel : String(enStatus)}
          />
        ) : null}
        {isEnrolled ? (
          <Link className={cn('btn', 'btn--primary', 'student-cohort-card__cta')} to={`/student/programs/${cohort.id}`}>
            {enterProgramLabel}
          </Link>
        ) : isRejected ? (
          <Button type="button" variant="outline" className={cn('student-cohort-card__cta')} disabled>
            {rejectedRequestLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className={cn('student-cohort-card__cta')}
            disabled={registerDisabled || isPending}
            onClick={onRegister}
          >
            <>{isPending ? waitLabel : registerLabel}</>
          </Button>
        )}
      </div>
    </article>
  );
}

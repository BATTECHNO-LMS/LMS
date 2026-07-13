import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  CalendarRange,
  Clock3,
  MapPin,
  User,
  Video,
  ArrowLeft,
} from 'lucide-react';
import { StudentStatusBadge } from '../../components/student/StudentStatusBadge.jsx';
import { StudentProgressBar } from '../../components/student/StudentProgressBar.jsx';
import {
  trainingStatusVariant,
  applicationBadgeVariant,
} from '../../features/fieldTraining/index.js';

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Clickable field-training card for the student semester schedule.
 */
export function SemesterFieldTrainingCard({ item }) {
  const { t, i18n } = useTranslation(['enrollments', 'fieldTraining']);
  const locale = i18n.language || 'ar';
  const to = `/student/field-training/${item.opportunity_id}`;
  const specialty =
    item.specialty?.name_ar || item.specialty?.name_en || item.specialty?.code || null;
  const modeKey = item.training_mode ? `fieldTraining:modes.${item.training_mode}` : null;
  const progress = Math.min(100, Math.max(0, Number(item.progress_percent) || 0));
  const isPendingApp = String(item.application_status || '') === 'pending';
  const statusLabel = isPendingApp
    ? t(`fieldTraining:applicationStatus.${item.application_status}`, item.application_status)
    : t(`fieldTraining:trainingStatus.${item.training_status}`, item.training_status);
  const statusVariant = isPendingApp
    ? applicationBadgeVariant(item.application_status)
    : trainingStatusVariant(item.training_status);
  const phase = item.display_phase?.key || 'not_started';
  const phaseMessage = isPendingApp
    ? t('enrollments:studentEnrollment.semesterSchedule.ft.phasePending')
    : phase === 'completed'
      ? t('enrollments:studentEnrollment.semesterSchedule.ft.phaseCompleted')
      : phase === 'in_training'
        ? t('enrollments:studentEnrollment.semesterSchedule.ft.phaseInTraining')
        : item.display_phase?.starts_on
          ? t('enrollments:studentEnrollment.semesterSchedule.ft.phaseStartsOn', {
              date: formatDate(item.display_phase.starts_on, locale),
            })
          : t('enrollments:studentEnrollment.semesterSchedule.ft.phaseNotStarted');

  const upcoming = item.upcoming_session;
  const hours =
    item.total_training_hours != null
      ? t('enrollments:studentEnrollment.semesterSchedule.ft.hoursValue', {
          hours: item.total_training_hours,
        })
      : t('enrollments:studentEnrollment.semesterSchedule.ft.hoursUnknown');

  return (
    <Link to={to} className="semester-ft-card">
      <header className="semester-ft-card__head">
        <div className="semester-ft-card__title-wrap">
          <span className="semester-ft-card__icon" aria-hidden>
            <Briefcase size={18} strokeWidth={2} />
          </span>
          <div>
            <h3 className="semester-ft-card__title">
              {item.title || t('enrollments:studentEnrollment.semesterSchedule.ft.untitled')}
            </h3>
            {specialty ? <p className="semester-ft-card__specialty">{specialty}</p> : null}
          </div>
        </div>
        <StudentStatusBadge variant={statusVariant}>{statusLabel}</StudentStatusBadge>
      </header>

      <p className="semester-ft-card__phase">{phaseMessage}</p>

      <div className="semester-ft-card__metrics">
        <div className="semester-ft-card__metric">
          <span className="semester-ft-card__metric-label">
            <Clock3 size={14} aria-hidden />
            {t('enrollments:studentEnrollment.semesterSchedule.ft.duration')}
          </span>
          <strong>{hours}</strong>
        </div>
        <div className="semester-ft-card__metric">
          <span className="semester-ft-card__metric-label">
            <CalendarRange size={14} aria-hidden />
            {t('enrollments:studentEnrollment.semesterSchedule.ft.dates')}
          </span>
          <strong>
            {formatDate(item.start_date, locale) || '—'}
            {' → '}
            {formatDate(item.end_date, locale) || '—'}
          </strong>
        </div>
        <div className="semester-ft-card__metric">
          <span className="semester-ft-card__metric-label">
            <User size={14} aria-hidden />
            {t('enrollments:studentEnrollment.semesterSchedule.ft.instructor')}
          </span>
          <strong>
            {item.instructor?.full_name ||
              t('enrollments:studentEnrollment.semesterSchedule.ft.instructorPending')}
          </strong>
        </div>
        <div className="semester-ft-card__metric">
          <span className="semester-ft-card__metric-label">
            <MapPin size={14} aria-hidden />
            {t('enrollments:studentEnrollment.semesterSchedule.ft.mode')}
          </span>
          <strong>
            {modeKey ? t(modeKey, item.training_mode) : '—'}
            {item.location ? ` · ${item.location}` : ''}
          </strong>
        </div>
      </div>

      <div className="semester-ft-card__progress">
        <StudentProgressBar
          value={progress}
          showLabel
          label={t('enrollments:studentEnrollment.semesterSchedule.ft.progress')}
        />
        {item.attendance_percentage != null ? (
          <p className="semester-ft-card__attendance">
            {t('enrollments:studentEnrollment.semesterSchedule.ft.attendance', {
              pct: Math.round(Number(item.attendance_percentage)),
            })}
          </p>
        ) : null}
      </div>

      <div className="semester-ft-card__upcoming">
        {upcoming ? (
          <>
            <p className="semester-ft-card__upcoming-title">
              {t('enrollments:studentEnrollment.semesterSchedule.ft.upcomingSession')}
            </p>
            <p className="semester-ft-card__upcoming-meta">
              {upcoming.title} · {formatDate(upcoming.session_date, locale)}{' '}
              {upcoming.start_time}
              {upcoming.end_time ? `–${upcoming.end_time}` : ''}
            </p>
            {upcoming.zoom_link ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(upcoming.zoom_link, '_blank', 'noopener,noreferrer');
                }}
              >
                <Video size={14} aria-hidden />
                {t('enrollments:studentEnrollment.semesterSchedule.ft.joinZoom')}
              </button>
            ) : null}
          </>
        ) : (
          <p className="semester-ft-card__upcoming-empty">
            {t('enrollments:studentEnrollment.semesterSchedule.ft.noUpcoming')}
          </p>
        )}
      </div>

      <footer className="semester-ft-card__footer">
        <span className="btn btn--primary btn--sm">
          {t('enrollments:studentEnrollment.semesterSchedule.ft.continue')}
          <ArrowLeft size={14} aria-hidden />
        </span>
      </footer>
    </Link>
  );
}

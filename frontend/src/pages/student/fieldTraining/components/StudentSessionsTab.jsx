import { Calendar, ExternalLink, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { useStudentFieldTrainingSessions } from '../../../../features/fieldTraining/index.js';

export function StudentSessionsTab({ opportunityId, enabled }) {
  const { t } = useTranslation('fieldTraining');
  const { data, isLoading, isError } = useStudentFieldTrainingSessions(opportunityId, { enabled });

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.sessionsLocked')}</p>;
  }
  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <p className="form-field__error">{t('studentTraining.loadError')}</p>;
  }

  const sessions = data?.sessions ?? [];

  if (!sessions.length) {
    return <p className="ft-manage-empty">{t('studentTraining.noSessions')}</p>;
  }

  return (
    <ul className="ft-student-sessions">
      {sessions.map((s) => (
        <li key={s.id} className="ft-student-session-card">
          <div className="ft-student-session-card__main">
            <Calendar size={18} aria-hidden />
            <div>
              <strong>{s.title}</strong>
              <p>
                {s.session_date} · {s.start_time}–{s.end_time}
              </p>
              {s.description ? <p className="ft-student-session-card__desc">{s.description}</p> : null}
            </div>
          </div>
          <div className="ft-student-session-card__meta">
            <StatusBadge variant={s.is_required ? 'warning' : 'muted'}>
              {s.is_required ? t('studentTraining.sessions.required') : t('studentTraining.sessions.optional')}
            </StatusBadge>
            {s.attendance?.status ? (
              <StatusBadge variant="info">
                {t(`attendanceStatus.${s.attendance.status}`)}
              </StatusBadge>
            ) : (
              <span className="ft-student-session-card__muted">
                {t('studentTraining.attendanceNotRecorded')}
              </span>
            )}
          </div>
          <div className="ft-student-session-card__actions">
            {s.zoom_link ? (
              <a
                href={s.zoom_link}
                target="_blank"
                rel="noreferrer"
                className="btn btn--primary btn--sm"
              >
                <Video size={14} aria-hidden /> {t('studentTraining.joinSession')}
                <ExternalLink size={12} aria-hidden />
              </a>
            ) : (
              <span className="ft-student-session-card__muted">{t('studentTraining.noZoomLink')}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

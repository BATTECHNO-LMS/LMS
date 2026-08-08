import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StudentStatusBadge } from './StudentStatusBadge.jsx';
import { StudentProgressBar } from './StudentProgressBar.jsx';
import {
  computeProfileCompleteness,
  specialtyDisplayName,
} from '../../features/student/studentDashboard.helpers.js';

function statusVariant(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'pending' || s === 'pending_activation') return 'warning';
  if (s === 'inactive' || s === 'suspended') return 'danger';
  return 'muted';
}

/**
 * Personal header for the student dashboard (real auth profile only).
 */
export function StudentProfileHeader({ user }) {
  const { t, i18n } = useTranslation('dashboard');
  const name = user?.full_name || user?.name || user?.email || '—';
  const email = user?.email || null;
  const uni = user?.university?.name || user?.primary_university?.name || null;
  const specialty = specialtyDisplayName(user?.specialty, i18n.language);
  const completeness = computeProfileCompleteness(user);
  const status = user?.status || null;

  return (
    <section className="student-profile-header section-card" data-tour-id="student-profile">
      <div className="student-profile-header__main">
        <div className="student-profile-header__avatar" aria-hidden>
          <User size={36} strokeWidth={1.5} />
        </div>
        <div className="student-profile-header__info">
          <h2 className="student-profile-header__name">
            {t('student.dashboard.summary.welcomeFull', { name })}
          </h2>
          <p className="student-profile-header__tagline">
            {t('student.dashboard.summary.welcomeLine', { name })}
          </p>
          <dl className="student-profile-header__meta">
            {email ? (
              <div>
                <dt>{t('student.dashboard.profile.email')}</dt>
                <dd dir="ltr">{email}</dd>
              </div>
            ) : null}
            {uni ? (
              <div>
                <dt>{t('student.dashboard.profile.university')}</dt>
                <dd>{uni}</dd>
              </div>
            ) : (
              <div>
                <dt>{t('student.dashboard.profile.university')}</dt>
                <dd>{t('student.dashboard.summary.noUniversity')}</dd>
              </div>
            )}
            {specialty ? (
              <div>
                <dt>{t('student.dashboard.profile.specialty')}</dt>
                <dd>{specialty}</dd>
              </div>
            ) : null}
            {status ? (
              <div>
                <dt>{t('student.dashboard.profile.status')}</dt>
                <dd>
                  <StudentStatusBadge variant={statusVariant(status)}>
                    {t(`student.dashboard.profileStatus.${status}`, {
                      defaultValue: status,
                    })}
                  </StudentStatusBadge>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <div className="student-profile-header__completeness">
        <StudentProgressBar
          value={completeness}
          showLabel
          label={t('student.dashboard.profile.completeness')}
        />
      </div>
    </section>
  );
}

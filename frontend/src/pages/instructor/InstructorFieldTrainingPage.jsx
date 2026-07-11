import { Link, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  ClipboardList,
  ListChecks,
  Users,
  GraduationCap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import {
  fetchInstructorFieldTrainingList,
} from '../../features/fieldTraining/fieldTraining.service.js';
import {
  getOpportunitySpecialtyLabel,
  opportunityStatusVariant,
  formatFtDate,
} from '../../features/fieldTraining/fieldTrainingUi.js';
import { fieldTrainingKeys } from '../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';

function sectionManageTab(section) {
  switch (section) {
    case 'sessions':
    case 'attendance':
      return 'sessions';
    case 'tasks':
    case 'submissions':
      return 'tasks';
    case 'results':
      return 'pre_assessment';
    case 'eligibility':
      return 'eligibility';
    default:
      return 'overview';
  }
}

export function InstructorFieldTrainingPage() {
  const { t, i18n } = useTranslation('fieldTraining');
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || '';
  const { data, isLoading, isError } = useQuery({
    queryKey: fieldTrainingKeys.instructorList(),
    queryFn: () => fetchInstructorFieldTrainingList({ page: 1, page_size: 50 }),
  });

  const opportunities = data?.opportunities ?? [];
  const manageTab = sectionManageTab(section);

  return (
    <div className="page page--dashboard page--instructor ft-page">
      <AdminPageHeader
        title={t('instructor.listTitle')}
        description={t('instructor.listDescription')}
      />

      {section ? (
        <p className="ft-instructor-section-hint">{t(`instructor.sectionHints.${section}`, '')}</p>
      ) : null}

      {isLoading ? <LoadingSpinner /> : null}
      {isError ? <p className="form-field__error">{t('loadError')}</p> : null}

      {!isLoading && !opportunities.length ? (
        <EmptyState
          icon={Briefcase}
          title={t('instructor.emptyTitle')}
          description={t('instructor.emptyDescription')}
        />
      ) : null}

      {!isLoading && opportunities.length ? (
        <ul className="ft-instructor-opp-list">
          {opportunities.map((opp) => {
            const track = getOpportunitySpecialtyLabel(opp, i18n.language, t('form.specialtyUnspecified'));
            const manageTo = `/instructor/field-training/${opp.id}/manage?tab=${manageTab}`;
            return (
              <li key={opp.id} className="ft-instructor-opp-list__item">
                <article className="ft-content-card ft-instructor-opp-card">
                  <header className="ft-instructor-opp-card__head">
                    <div>
                      <h2 className="ft-instructor-opp-card__title">{opp.title}</h2>
                      <p className="ft-instructor-opp-card__meta">
                        <GraduationCap size={14} aria-hidden /> {track}
                      </p>
                      <p className="ft-instructor-opp-card__meta">
                        {formatFtDate(opp.start_date)} — {formatFtDate(opp.end_date)}
                      </p>
                    </div>
                    {opp.status ? (
                      <StatusBadge variant={opportunityStatusVariant(opp.status)}>
                        {t(`status.${opp.status}`)}
                      </StatusBadge>
                    ) : null}
                  </header>

                  <dl className="ft-instructor-opp-card__stats">
                    <div>
                      <dt>{t('instructor.card.universities')}</dt>
                      <dd>{opp.beneficiary_university_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('instructor.card.specialties')}</dt>
                      <dd>{opp.eligible_specialty_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('instructor.card.participants')}</dt>
                      <dd>{opp.participants_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('instructor.card.sessions')}</dt>
                      <dd>{opp.sessions_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('instructor.card.pendingSubmissions')}</dt>
                      <dd>{opp.pending_submissions_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('instructor.card.avgAttendance')}</dt>
                      <dd>
                        {opp.average_attendance != null
                          ? `${opp.average_attendance}%`
                          : t('notAvailable')}
                      </dd>
                    </div>
                  </dl>

                  {opp.next_session ? (
                    <p className="ft-instructor-opp-card__next">
                      <Calendar size={14} aria-hidden />{' '}
                      {t('instructor.card.nextSession')}: {opp.next_session.title} —{' '}
                      {formatFtDate(opp.next_session.session_date)}
                    </p>
                  ) : null}

                  <div className="ft-instructor-opp-card__actions">
                    <Link className="btn btn--primary btn--sm" to={manageTo}>
                      <Briefcase size={16} aria-hidden />
                      {t('manageTraining.title')}
                    </Link>
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/instructor/field-training/${opp.id}/participants`}
                    >
                      <Users size={16} aria-hidden />
                      {t('manageHub.tabs.applications')}
                    </Link>
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/instructor/field-training/${opp.id}/sessions`}
                    >
                      <Calendar size={16} aria-hidden />
                      {t('manageHub.tabs.sessions')}
                    </Link>
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/instructor/field-training/${opp.id}/tasks`}
                    >
                      <ListChecks size={16} aria-hidden />
                      {t('tasks.manageTasks')}
                    </Link>
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/instructor/field-training/${opp.id}/eligibility`}
                    >
                      <ClipboardList size={16} aria-hidden />
                      {t('manageHub.tabs.eligibility')}
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

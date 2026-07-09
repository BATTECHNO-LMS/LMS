import { Link } from 'react-router-dom';
import { Briefcase, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { fetchInstructorFieldTrainingList } from '../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { opportunityStatusVariant, formatFtDate } from '../../features/fieldTraining/fieldTrainingUi.js';

export function InstructorFieldTrainingPage() {
  const { t } = useTranslation('fieldTraining');
  const { data, isLoading, isError } = useQuery({
    queryKey: fieldTrainingKeys.instructorList(),
    queryFn: () => fetchInstructorFieldTrainingList({ page: 1, page_size: 50 }),
  });

  const opportunities = data?.opportunities ?? [];

  return (
    <div className="page page--dashboard page--instructor ft-page">
      <AdminPageHeader
        title={t('instructor.listTitle')}
        description={t('instructor.listDescription')}
      />

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
          {opportunities.map((opp) => (
            <li key={opp.id} className="ft-instructor-opp-list__item">
              <article className="ft-content-card ft-instructor-opp-card">
                <header className="ft-instructor-opp-card__head">
                  <div>
                    <h2 className="ft-instructor-opp-card__title">{opp.title}</h2>
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
                <div className="ft-instructor-opp-card__actions">
                  <Link className="btn btn--outline btn--sm" to={`/instructor/field-training/${opp.id}/manage`}>
                    <Briefcase size={16} aria-hidden />
                    {t('manageTraining.title')}
                  </Link>
                  <Link className="btn btn--primary btn--sm" to={`/instructor/field-training/${opp.id}/tasks`}>
                    <ListChecks size={16} aria-hidden />
                    {t('tasks.manageTasks')}
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

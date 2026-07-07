import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { trainingStatusVariant } from '../../../../../features/fieldTraining/index.js';

export function ManageLinkTab({ opportunityId, tabKey, title, description, to }) {
  const { t } = useTranslation('fieldTraining');
  return (
    <div className="ft-manage-panel ft-manage-panel--link">
      <h2 className="ft-manage-panel__title">{title}</h2>
      <p className="ft-manage-panel__desc">{description}</p>
      <Button as={Link} to={to} variant="primary">
        {t(`manageHub.openTab.${tabKey}`)}
      </Button>
    </div>
  );
}

export function ManageCompletionTab({ applications, onIssueLetter, issuePending }) {
  const { t } = useTranslation('fieldTraining');
  const eligible = (applications ?? []).filter(
    (a) => a.completion_eligibility_status === 'eligible' && a.training_status !== 'expelled'
  );
  const completed = (applications ?? []).filter(
    (a) => a.training_status === 'completed' || a.completion_letter_issued_at
  );

  return (
    <div className="ft-manage-panel">
      <h2 className="ft-manage-panel__title">{t('manageHub.tabs.completion')}</h2>
      <section>
        <h3 className="ft-manage-panel__subtitle">{t('manageHub.eligibleParticipants')}</h3>
        {!eligible.length ? <p className="ft-manage-empty">{t('manageHub.noEligible')}</p> : null}
        <ul className="ft-completion-list">
          {eligible.map((app) => (
            <li key={app.id} className="ft-completion-card">
              <div>
                <strong>{app.student_name}</strong>
                <p>{app.student_email}</p>
                <StatusBadge variant={trainingStatusVariant(app.training_status)}>
                  {t(`trainingStatus.${app.training_status}`, app.training_status)}
                </StatusBadge>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={issuePending}
                onClick={() => onIssueLetter(app.id)}
              >
                {t('completionLetter.issue')}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="ft-manage-panel__subtitle">{t('manageHub.issuedLetters')}</h3>
        {!completed.length ? <p className="ft-manage-empty">{t('manageHub.noLetters')}</p> : null}
        <ul className="ft-completion-list">
          {completed.map((app) => (
            <li key={app.id} className="ft-completion-card">
              <strong>{app.student_name}</strong>
              <span>{app.completion_letter_issued_at?.slice(0, 10) ?? '—'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { Award, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  downloadAdminCompletionLetter,
  trainingStatusVariant,
} from '../../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty } from './ManageTabStates.jsx';

export function ManageCompletionTab({ applications, onIssueLetter, issuePending }) {
  const { t } = useTranslation('fieldTraining');
  const [downloadError, setDownloadError] = useState('');

  const eligible = (applications ?? []).filter(
    (a) =>
      a.completion_eligibility_status === 'eligible' &&
      a.training_status !== 'expelled' &&
      !a.completion_letter_issued_at
  );
  const completed = (applications ?? []).filter(
    (a) => a.training_status === 'completed' || a.completion_letter_issued_at
  );

  const downloadMut = useMutation({
    mutationFn: (applicationId) => downloadAdminCompletionLetter(applicationId),
    onError: (err) => setDownloadError(getApiErrorMessage(err)),
  });

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.completion')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.completionDesc')}</p>
        </div>
      </header>

      {downloadError ? <p className="form-field__error">{downloadError}</p> : null}

      <section className="ft-manage-section">
        <h3 className="ft-manage-panel__subtitle">{t('manageHub.eligibleParticipants')}</h3>
        {!eligible.length ? (
          <ManageTabEmpty icon={Award} title={t('manageHub.noEligible')} />
        ) : (
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
                  {issuePending ? t('saving') : t('completionLetter.issue')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ft-manage-section">
        <h3 className="ft-manage-panel__subtitle">{t('manageHub.issuedLetters')}</h3>
        {!completed.length ? (
          <ManageTabEmpty icon={Award} title={t('manageHub.noLetters')} />
        ) : (
          <ul className="ft-completion-list">
            {completed.map((app) => (
              <li key={app.id} className="ft-completion-card">
                <div>
                  <strong>{app.student_name}</strong>
                  <span>{app.completion_letter_issued_at?.slice?.(0, 10) ?? '—'}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={downloadMut.isPending}
                  onClick={() => {
                    setDownloadError('');
                    downloadMut.mutate(app.id);
                  }}
                >
                  <Download size={16} aria-hidden />
                  {t('completionLetter.download')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

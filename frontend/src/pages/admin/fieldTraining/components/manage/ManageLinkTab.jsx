import { useState } from 'react';
import { Award, Download, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  downloadAdminCompletionLetter,
  previewAdminCompletionLetter,
  trainingStatusVariant,
  TaskProgressBadge,
} from '../../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty } from './ManageTabStates.jsx';

const MIN_LETTER_HOURS = 140;

function hoursOf(app) {
  const n = Number(app?.completed_training_hours);
  return Number.isFinite(n) ? n : 0;
}

export function ManageCompletionTab({ applications, onIssueLetter, issuePending }) {
  const { t } = useTranslation('fieldTraining');
  const [actionError, setActionError] = useState('');

  const eligible = (applications ?? []).filter(
    (a) =>
      a.completion_eligibility_status === 'eligible' &&
      a.training_status !== 'expelled' &&
      !a.completion_letter_issued_at &&
      hoursOf(a) >= MIN_LETTER_HOURS
  );
  const blocked = (applications ?? []).filter(
    (a) =>
      a.status === 'approved' &&
      a.training_status !== 'expelled' &&
      !a.completion_letter_issued_at &&
      (a.completion_eligibility_status !== 'eligible' || hoursOf(a) < MIN_LETTER_HOURS)
  );
  const completed = (applications ?? []).filter(
    (a) => a.training_status === 'completed' || a.completion_letter_issued_at
  );

  const downloadMut = useMutation({
    mutationFn: (applicationId) => downloadAdminCompletionLetter(applicationId),
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });
  const previewMut = useMutation({
    mutationFn: (applicationId) => previewAdminCompletionLetter(applicationId),
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.completion')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.completionDesc')}</p>
        </div>
      </header>

      {actionError ? <p className="form-field__error">{actionError}</p> : null}

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
                  <TaskProgressBadge progress={app.task_progress} />
                </div>
                <div className="ft-completion-card__actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewMut.isPending}
                    onClick={() => {
                      setActionError('');
                      previewMut.mutate(app.id);
                    }}
                  >
                    <Eye size={16} aria-hidden />
                    {t('completionLetter.preview')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={issuePending}
                    onClick={() => onIssueLetter(app.id)}
                  >
                    {issuePending ? t('saving') : t('completionLetter.issue')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocked.length ? (
        <section className="ft-manage-section">
          <h3 className="ft-manage-panel__subtitle">{t('completionLetter.notReadyTitle')}</h3>
          <ul className="ft-completion-list">
            {blocked.slice(0, 12).map((app) => (
              <li key={app.id} className="ft-completion-card">
                <div>
                  <strong>{app.student_name}</strong>
                  <p>
                    {app.completion_eligibility_status !== 'eligible'
                      ? t('completionLetter.notEligible')
                      : t('completionLetter.hoursShort', { hours: hoursOf(app), min: MIN_LETTER_HOURS })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                <div className="ft-completion-card__actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewMut.isPending}
                    onClick={() => {
                      setActionError('');
                      previewMut.mutate(app.id);
                    }}
                  >
                    <Eye size={16} aria-hidden />
                    {t('completionLetter.preview')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={downloadMut.isPending}
                    onClick={() => {
                      setActionError('');
                      downloadMut.mutate(app.id);
                    }}
                  >
                    <Download size={16} aria-hidden />
                    {t('completionLetter.download')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

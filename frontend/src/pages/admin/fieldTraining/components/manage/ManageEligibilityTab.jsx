import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { EmptyState } from '../../../../../components/common/EmptyState.jsx';
import {
  recalculateApplicationEligibility,
  useOpportunityEligibility,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import { EligibilityStudentCard } from './EligibilityStudentCard.jsx';

export function ManageEligibilityTab({ opportunityId, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const { data, isLoading, isError, error, refetch } = useOpportunityEligibility(opportunityId, {
    enabled: Boolean(opportunityId),
    scope: apiScope,
  });

  const recalcMut = useMutation({
    mutationFn: (applicationId) =>
      recalculateApplicationEligibility(applicationId, { asInstructor: isInstructor }),
    onSuccess: () => {
      setActionOk(t('manageHub.studentCards.eligibilityRecalcOk'));
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.eligibility(opportunityId, apiScope) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const participants = data?.participants ?? [];
  const opp = data?.opportunity;

  if (isLoading) return <ManageTabSkeleton rows={3} />;
  if (isError) {
    return <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.eligibility')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.eligibilityDesc')}</p>
        </div>
      </header>

      {opp ? (
        <div className="ft-eligibility-rules">
          <span>
            {t('manageHub.eligibilityRules.attendance')}:{' '}
            <strong>
              {opp.minimum_attendance_percentage != null
                ? `${opp.minimum_attendance_percentage}%`
                : t('manageHub.eligibilityRules.notSet')}
            </strong>
          </span>
          <span>
            {t('hours.required')}:{' '}
            <strong>
              {opp.required_training_hours != null
                ? `${opp.required_training_hours}`
                : t('manageHub.eligibilityRules.notSet')}
            </strong>
          </span>
          {opp.requires_final_task ? (
            <span>
              {t('manageHub.eligibilityRules.postScore')}:{' '}
              <strong>
                {opp.minimum_post_assessment_score != null
                  ? opp.minimum_post_assessment_score
                  : t('manageHub.eligibilityRules.notSet')}
              </strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {actionError ? <p className="form-field__error">{actionError}</p> : null}
      {actionOk ? <p className="auth-register__helper">{actionOk}</p> : null}

      {!participants.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('manageHub.eligibilityEmpty')}
          description={t('manageHub.eligibilityEmptyDesc')}
        />
      ) : (
        <ul className="ft-eligibility-list">
          {participants.map((row) => (
            <EligibilityStudentCard
              key={row.application_id}
              row={row}
              opportunity={opp}
              opportunityId={opportunityId}
              apiScope={apiScope}
              t={t}
              recalcPending={recalcMut.isPending}
              onRecalculate={(applicationId) => {
                setActionError('');
                setActionOk('');
                recalcMut.mutate(applicationId);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

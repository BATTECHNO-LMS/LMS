import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { EmptyState } from '../../../../../components/common/EmptyState.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import {
  recalculateApplicationEligibility,
  useOpportunityEligibility,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';

function eligibilityVariant(status) {
  if (status === 'eligible') return 'success';
  if (status === 'ineligible' || status === 'expelled') return 'danger';
  if (status === 'needs_review') return 'warning';
  return 'muted';
}

function formatReason(reason) {
  if (!reason) return null;
  if (typeof reason === 'string') return reason;
  if (Array.isArray(reason)) return reason.filter(Boolean).join(' · ');
  if (typeof reason === 'object') {
    if (Array.isArray(reason.reasons)) return reason.reasons.join(' · ');
    return Object.entries(reason)
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' · ');
  }
  return String(reason);
}

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
            {t('manageHub.eligibilityRules.postScore')}:{' '}
            <strong>
              {opp.minimum_post_assessment_score != null
                ? opp.minimum_post_assessment_score
                : t('manageHub.eligibilityRules.notSet')}
            </strong>
          </span>
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
          {participants.map((row) => {
            const status =
              row.training_status === 'expelled' ? 'expelled' : row.eligibility_status || 'pending';
            const reason = formatReason(row.eligibility_reason);
            const canRecalc = row.training_status !== 'expelled';
            return (
              <li key={row.application_id} className="ft-content-card ft-eligibility-card">
                <div className="ft-eligibility-card__head">
                  <div>
                    <h3 className="ft-eligibility-card__name">{row.student_name}</h3>
                    <p className="ft-eligibility-card__meta">
                      {[row.student_university, row.student_university_specialty_label]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <StatusBadge variant={eligibilityVariant(status)}>
                    {status === 'expelled'
                      ? t('trainingStatus.expelled')
                      : t(`eligibility.${status}`, status)}
                  </StatusBadge>
                </div>
                <dl className="ft-eligibility-card__grid">
                  <div>
                    <dt>{t('progress.attendance')}</dt>
                    <dd>
                      {row.attendance_percentage != null
                        ? `${row.attendance_percentage}%`
                        : t('notAvailable')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('progress.task')}</dt>
                    <dd>{t(`finalTaskStatus.${row.final_task_status}`, row.final_task_status)}</dd>
                  </div>
                  <div>
                    <dt>{t('progress.postScore')}</dt>
                    <dd>
                      {row.post_assessment_score != null ? row.post_assessment_score : t('notAvailable')}
                    </dd>
                  </div>
                </dl>
                {reason ? <p className="ft-eligibility-card__reason">{reason}</p> : null}
                {canRecalc ? (
                  <div className="ft-manage-inline-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={recalcMut.isPending}
                      onClick={() => {
                        setActionError('');
                        setActionOk('');
                        recalcMut.mutate(row.application_id);
                      }}
                    >
                      <RefreshCw size={14} aria-hidden />
                      {t('manageHub.studentCards.recalculateEligibility')}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

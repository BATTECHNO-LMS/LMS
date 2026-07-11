import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { DataTable } from '../../../../../components/tables/DataTable.jsx';
import {
  downloadFieldTrainingSubmission,
  reviewFieldTrainingSubmission,
  saveFieldTrainingSubmissionBlob,
  useOpportunitySubmissions,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty, ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';

export function ManageSubmissionsTab({ opportunityId, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useOpportunitySubmissions(opportunityId, {
    enabled: Boolean(opportunityId),
    scope: apiScope,
  });

  const [downloadError, setDownloadError] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [actionError, setActionError] = useState('');

  const submissions = data?.submissions ?? [];

  const reviewMut = useMutation({
    mutationFn: ({ submissionId, body }) =>
      reviewFieldTrainingSubmission(submissionId, body, { asInstructor: isInstructor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.submissions(opportunityId, apiScope) });
      setReviewModal(null);
      setReviewFeedback('');
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  async function handleDownload(submissionId) {
    setDownloadError('');
    try {
      const file = await downloadFieldTrainingSubmission(submissionId, {
        asAdmin: !isInstructor,
        asInstructor: isInstructor,
      });
      if (file) saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading) return <ManageTabSkeleton rows={3} />;
  if (isError) {
    return <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('tasks.submissionsTitle')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.submissionsDesc')}</p>
        </div>
        <Button
          as={Link}
          to={`${listBase}/${opportunityId}/tasks#ft-submissions-title`}
          variant="outline"
          className="btn--sm"
        >
          <ExternalLink size={14} aria-hidden />
          {t('manageHub.openFullPage')}
        </Button>
      </header>

      {downloadError || actionError ? (
        <p className="form-field__error" role="alert">
          {downloadError || actionError}
        </p>
      ) : null}

      {!submissions.length ? (
        <ManageTabEmpty
          icon={FileText}
          title={t('tasks.noSubmissionsTitle')}
          description={t('tasks.noSubmissions')}
        />
      ) : (
        <div className="ft-manage-table-wrap">
          <DataTable
            columns={[
              { key: 'student', label: t('table.student'), render: (r) => r.student_name ?? '—' },
              { key: 'task', label: t('tasks.taskTitle'), render: (r) => r.task_title ?? '—' },
              {
                key: 'review',
                label: t('tasks.reviewStatus'),
                render: (r) => (
                  <StatusBadge
                    variant={
                      r.review_status === 'approved'
                        ? 'success'
                        : r.review_status === 'needs_revision' || r.review_status === 'rejected'
                          ? 'warning'
                          : 'muted'
                    }
                  >
                    {t(`tasks.reviewStatuses.${r.review_status || 'pending'}`)}
                  </StatusBadge>
                ),
              },
              {
                key: 'ai',
                label: t('manageHub.aiSelfEval'),
                render: (r) =>
                  r.student_self_evaluation_input ||
                  r.ai_response_inserted_text ||
                  r.ai_raw_response ||
                  r.has_ai_self_evaluation
                    ? t('manageHub.aiSelfEvalYes')
                    : t('manageHub.aiSelfEvalNo'),
              },
              {
                key: 'actions',
                label: t('tasks.review'),
                render: (r) => (
                  <div className="ft-manage-inline-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => handleDownload(r.id)}
                    >
                      {t('tasks.download')}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="btn--sm"
                      onClick={() => {
                        setReviewModal(r);
                        setReviewFeedback(r.instructor_feedback || '');
                        setReviewStatus(
                          r.review_status === 'needs_revision'
                            ? 'needs_revision'
                            : r.review_status === 'rejected'
                              ? 'rejected'
                              : 'approved'
                        );
                        setActionError('');
                      }}
                    >
                      {t('tasks.review')}
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={submissions}
          />
        </div>
      )}

      {reviewModal ? (
        <div className="ft-modal-backdrop" onClick={() => setReviewModal(null)} role="presentation">
          <div
            className="ft-modal ft-modal--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">{t('tasks.review')}</h2>
              <p className="ft-modal__subtitle">
                {reviewModal.student_name} · {reviewModal.task_title}
              </p>
            </header>
            <div className="ft-modal__body">
              {reviewModal.student_self_evaluation_input ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.aiStudentInput')}</h3>
                  <p>{reviewModal.student_self_evaluation_input}</p>
                </div>
              ) : null}
              {reviewModal.project_url ? (
                <div className="ft-manage-review-block">
                  <h3>{t('selfEval.projectUrl')}</h3>
                  <p>
                    <a href={reviewModal.project_url} target="_blank" rel="noreferrer">
                      {reviewModal.project_url}
                    </a>
                  </p>
                </div>
              ) : null}
              {(reviewModal.file_extraction_status || reviewModal.url_extraction_status) ? (
                <div className="ft-manage-review-block">
                  <h3>{t('selfEval.extractionStatus')}</h3>
                  <p>
                    {t('selfEval.fileExtraction')}: {reviewModal.file_extraction_status || '—'}
                    {' · '}
                    {t('selfEval.urlExtraction')}: {reviewModal.url_extraction_status || '—'}
                  </p>
                  {reviewModal.extraction_errors ? <p>{reviewModal.extraction_errors}</p> : null}
                </div>
              ) : null}
              {reviewModal.ai_prompt_used ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.aiPromptUsed')}</h3>
                  <p>{reviewModal.ai_prompt_used}</p>
                </div>
              ) : null}
              {reviewModal.ai_model_provider || reviewModal.ai_model_name ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.aiModel')}</h3>
                  <p>
                    {[reviewModal.ai_model_provider, reviewModal.ai_model_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ) : null}
              {reviewModal.ai_raw_response ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.aiRawResponse')}</h3>
                  <p>{reviewModal.ai_raw_response}</p>
                </div>
              ) : null}
              {reviewModal.ai_response_inserted_text ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.aiResponseInserted')}</h3>
                  <p>{reviewModal.ai_response_inserted_text}</p>
                </div>
              ) : null}
              {reviewModal.final_student_notes ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.finalNotes')}</h3>
                  <p>{reviewModal.final_student_notes}</p>
                </div>
              ) : null}
              {reviewModal.submitted_at ? (
                <div className="ft-manage-review-block">
                  <h3>{t('tasks.submittedAt')}</h3>
                  <p>{String(reviewModal.submitted_at).slice(0, 16).replace('T', ' ')}</p>
                </div>
              ) : null}
              <label className="ft-manage-check">
                <span>{t('tasks.reviewStatus')}</span>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                >
                  <option value="approved">{t('tasks.reviewStatuses.approved')}</option>
                  <option value="rejected">{t('tasks.reviewStatuses.rejected')}</option>
                  <option value="needs_revision">{t('tasks.reviewStatuses.needs_revision')}</option>
                </select>
              </label>
              <FormTextarea
                label={t('tasks.instructorFeedback')}
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={4}
              />
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setReviewModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={reviewMut.isPending}
                onClick={() =>
                  reviewMut.mutate({
                    submissionId: reviewModal.id,
                    body: {
                      review_status: reviewStatus,
                      instructor_feedback: reviewFeedback.trim() || null,
                    },
                  })
                }
              >
                {reviewMut.isPending ? t('saving') : t('tasks.saveReview')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

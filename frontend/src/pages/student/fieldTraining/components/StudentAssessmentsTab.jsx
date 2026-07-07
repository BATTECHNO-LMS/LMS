import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  fetchStudentAssessment,
  submitStudentAssessment,
  useStudentFieldTrainingAssessments,
} from '../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

function AssessmentTakeForm({ opportunityId, type, onDone }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: [...fieldTrainingKeys.studentAssessments(opportunityId), type, 'take'],
    queryFn: () => fetchStudentAssessment(opportunityId, type),
    enabled: Boolean(opportunityId && type),
  });

  const submitMut = useMutation({
    mutationFn: () => submitStudentAssessment(opportunityId, type, answers),
    onSuccess: (res) => {
      setResult(res.attempt);
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentAssessments(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentProgress(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (isLoading) return <LoadingSpinner />;

  const assessment = data?.assessment;
  const existingAttempt = data?.attempt;

  if (existingAttempt && !result) {
    return (
      <div className="ft-assessment-result" role="status">
        <h3>{t('studentTraining.assessment.completed')}</h3>
        <p>
          {t('studentTraining.assessment.score')}: {existingAttempt.score}%
        </p>
        {existingAttempt.level ? (
          <p>{t(`knowledgeLevel.${existingAttempt.level}`)}</p>
        ) : null}
        <Button type="button" variant="outline" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="ft-assessment-result" role="status">
        <h3>{t('studentTraining.assessment.success')}</h3>
        <p>
          {t('studentTraining.assessment.score')}: {result.score}%
        </p>
        {result.level ? <p>{t(`knowledgeLevel.${result.level}`)}</p> : null}
        <Button type="button" variant="primary" onClick={onDone}>
          {t('studentTraining.assessment.done')}
        </Button>
      </div>
    );
  }

  if (!assessment?.questions?.length) {
    return <p className="ft-manage-empty">{t('studentTraining.assessment.notReady')}</p>;
  }

  return (
    <form
      className="ft-assessment-take"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        submitMut.mutate();
      }}
    >
      <h3>{assessment.title}</h3>
      {assessment.description ? <p>{assessment.description}</p> : null}
      {assessment.questions.map((q, idx) => (
        <div key={q.id || idx} className="ft-question-card">
          <p className="ft-question-card__text">
            {idx + 1}. {q.question_text}
          </p>
          {q.question_type === 'multiple_choice' && Array.isArray(q.options) ? (
            <div className="ft-question-card__options">
              {q.options.map((opt) => (
                <label key={String(opt)} className="ft-attendance-chip">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  />
                  <span>{String(opt)}</span>
                </label>
              ))}
            </div>
          ) : q.question_type === 'true_false' ? (
            <div className="ft-question-card__options">
              {['true', 'false'].map((opt) => (
                <label key={opt} className="ft-attendance-chip">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  />
                  <span>{opt === 'true' ? t('studentTraining.assessment.true') : t('studentTraining.assessment.false')}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              className="ft-modal-select__control"
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      {error ? <p className="form-field__error">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={submitMut.isPending}>
        {submitMut.isPending ? t('studentTraining.assessment.submitting') : t('studentTraining.assessment.submit')}
      </Button>
    </form>
  );
}

export function StudentAssessmentsTab({ opportunityId, enabled, opp }) {
  const { t } = useTranslation('fieldTraining');
  const [activeType, setActiveType] = useState(null);
  const { data, isLoading, isError } = useStudentFieldTrainingAssessments(opportunityId, { enabled });

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.assessmentsLocked')}</p>;
  }
  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <p className="form-field__error">{t('studentTraining.loadError')}</p>;
  }

  if (activeType) {
    return (
      <AssessmentTakeForm
        opportunityId={opportunityId}
        type={activeType}
        onDone={() => setActiveType(null)}
      />
    );
  }

  const assessments = data?.assessments ?? [];
  const pre = assessments.find((a) => a.type === 'pre');
  const post = assessments.find((a) => a.type === 'post');

  function renderCard(type, item, titleKey, descKey, required) {
    if (!required) return null;
    if (!item) {
      return (
        <article className="ft-assessment-card ft-assessment-card--muted">
          <h3>{t(titleKey)}</h3>
          <p>{t('studentTraining.assessment.notPublished')}</p>
        </article>
      );
    }

    return (
      <article className="ft-assessment-card">
        <header className="ft-assessment-card__head">
          <h3>{item.title || t(titleKey)}</h3>
          {item.attempt ? (
            <StatusBadge variant="success">{t('studentTraining.assessment.completed')}</StatusBadge>
          ) : item.can_take ? (
            <StatusBadge variant="warning">{t('studentTraining.assessment.available')}</StatusBadge>
          ) : (
            <StatusBadge variant="muted">{t('studentTraining.assessment.locked')}</StatusBadge>
          )}
        </header>
        <p>{t(descKey)}</p>
        {item.attempt ? (
          <p>
            {t('studentTraining.assessment.score')}: {item.attempt.score}%
            {item.attempt.level ? ` · ${t(`knowledgeLevel.${item.attempt.level}`)}` : ''}
          </p>
        ) : null}
        {item.can_take && !item.attempt ? (
          <Button type="button" variant="primary" onClick={() => setActiveType(type)}>
            {t(`studentTraining.assessment.start${type === 'pre' ? 'Pre' : 'Post'}`)}
          </Button>
        ) : null}
      </article>
    );
  }

  const requiresPre = opp?.requires_pre_assessment !== false;
  const requiresPost = opp?.requires_post_assessment !== false;

  return (
    <div className="ft-student-assessments">
      {renderCard(
        'pre',
        pre,
        'studentTraining.assessment.preTitle',
        'studentTraining.assessment.preDesc',
        requiresPre
      )}
      {renderCard(
        'post',
        post,
        'studentTraining.assessment.postTitle',
        'studentTraining.assessment.postDesc',
        requiresPost
      )}
      {!requiresPre && !requiresPost ? (
        <p className="ft-manage-empty">{t('studentTraining.assessment.noneRequired')}</p>
      ) : null}
    </div>
  );
}

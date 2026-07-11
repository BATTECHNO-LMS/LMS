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

function StudentQuestionField({ question, value, onChange, disabled }) {
  const { t } = useTranslation('fieldTraining');
  const type = question.question_type === 'short_answer' ? 'short_text' : question.question_type;

  if (type === 'long_text') {
    return (
      <textarea
        className="ft-qb-input"
        rows={4}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        required={question.is_required !== false}
      />
    );
  }

  if (type === 'short_text') {
    return (
      <input
        className="ft-qb-input"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        required={question.is_required !== false}
      />
    );
  }

  if (type === 'true_false') {
    return (
      <div className="ft-question-card__options">
        {['true', 'false'].map((opt) => (
          <label key={opt} className="ft-attendance-chip">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === opt}
              disabled={disabled}
              onChange={() => onChange(opt)}
              required={question.is_required !== false}
            />
            <span>
              {opt === 'true'
                ? t('studentTraining.assessment.true')
                : t('studentTraining.assessment.false')}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (type === 'multi_select' && Array.isArray(question.options)) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="ft-question-card__options">
        {question.options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label key={String(opt)} className="ft-attendance-chip">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => {
                  onChange(
                    e.target.checked
                      ? [...selected.filter((v) => v !== opt), opt]
                      : selected.filter((v) => v !== opt)
                  );
                }}
              />
              <span>{String(opt)}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'multiple_choice' && Array.isArray(question.options)) {
    return (
      <div className="ft-question-card__options">
        {question.options.map((opt) => (
          <label key={String(opt)} className="ft-attendance-chip">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === opt}
              disabled={disabled}
              onChange={() => onChange(opt)}
              required={question.is_required !== false}
            />
            <span>{String(opt)}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      className="ft-qb-input"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

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
        {existingAttempt.level ? <p>{t(`knowledgeLevel.${existingAttempt.level}`)}</p> : null}
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
        {result.has_pending_manual ? (
          <p className="ft-qb-hint">{t('studentTraining.assessment.pendingManual')}</p>
        ) : null}
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
        for (const q of assessment.questions) {
          if (q.is_required === false) continue;
          const v = answers[q.id];
          const empty =
            v == null ||
            v === '' ||
            (Array.isArray(v) && v.length === 0);
          if (empty) {
            setError(t('studentTraining.assessment.requiredAnswers'));
            return;
          }
        }
        submitMut.mutate();
      }}
    >
      <h3>{assessment.title}</h3>
      {assessment.description ? <p>{assessment.description}</p> : null}
      {assessment.questions.map((q, idx) => (
        <div key={q.id || idx} className="ft-question-card">
          <p className="ft-question-card__text">
            {idx + 1}. {q.question_text}
            {q.is_required !== false ? ' *' : ''}
            <span className="ft-question-card__points"> ({q.points})</span>
          </p>
          <StudentQuestionField
            question={q}
            value={answers[q.id]}
            disabled={submitMut.isPending}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
          />
        </div>
      ))}
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={submitMut.isPending}>
        {submitMut.isPending
          ? t('studentTraining.assessment.submitting')
          : t('studentTraining.assessment.submit')}
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

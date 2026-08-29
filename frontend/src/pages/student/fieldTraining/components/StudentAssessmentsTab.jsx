import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  fetchStudentAssessment,
  saveStudentAssessmentProgress,
  submitStudentAssessment,
  useStudentFieldTrainingAssessments,
} from '../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

function formatRemaining(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function attemptStatusVariant(status) {
  if (status === 'graded' || status === 'submitted') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'muted';
}

function attemptStatusLabel(t, item) {
  const key = item?.attempt_status || (item?.attempt?.submitted_at ? 'graded' : item?.attempt ? 'in_progress' : 'not_started');
  const map = {
    not_started: t('studentTraining.assessment.statusNotStarted'),
    in_progress: t('studentTraining.assessment.statusInProgress'),
    submitted: t('studentTraining.assessment.statusSubmitted'),
    graded: t('studentTraining.assessment.statusGraded'),
  };
  return item?.attempt_status_label || map[key] || map.not_started;
}

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
  const [hydrated, setHydrated] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [savedHint, setSavedHint] = useState(false);
  const autoSubmitRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: [...fieldTrainingKeys.studentAssessments(opportunityId), type, 'take'],
    queryFn: () => fetchStudentAssessment(opportunityId, type),
    enabled: Boolean(opportunityId && type),
  });

  const assessment = data?.assessment;
  const existingAttempt = data?.attempt;
  const submitted = Boolean(existingAttempt?.submitted_at || result?.submitted_at);

  const submitMut = useMutation({
    mutationFn: (payload) => submitStudentAssessment(opportunityId, type, payload),
    onSuccess: (res) => {
      setResult(res.attempt);
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentAssessments(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentProgress(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const saveMut = useMutation({
    mutationFn: (payload) => saveStudentAssessmentProgress(opportunityId, type, payload),
    onSuccess: () => {
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
    },
  });

  useEffect(() => {
    if (!data || hydrated) return;
    if (existingAttempt?.answers && typeof existingAttempt.answers === 'object') {
      setAnswers(existingAttempt.answers);
    }
    if (existingAttempt?.remaining_seconds != null) {
      setRemaining(existingAttempt.remaining_seconds);
    } else if (assessment?.settings?.duration_minutes) {
      setRemaining(Number(assessment.settings.duration_minutes) * 60);
    }
    setHydrated(true);
  }, [data, existingAttempt, assessment, hydrated]);

  useEffect(() => {
    if (submitted || remaining == null) return undefined;
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev == null) return prev;
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [submitted, remaining == null]);

  useEffect(() => {
    if (submitted || remaining !== 0 || autoSubmitRef.current || !assessment?.questions?.length) return;
    autoSubmitRef.current = true;
    submitMut.mutate(answers);
  }, [remaining, submitted, answers, assessment, submitMut]);

  useEffect(() => {
    if (!hydrated || submitted) return undefined;
    const id = window.setTimeout(() => {
      saveMut.mutate(answers);
    }, 8000);
    return () => window.clearTimeout(id);
  }, [answers, hydrated, submitted]);

  if (isLoading) return <LoadingSpinner />;

  if ((existingAttempt?.submitted_at && !result) || result) {
    const shown = result || existingAttempt;
    return (
      <div className="ft-assessment-result" role="status" dir="rtl">
        <h3>{t('studentTraining.assessment.success')}</h3>
        <p>
          {t('studentTraining.assessment.score')}: {shown.score}%
        </p>
        <p>{shown.attempt_status_label || t('studentTraining.assessment.statusGraded')}</p>
        {shown.has_pending_manual ? (
          <p className="ft-qb-hint">{t('studentTraining.assessment.pendingManual')}</p>
        ) : null}
        {shown.level ? <p>{t(`knowledgeLevel.${shown.level}`)}</p> : null}
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
      dir="rtl"
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
        submitMut.mutate(answers);
      }}
    >
      <h3>{assessment.title}</h3>
      {assessment.description ? <p>{assessment.description}</p> : null}
      {assessment.student_instructions ? (
        <p className="ft-qb-hint">
          <strong>{t('studentTraining.assessment.instructions')}: </strong>
          {assessment.student_instructions}
        </p>
      ) : null}
      {remaining != null ? (
        <p className="ft-qb-hint" role="timer">
          {t('studentTraining.assessment.timeRemaining')}: {formatRemaining(remaining)}
        </p>
      ) : null}
      {savedHint ? <p className="ft-qb-hint">{t('studentTraining.assessment.autoSaved')}</p> : null}
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
          <StatusBadge variant={attemptStatusVariant(item.attempt_status)}>
            {attemptStatusLabel(t, item)}
          </StatusBadge>
        </header>
        <p>{t(descKey)}</p>
        {item.attempt?.submitted_at ? (
          <p>
            {t('studentTraining.assessment.score')}: {item.attempt.score}%
            {item.attempt.level ? ` · ${t(`knowledgeLevel.${item.attempt.level}`)}` : ''}
          </p>
        ) : null}
        {item.can_take && item.attempt_status === 'in_progress' ? (
          <Button type="button" variant="primary" onClick={() => setActiveType(type)}>
            {t('studentTraining.assessment.continue')}
          </Button>
        ) : null}
        {item.can_take && item.attempt_status !== 'in_progress' && !item.attempt?.submitted_at ? (
          <Button type="button" variant="primary" onClick={() => setActiveType(type)}>
            {t(`studentTraining.assessment.start${type === 'pre' ? 'Pre' : 'Post'}`)}
          </Button>
        ) : null}
        {!item.can_take && !item.attempt?.submitted_at ? (
          <p className="ft-assessment-card__locked">
            {type === 'post'
              ? t('studentTraining.assessment.postLockedUntilReady')
              : t('studentTraining.assessment.preLocked')}
          </p>
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

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList, Eye, FileText, Loader2, Plus, Save, Send } from 'lucide-react';
import { Button } from '../../../../../components/common/Button.jsx';
import { EmptyState } from '../../../../../components/common/EmptyState.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  createOpportunityAssessment,
  gradeAssessmentAttempt,
  publishAssessmentById,
  updateAssessment,
  useOpportunityAssessments,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { AssessmentQuestionCard } from './AssessmentQuestionCard.jsx';
import {
  computeTotals,
  countIncompleteQuestions,
  createClientKey,
  createEmptyQuestion,
  hydrateQuestionFromApi,
  serializeQuestionForApi,
  validateBuilderForPublish,
} from './assessmentQuestionBuilder.utils.js';

function statusBadgeVariant(status) {
  if (status === 'published') return 'success';
  if (status === 'closed') return 'muted';
  return 'warning';
}

function AssessmentBuilderSkeleton() {
  return (
    <div className="ft-qb" aria-busy="true" aria-label="loading">
      <div className="ft-qb-skeleton ft-qb-skeleton--header" />
      <div className="ft-qb-layout">
        <div className="ft-qb-main">
          <div className="ft-qb-skeleton ft-qb-skeleton--card" />
          <div className="ft-qb-skeleton ft-qb-skeleton--card" />
        </div>
        <div className="ft-qb-skeleton ft-qb-skeleton--side" />
      </div>
    </div>
  );
}

export function ManageAssessmentsTab({ opportunityId, type, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { id: routeId } = useParams();
  const oppId = opportunityId || routeId;
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const overviewHref = `${listBase}/${oppId}/manage?tab=overview`;

  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const { data, isLoading } = useOpportunityAssessments(oppId, { scope: apiScope });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState('60');
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [passingTouched, setPassingTouched] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [gradeModal, setGradeModal] = useState(null);
  const [gradeDraft, setGradeDraft] = useState({});
  const [gradeError, setGradeError] = useState('');

  const assessment = useMemo(
    () => (data?.assessments ?? []).find((a) => a.type === type) ?? null,
    [data, type]
  );

  useEffect(() => {
    if (!assessment) {
      setTitle('');
      setDescription('');
      setPassingScore('60');
      const first = createEmptyQuestion();
      setQuestions([first]);
      setActiveKey(first.clientKey);
      setPassingTouched(false);
      return;
    }
    setTitle(assessment.title ?? '');
    setDescription(assessment.description ?? '');
    setPassingScore(assessment.passing_score != null ? String(assessment.passing_score) : '60');
    setPassingTouched(true);
    if (assessment.questions?.length) {
      const hydrated = assessment.questions.map(hydrateQuestionFromApi);
      setQuestions(hydrated);
      setActiveKey(hydrated[0]?.clientKey ?? null);
    } else {
      const first = createEmptyQuestion();
      setQuestions([first]);
      setActiveKey(first.clientKey);
    }
  }, [assessment?.id, assessment?.updated_at]);

  const totals = useMemo(() => computeTotals(questions), [questions]);
  const incompleteCount = useMemo(() => countIncompleteQuestions(questions), [questions]);

  useEffect(() => {
    if (!passingTouched && totals.questionCount > 0) {
      setPassingScore(String(totals.suggestedPassingPercent));
    }
  }, [totals.suggestedPassingPercent, totals.questionCount, passingTouched]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.assessments(oppId, apiScope) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminDetail(oppId) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.instructorDetail(oppId) });
    qc.invalidateQueries({ queryKey: [...fieldTrainingKeys.all, 'student', 'progress'] });
    qc.invalidateQueries({ queryKey: [...fieldTrainingKeys.all, 'student', 'assessments'] });
  };

  function buildBody(status) {
    return {
      title: title.trim(),
      description: description.trim() || null,
      passing_score: passingScore === '' ? null : Number(passingScore),
      status,
      questions: questions.map((q, i) => serializeQuestionForApi(q, i)),
    };
  }

  const saveMut = useMutation({
    mutationFn: async (status) => {
      const body = buildBody(status);
      if (assessment?.id) {
        return updateAssessment(assessment.id, body, { asInstructor: isInstructor });
      }
      return createOpportunityAssessment(oppId, { ...body, type }, { asInstructor: isInstructor });
    },
    onSuccess: () => {
      setError('');
      setFieldErrors({});
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const validationError = validateBuilderForPublish({
        title,
        questions,
        passingScore,
      });
      if (validationError) {
        const err = new Error(validationError);
        err.isValidation = true;
        throw err;
      }
      const body = buildBody('draft');
      let id = assessment?.id;
      if (id) {
        await updateAssessment(id, body, { asInstructor: isInstructor });
      } else {
        const created = await createOpportunityAssessment(
          oppId,
          { ...body, type },
          { asInstructor: isInstructor }
        );
        id = created?.assessment?.id;
      }
      if (!id) throw new Error(t('manageHub.assessment.publishFailed'));
      return publishAssessmentById(id, { asInstructor: isInstructor });
    },
    onSuccess: () => {
      setError('');
      setFieldErrors({});
      invalidate();
    },
    onError: (err) => setError(err.isValidation ? err.message : getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  const gradeMut = useMutation({
    mutationFn: ({ attemptId, grades }) =>
      gradeAssessmentAttempt(attemptId, { grades }, { asInstructor: isInstructor }),
    onSuccess: () => {
      setGradeModal(null);
      setGradeDraft({});
      setGradeError('');
      invalidate();
    },
    onError: (err) => setGradeError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  function openGradeModal(attempt) {
    const pending = (attempt.grading_details || []).filter((row) => row.gradingStatus === 'pending_manual');
    const draft = {};
    pending.forEach((row) => {
      draft[row.questionId] = row.awardedPoints != null ? String(row.awardedPoints) : '';
    });
    setGradeDraft(draft);
    setGradeError('');
    setGradeModal(attempt);
  }

  function updateQuestion(index, next) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? next : q)));
  }

  function moveQuestion(index, dir) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function duplicateQuestion(index) {
    setQuestions((prev) => {
      const copy = {
        ...prev[index],
        clientKey: createClientKey(),
        id: undefined,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      setActiveKey(copy.clientKey);
      return next;
    });
  }

  function addQuestion() {
    const q = createEmptyQuestion();
    setQuestions((prev) => [...prev, q]);
    setActiveKey(q.clientKey);
  }

  function openPreview() {
    setPreviewIndex(0);
    setPreviewOpen(true);
  }

  if (isLoading) return <AssessmentBuilderSkeleton />;

  const busy = saveMut.isPending || publishMut.isPending;
  const status = assessment?.status || 'draft';
  const isPublished = status === 'published';
  const completeCount = Math.max(0, totals.questionCount - incompleteCount);
  const passingDisplay =
    passingScore !== '' && passingScore != null && Number.isFinite(Number(passingScore))
      ? `${Number(passingScore)}%`
      : t('manageHub.assessment.notSet');
  const previewQuestion = questions[previewIndex] || null;
  const previewProgress =
    questions.length > 0 ? Math.round(((previewIndex + 1) / questions.length) * 100) : 0;

  const summaryCard = (
    <aside className="ft-qb-summary" aria-label={t('manageHub.assessment.summaryTitle')}>
      <div className="ft-qb-summary__accent" aria-hidden />
      <h3 className="ft-qb-summary__title">{t('manageHub.assessment.summaryTitle')}</h3>
      <ul className="ft-qb-summary__list">
        <li>
          <span>{t('manageHub.assessment.questionCount')}</span>
          <strong>{totals.questionCount}</strong>
        </li>
        <li>
          <span>{t('manageHub.assessment.totalPoints')}</span>
          <strong>{totals.totalPoints}</strong>
        </li>
        <li>
          <span>{t('manageHub.assessment.passingScore')}</span>
          <strong>{passingDisplay}</strong>
        </li>
        <li>
          <span>{t('manageHub.assessment.completeCount')}</span>
          <strong className="ft-qb-summary__ok">{completeCount}</strong>
        </li>
        <li>
          <span>{t('manageHub.assessment.incompleteCount')}</span>
          <strong className={incompleteCount > 0 ? 'ft-qb-summary__warn' : undefined}>
            {incompleteCount}
          </strong>
        </li>
        <li>
          <span>{t('manageHub.assessment.statusLabel')}</span>
          <StatusBadge variant={statusBadgeVariant(status)}>
            {t(`assessmentStatus.${status}`)}
          </StatusBadge>
        </li>
      </ul>
      {incompleteCount > 0 ? (
        <p className="ft-qb-summary__note">{t('manageHub.assessment.incompleteNote')}</p>
      ) : (
        <p className="ft-qb-summary__ready">{t('manageHub.assessment.readyNote')}</p>
      )}
    </aside>
  );

  return (
    <div className="ft-qb">
      <div className="ft-qb-shell">
      <header className="ft-qb-hero">
        <div className="ft-qb-hero__top">
          <Link to={overviewHref} className="ft-qb-back">
            <ArrowRight size={16} aria-hidden />
            {t('manageHub.assessment.back')}
          </Link>
          <StatusBadge variant={statusBadgeVariant(status)}>
            {t(`assessmentStatus.${status}`)}
          </StatusBadge>
        </div>
        <div className="ft-qb-hero__body">
          <div>
            <h2 className="ft-qb-hero__title">{t(`manageHub.assessment.${type}.createTitle`)}</h2>
            <p className="ft-qb-hero__desc">{t('manageHub.assessment.builderHelp')}</p>
          </div>
          <div className="ft-qb-hero__stats" aria-live="polite">
            <div className="ft-qb-hero__stat">
              <span>{t('manageHub.assessment.questionCount')}</span>
              <strong>{totals.questionCount}</strong>
            </div>
            <div className="ft-qb-hero__stat">
              <span>{t('manageHub.assessment.totalPoints')}</span>
              <strong>{totals.totalPoints}</strong>
            </div>
            <div className="ft-qb-hero__stat">
              <span>{t('manageHub.assessment.passingScore')}</span>
              <strong>{passingDisplay}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="ft-qb-mobile-summary">{summaryCard}</div>

      <div className="ft-qb-layout">
        <div className="ft-qb-main">
          <form
            className="ft-qb-form"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setFieldErrors({});
              if (!title.trim()) {
                setFieldErrors({ title: t('manageHub.assessment.titleRequired') });
                setError(t('manageHub.assessment.titleRequired'));
                return;
              }
              saveMut.mutate('draft');
            }}
          >
            <section className="ft-qb-info-card">
              <div className="ft-qb-info-card__accent" aria-hidden />
              <header className="ft-qb-section-head">
                <span className="ft-qb-section-icon" aria-hidden>
                  <FileText size={18} />
                </span>
                <h3 className="ft-qb-section-title">{t('manageHub.assessment.infoTitle')}</h3>
              </header>
              <div className="ft-qb-info-grid">
                <FormInput
                  label={t('manageHub.assessment.title')}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) setFieldErrors((fe) => ({ ...fe, title: undefined }));
                  }}
                  required
                  disabled={busy}
                  error={fieldErrors.title}
                  className="ft-qb-form-control"
                />
                <div className="ft-qb-field">
                  <span className="ft-qb-field__label">{t('manageHub.assessment.typeLabel')}</span>
                  <div className="ft-qb-type-pill">
                    {t(`manageHub.assessment.${type}.title`)}
                  </div>
                </div>
                <FormInput
                  label={t('manageHub.assessment.passingScore')}
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) => {
                    setPassingTouched(true);
                    setPassingScore(e.target.value);
                  }}
                  disabled={busy}
                  className="ft-qb-form-control"
                />
                <p className="ft-qb-hint ft-qb-info-grid__full">{t('manageHub.assessment.passingScoreHelp')}</p>
                <div className="ft-qb-info-grid__full">
                  <FormTextarea
                    label={t('manageHub.assessment.description')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={busy}
                    className="ft-qb-form-control"
                  />
                </div>
              </div>
            </section>

            <section className="ft-qb-questions-section">
              <div className="ft-qb-questions-head">
                <div>
                  <h3 className="ft-qb-section-title">{t('manageHub.assessment.questions')}</h3>
                  <p className="ft-qb-hint">{t('manageHub.assessment.questionsHelp')}</p>
                </div>
                <Button type="button" variant="accent" disabled={busy} onClick={addQuestion}>
                  <Plus size={16} /> {t('manageHub.assessment.addQuestion')}
                </Button>
              </div>

              {questions.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t('manageHub.assessment.emptyTitle')}
                  description={t('manageHub.assessment.emptyDesc')}
                  action={
                    <Button type="button" variant="primary" onClick={addQuestion}>
                      <Plus size={16} /> {t('manageHub.assessment.addFirstQuestion')}
                    </Button>
                  }
                />
              ) : (
                <div className="ft-qb-list">
                  {questions.map((q, idx) => (
                    <AssessmentQuestionCard
                      key={q.clientKey}
                      question={q}
                      index={idx}
                      total={questions.length}
                      active={activeKey === q.clientKey}
                      disabled={busy}
                      onActivate={() => setActiveKey(q.clientKey)}
                      onChange={(next) => updateQuestion(idx, next)}
                      onRemove={() => {
                        setQuestions((prev) => {
                          const next = prev.filter((_, i) => i !== idx);
                          if (activeKey === q.clientKey) {
                            setActiveKey(next[Math.max(0, idx - 1)]?.clientKey ?? null);
                          }
                          return next;
                        });
                      }}
                      onDuplicate={() => duplicateQuestion(idx)}
                      onMove={(dir) => moveQuestion(idx, dir)}
                    />
                  ))}
                </div>
              )}
            </section>

            {error ? (
              <p className="ft-qb-alert" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ft-qb-actions" aria-label={t('manageHub.assessment.actions')}>
              <Button type="button" variant="outline" className="ft-qb-btn" disabled={busy} onClick={addQuestion}>
                <Plus size={16} /> {t('manageHub.assessment.addQuestion')}
              </Button>
              <Button type="button" variant="secondary" className="ft-qb-btn" disabled={busy} onClick={openPreview}>
                <Eye size={16} /> {t('manageHub.assessment.preview')}
              </Button>
              <Button type="submit" variant="accent" className="ft-qb-btn" disabled={busy || !title.trim()}>
                {saveMut.isPending ? <Loader2 size={16} className="ft-qb-spin" /> : <Save size={16} />}
                {saveMut.isPending ? t('saving') : t('manageHub.assessment.saveDraft')}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="ft-qb-btn"
                disabled={busy}
                onClick={() => {
                  setError('');
                  setFieldErrors({});
                  publishMut.mutate();
                }}
              >
                {publishMut.isPending ? <Loader2 size={16} className="ft-qb-spin" /> : <Send size={16} />}
                {publishMut.isPending
                  ? t('manageHub.assessment.publishing')
                  : isPublished
                    ? t('manageHub.assessment.republish')
                    : t('manageHub.assessment.publish')}
              </Button>
            </div>
          </form>

          {assessment?.attempts?.length ? (
            <section className="ft-assessment-results ft-qb-results">
              <h3 className="ft-qb-section-title">{t('manageHub.assessment.results')}</h3>
              <ul className="ft-assessment-results__list">
                {assessment.attempts.map((a) => (
                  <li key={a.id} className="ft-assessment-results__item">
                    <div>
                      <strong>{a.student_name || t('notAvailable')}</strong>
                      <p>
                        {[a.student_university, a.student_university_specialty_label]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {a.has_pending_manual ? (
                        <StatusBadge variant="warning">
                          {t('manageHub.assessment.pendingManualBadge')}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <div className="ft-manage-inline-actions">
                      <span>
                        {a.score != null ? `${a.score}%` : t('notAvailable')}
                        {a.level ? ` (${t(`knowledgeLevel.${a.level}`)})` : ''}
                      </span>
                      {a.submitted_at ? <small>{String(a.submitted_at).slice(0, 10)}</small> : null}
                      {a.has_pending_manual ? (
                        <Button
                          type="button"
                          variant="primary"
                          className="btn--sm"
                          onClick={() => openGradeModal(a)}
                        >
                          {t('manageHub.assessment.gradeManual')}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="ft-qb-side">{summaryCard}</div>
      </div>

      {previewOpen ? (
        <div
          className="ft-qb-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ft-qb-preview-title"
        >
          <div className="ft-qb-preview__panel">
            <header className="ft-qb-preview__head">
              <div>
                <p className="ft-qb-preview__eyebrow">{t('manageHub.assessment.preview')}</p>
                <h3 id="ft-qb-preview-title">{title || t(`manageHub.assessment.${type}.title`)}</h3>
              </div>
              <Button type="button" variant="outline" className="btn--sm" onClick={() => setPreviewOpen(false)}>
                {t('manageHub.assessment.endPreview')}
              </Button>
            </header>
            {description ? <p className="ft-qb-preview__desc">{description}</p> : null}
            <div className="ft-qb-preview__progress" aria-hidden>
              <div className="ft-qb-preview__progress-bar" style={{ width: `${previewProgress}%` }} />
            </div>
            <p className="ft-qb-hint">
              {t('manageHub.assessment.previewProgress', {
                current: questions.length ? previewIndex + 1 : 0,
                total: questions.length,
              })}
            </p>

            {previewQuestion ? (
              <div className="ft-qb-preview__q">
                <div className="ft-qb-preview__q-head">
                  <strong>
                    {previewIndex + 1}.{' '}
                    {previewQuestion.question_text || t('manageHub.assessment.untitledQuestion')}
                  </strong>
                  <span className="ft-qb-chip ft-qb-chip--points">
                    {t('manageHub.assessment.pointsValue', { points: previewQuestion.points || 0 })}
                  </span>
                </div>
                {previewQuestion.question_type === 'short_text' ? (
                  <input
                    className="ft-qb-input"
                    disabled
                    placeholder={t('manageHub.assessment.types.short_text')}
                  />
                ) : null}
                {previewQuestion.question_type === 'long_text' ? (
                  <textarea className="ft-qb-input ft-qb-input--tall" disabled rows={5} />
                ) : null}
                {(previewQuestion.question_type === 'multiple_choice' ||
                  previewQuestion.question_type === 'true_false') &&
                  (previewQuestion.question_type === 'true_false'
                    ? ['true', 'false']
                    : previewQuestion.options || []
                  ).map((opt, oi) => {
                    const label =
                      previewQuestion.question_type === 'true_false'
                        ? opt === 'true'
                          ? t('manageHub.assessment.trueLabel')
                          : t('manageHub.assessment.falseLabel')
                        : String(opt || '').trim() || t('manageHub.assessment.optionPh', { n: oi + 1 });
                    return (
                      <label key={`${previewQuestion.clientKey}-${oi}`} className="ft-qb-preview__choice">
                        <input type="radio" disabled name={`preview-${previewQuestion.clientKey}`} />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                {previewQuestion.question_type === 'multi_select'
                  ? (previewQuestion.options || []).map((opt, oi) => (
                      <label key={`${previewQuestion.clientKey}-ms-${oi}`} className="ft-qb-preview__choice">
                        <input type="checkbox" disabled />
                        <span>
                          {String(opt || '').trim() || t('manageHub.assessment.optionPh', { n: oi + 1 })}
                        </span>
                      </label>
                    ))
                  : null}
              </div>
            ) : (
              <p className="ft-qb-hint">{t('manageHub.assessment.emptyDesc')}</p>
            )}

            <footer className="ft-qb-preview__footer">
              <Button
                type="button"
                variant="outline"
                disabled={previewIndex <= 0}
                onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronRight size={16} /> {t('manageHub.assessment.prevQuestion')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={previewIndex >= questions.length - 1}
                onClick={() => setPreviewIndex((i) => Math.min(questions.length - 1, i + 1))}
              >
                {t('manageHub.assessment.nextQuestion')} <ChevronLeft size={16} />
              </Button>
              <Button type="button" variant="primary" onClick={() => setPreviewOpen(false)}>
                {t('manageHub.assessment.endPreview')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {gradeModal ? (
        <div className="ft-modal-backdrop" onClick={() => setGradeModal(null)} role="presentation">
          <div
            className="ft-modal ft-modal--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">{t('manageHub.assessment.gradeManualTitle')}</h2>
              <p className="ft-modal__subtitle">{gradeModal.student_name}</p>
            </header>
            <div className="ft-modal__body">
              {(gradeModal.grading_details || [])
                .filter((row) => row.gradingStatus === 'pending_manual')
                .map((row) => {
                  const question = (assessment?.questions || []).find((q) => q.id === row.questionId);
                  const answer = gradeModal.answers?.[row.questionId];
                  return (
                    <div key={row.questionId} className="ft-manage-review-block">
                      <h3>{question?.question_text || row.questionId}</h3>
                      <p>
                        {t('manageHub.assessment.studentAnswer')}:{' '}
                        {answer != null && answer !== '' ? String(answer) : t('notAvailable')}
                      </p>
                      <FormInput
                        type="number"
                        min={0}
                        max={row.maxPoints}
                        label={`${t('manageHub.assessment.awardedPoints')} (0–${row.maxPoints})`}
                        value={gradeDraft[row.questionId] ?? ''}
                        onChange={(e) =>
                          setGradeDraft((prev) => ({ ...prev, [row.questionId]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              {gradeError ? <p className="form-field__error">{gradeError}</p> : null}
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setGradeModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={gradeMut.isPending}
                onClick={() => {
                  const pending = (gradeModal.grading_details || []).filter(
                    (row) => row.gradingStatus === 'pending_manual'
                  );
                  const grades = pending.map((row) => ({
                    question_id: row.questionId,
                    awarded_points: Number(gradeDraft[row.questionId] ?? 0),
                  }));
                  gradeMut.mutate({ attemptId: gradeModal.id, grades });
                }}
              >
                {gradeMut.isPending ? t('saving') : t('manageHub.assessment.saveGrades')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

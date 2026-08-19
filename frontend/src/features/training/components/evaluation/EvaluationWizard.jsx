import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { ConfirmationModal } from '../../../../components/designSystem/ConfirmationModal.jsx';
import { getEnrollmentEvaluation, saveEvaluationDraft, submitEvaluation } from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { EvaluationProgress } from './EvaluationProgress.jsx';
import { EvaluationSuccessState } from './EvaluationSuccessState.jsx';
import { RatingScaleQuestion } from './RatingScaleQuestion.jsx';
import { NpsQuestion } from './NpsQuestion.jsx';
import { OpenTextQuestion } from './OpenTextQuestion.jsx';

const AUTOSAVE_DELAY_MS = 800;
const EDITABLE_STATUSES = new Set(['AVAILABLE', 'IN_PROGRESS', 'REOPENED']);

function isAnswerMissing(question, value) {
  if (!question.isRequired) return false;
  if (question.questionType === 'OPEN_TEXT') {
    return !String(value ?? '').trim();
  }
  return value == null || value === '';
}

function renderQuestionField(question, value, onChange, error, disabled) {
  if (question.questionType === 'NPS') {
    return <NpsQuestion question={question} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }
  if (question.questionType === 'OPEN_TEXT') {
    return <OpenTextQuestion question={question} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }
  return <RatingScaleQuestion question={question} value={value} onChange={onChange} error={error} disabled={disabled} />;
}

/**
 * Self-contained multi-step final-evaluation wizard for one trainee enrollment.
 * Fetches/starts the evaluation, autosaves drafts, validates required answers
 * per section, and submits with a confirmation step.
 *
 * @param {{ enrollmentId: string, onSubmitted?: (result: object) => void }} props
 */
export function EvaluationWizard({ enrollmentId, onSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gateMessage, setGateMessage] = useState('');
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const debounceRef = useRef(null);
  const responseIdRef = useRef(null);

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    setGateMessage('');
    try {
      const res = await getEnrollmentEvaluation(enrollmentId);
      setData(res);
      setAnswers(res.response?.answers && typeof res.response.answers === 'object' ? res.response.answers : {});
      responseIdRef.current = res.response?.id || null;
      setSubmitted(res.status === 'SUBMITTED' || res.status === 'CLOSED');
      setStepIndex(0);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'FINAL_EVALUATION_LOCKED' || code === 'FINAL_EVALUATION_NOT_AVAILABLE') {
        setGateMessage(getApiErrorMessage(err, 'التقييم النهائي غير متاح حاليًا.'));
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل التقييم النهائي.'));
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const sections = useMemo(() => data?.template?.sections || [], [data]);
  const isEditable = data ? EDITABLE_STATUSES.has(data.status) : false;

  const scheduleSave = useCallback((nextAnswers) => {
    if (!responseIdRef.current || !isEditable) return;
    clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await saveEvaluationDraft(responseIdRef.current, nextAnswers);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable]);

  function updateAnswer(questionId, value) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      scheduleSave(next);
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function validateSection(section) {
    const errors = {};
    for (const q of section.questions || []) {
      if (isAnswerMissing(q, answers[q.id])) {
        errors[q.id] = 'هذا السؤال مطلوب.';
      }
    }
    return errors;
  }

  function validateAll() {
    const errors = {};
    for (const section of sections) {
      Object.assign(errors, validateSection(section));
    }
    return errors;
  }

  function goNext() {
    const section = sections[stepIndex];
    if (section) {
      const errors = validateSection(section);
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        return;
      }
    }
    setFieldErrors({});
    setStepIndex((i) => Math.min(i + 1, Math.max(sections.length - 1, 0)));
  }

  function goPrev() {
    setFieldErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    const errors = validateAll();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstBadSection = sections.findIndex((s) => (s.questions || []).some((q) => errors[q.id]));
      if (firstBadSection >= 0) setStepIndex(firstBadSection);
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitEvaluation(responseIdRef.current, answers);
      setSubmitted(true);
      setConfirmOpen(false);
      onSubmitted?.(result);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'تعذر إرسال التقييم النهائي.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="eval-wizard" dir="rtl">
        <LoadingSpinner label="جاري تحميل التقييم النهائي" />
      </div>
    );
  }

  if (gateMessage) {
    return (
      <div className="eval-wizard" dir="rtl">
        <EmptyState title="التقييم النهائي غير متاح بعد" description={gateMessage || 'يصبح التقييم النهائي متاحًا بعد استكمال الاختبار البعدي.'} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="eval-wizard" dir="rtl">
        <p className="form-field__error" role="alert">
          {error || 'تعذر تحميل التقييم النهائي.'}
        </p>
        <Button type="button" variant="outline" onClick={load}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="eval-wizard" dir="rtl">
        <EvaluationSuccessState
          title="تم استلام تقييمك بنجاح"
          description={
            data.status === 'CLOSED'
              ? 'تم إغلاق التقييم النهائي.'
              : 'شكرًا لمساهمتك في تطوير جودة البرامج التدريبية. سيتم الآن تحديث حالة استكمال التدريب.'
          }
        />
      </div>
    );
  }

  const isLastSection = sections.length > 0 && stepIndex === sections.length - 1;
  const currentSection = sections[stepIndex] || null;
  const stepLabels = sections.map((s) => s.title);

  return (
    <div className="eval-wizard" dir="rtl">
      {data.reopenReason ? (
        <p className="eval-wizard__reopen-note" role="status">
          تمت إعادة فتح هذا التقييم للتعديل — السبب: {data.reopenReason}
        </p>
      ) : null}

      <EvaluationProgress steps={stepLabels} currentIndex={stepIndex} />

      <div className="eval-wizard__save-status" role="status" aria-live="polite">
        {saveState === 'saving' ? 'جاري الحفظ...' : null}
        {saveState === 'saved' ? 'تم حفظ المسودة' : null}
        {saveState === 'error' ? 'تعذر حفظ آخر تعديل. حاول مرة أخرى.' : null}
      </div>

      <div className="eval-wizard__body">
        {currentSection ? (
          <section className="eval-wizard__section">
            <h3 className="eval-wizard__section-title">{currentSection.title}</h3>
            {currentSection.description ? (
              <p className="eval-wizard__section-desc">{currentSection.description}</p>
            ) : null}
            <div className="eval-wizard__questions">
              {(currentSection.questions || []).map((q) =>
                <div key={q.id}>{renderQuestionField(q, answers[q.id], (v) => updateAnswer(q.id, v), fieldErrors[q.id], submitting)}</div>
              )}
            </div>
            {submitError ? (
              <p className="form-field__error" role="alert">
                {submitError}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="eval-wizard__nav">
        <Button type="button" variant="outline" disabled={stepIndex === 0 || submitting} onClick={goPrev}>
          السابق
        </Button>
        {isLastSection ? (
          <Button
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => {
              const errors = validateSection(currentSection || { questions: [] });
              if (Object.keys(errors).length) {
                setFieldErrors(errors);
                return;
              }
              setConfirmOpen(true);
            }}
          >
            إرسال التقييم النهائي
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={goNext}>
            التالي
          </Button>
        )}
      </div>

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        title="تأكيد إرسال التقييم"
        description="بعد إرسال التقييم سيتم اعتماد إجاباتك ولن تتمكن من تعديلها إلا إذا أعاد مسؤول مخول فتح التقييم. هل تريد المتابعة؟"
        confirmLabel="إرسال التقييم"
        cancelLabel="العودة للمراجعة"
        confirmVariant="primary"
        busy={submitting}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/common/Button.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import {
  getTraineeAssessmentStatus,
  saveAssessmentAttemptAnswers,
  startAssessmentAttempt,
  submitAssessmentAttemptById,
} from '../training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  TraineeAssessmentDetailsCard,
  TraineeAssessmentDetailsSkeleton,
} from '../assessmentPresentation/index.js';
import { PostTestSuccessGate } from './evaluation/PostTestSuccessGate.jsx';

function QuestionField({ question, value, onChange, disabled }) {
  const type = question.question_type === 'short_answer' ? 'short_text' : question.question_type;
  const options = question.options || question.options_json || [];

  if (type === 'long_text') {
    return (
      <textarea
        className="ft-qb-input"
        rows={4}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
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
            />
            <span>{opt === 'true' ? 'صح' : 'خطأ'}</span>
          </label>
        ))}
      </div>
    );
  }
  if (type === 'multi_select' && Array.isArray(options)) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="ft-question-card__options">
        {options.map((opt) => (
          <label key={String(opt)} className="ft-attendance-chip">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected.filter((v) => v !== opt), opt]
                    : selected.filter((v) => v !== opt)
                )
              }
            />
            <span>{String(opt)}</span>
          </label>
        ))}
      </div>
    );
  }
  if ((type === 'multiple_choice' || type === 'single_choice') && Array.isArray(options)) {
    return (
      <div className="ft-question-card__options">
        {options.map((opt) => (
          <label key={String(opt)} className="ft-attendance-chip">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === opt}
              disabled={disabled}
              onChange={() => onChange(opt)}
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

function AttemptForm({ assessmentPayload, attempt, onDone, evaluationLinkTo }) {
  const questions = assessmentPayload?.questions || [];
  const [answers, setAnswers] = useState(() => attempt?.answers || {});
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [remainingSec, setRemainingSec] = useState(null);

  useEffect(() => {
    if (!assessmentPayload?.durationMinutes || !attempt?.startedAt) {
      setRemainingSec(null);
      return undefined;
    }
    const deadline =
      new Date(attempt.startedAt).getTime() + Number(assessmentPayload.durationMinutes) * 60000;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) setError('انتهت مدة المحاولة.');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [assessmentPayload?.durationMinutes, attempt?.startedAt]);

  async function saveDraft() {
    setBusy(true);
    setError('');
    try {
      await saveAssessmentAttemptAnswers(attempt.id, answers);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ الإجابات.'));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await submitAssessmentAttemptById(attempt.id, answers);
      setResult(res);
      onDone?.(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تسليم الاختبار.'));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const isPostTest = assessmentPayload?.kind === 'POST_TEST' || assessmentPayload?.type === 'post';
    const showEvaluationGate =
      isPostTest && (result.pendingManual || result.nextAction === 'FINAL_EVALUATION' || result.finalEvaluationAvailable);

    if (showEvaluationGate) {
      return (
        <div className="ta-assessment-card" dir="rtl">
          <PostTestSuccessGate result={result} evaluationLinkTo={evaluationLinkTo} onContinue={() => onDone?.(result)} />
        </div>
      );
    }

    return (
      <div className="ta-assessment-card" dir="rtl">
        <StatusBadge variant={result.passed ? 'success' : 'warning'}>
          {result.pendingManual
            ? 'بانتظار مراجعة المدرب'
            : result.showResults === false
              ? 'تم التسليم'
              : result.passed
                ? 'ناجح'
                : 'غير ناجح'}
        </StatusBadge>
        {result.showResults !== false && result.scorePercent != null ? (
          <p>الدرجة: {result.scorePercent}%</p>
        ) : null}
        {result.pendingManual ? (
          <p className="auth-register__helper">نتيجتك بانتظار مراجعة المدرب.</p>
        ) : null}
        {/* Correct answers are never shown here — Backend omits them for learners. */}
        <Button type="button" variant="outline" onClick={() => onDone?.(result)}>
          العودة
        </Button>
      </div>
    );
  }

  return (
    <div className="ft-qb" dir="rtl">
      {remainingSec != null ? (
        <p className="auth-register__helper">
          الوقت المتبقي:{' '}
          <strong>
            {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
          </strong>
        </p>
      ) : null}
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {questions.map((q, i) => (
        <div key={q.id} className="ft-question-card" style={{ marginBottom: '1rem' }}>
          <h4>
            {i + 1}. {q.question_text || q.prompt}
          </h4>
          <QuestionField
            question={q}
            value={answers[q.id]}
            disabled={busy || remainingSec === 0}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>
          حفظ الإجابات
        </Button>
        <Button type="button" variant="primary" disabled={busy || remainingSec === 0} onClick={submit}>
          تسليم الاختبار
        </Button>
      </div>
    </div>
  );
}

/**
 * Trainee assessments panel — status from Backend, attempt lifecycle via training APIs.
 * Presentation-only redesign; grading/attempts/permissions unchanged.
 */
export function TrainingAssessmentAttemptPanel({
  programId,
  courseTitle,
  programType = 'TRAINING_COURSE',
  onChanged,
  evaluationLinkTo,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [active, setActive] = useState(null);
  const [startingId, setStartingId] = useState(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await getTraineeAssessmentStatus(programId);
      setStatus(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل بيانات الاختبار حاليًا. يرجى المحاولة مرة أخرى.'));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [programId]);

  const items = useMemo(() => status?.assessments || [], [status]);

  async function start(item) {
    setError('');
    setStartingId(item.id);
    try {
      const payload = await startAssessmentAttempt(item.id);
      setActive(payload);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر بدء الاختبار.'));
    } finally {
      setStartingId(null);
    }
  }

  if (loading) {
    return (
      <div className="ta-assessment-panel" dir="rtl">
        <TraineeAssessmentDetailsSkeleton />
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className="ta-assessment-panel" dir="rtl">
        <div className="ta-assessment-panel__error" role="alert">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={refresh}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (active?.attempt) {
    return (
      <div className="ta-assessment-panel" dir="rtl">
        <AttemptForm
          assessmentPayload={active.assessment}
          attempt={active.attempt}
          evaluationLinkTo={evaluationLinkTo}
          onDone={async () => {
            setActive(null);
            await refresh();
            onChanged?.();
          }}
        />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="ta-assessment-panel" dir="rtl">
        <EmptyState title="لا توجد اختبارات" description="لم يُنشر اختبار قبلي أو بعدي بعد." />
      </div>
    );
  }

  return (
    <div className="ta-assessment-panel" dir="rtl">
      <header className="ta-assessment-panel__page-header">
        <nav className="ta-assessment-panel__breadcrumb" aria-label="مسار التنقل">
          <Link to="/trainee/courses">دوراتي التدريبية</Link>
          <span className="ta-assessment-panel__crumb-sep" aria-hidden>
            /
          </span>
          <span>{courseTitle || 'الدورة'}</span>
          <span className="ta-assessment-panel__crumb-sep" aria-hidden>
            /
          </span>
          <span>الاختبارات</span>
        </nav>
        <h2 className="ta-assessment-panel__heading">الاختبارات</h2>
      </header>

      {error ? (
        <div className="ta-assessment-panel__error" role="alert" style={{ marginBottom: '1rem' }}>
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={refresh}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      <div className="ta-assessment-panel__list">
        {items.map((item) => (
          <TraineeAssessmentDetailsCard
            key={item.id}
            item={item}
            courseTitle={courseTitle}
            programType={programType}
            busy={startingId === item.id}
            onStart={start}
          />
        ))}
      </div>
    </div>
  );
}

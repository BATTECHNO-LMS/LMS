import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Send, Eye } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { AssessmentQuestionCard } from '../../../pages/admin/fieldTraining/components/manage/AssessmentQuestionCard.jsx';
import {
  computeTotals,
  countIncompleteQuestions,
  createClientKey,
  createEmptyQuestion,
  hydrateQuestionFromApi,
  serializeQuestionForApi,
  validateBuilderForPublish,
} from '../../../pages/admin/fieldTraining/components/manage/assessmentQuestionBuilder.utils.js';
import {
  getAssessment,
  gradeAssessmentAttempt,
  listAssessmentResults,
  publishAssessment,
  upsertAssessment,
} from '../training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { toDatetimeLocalValue } from '../assessmentPresentation/assessmentDate.js';

/**
 * Shared institutional assessment editor (TRAINING_COURSE).
 * Reuses field-training question builder components against /training APIs.
 */
export function TrainingAssessmentEditor({
  programId,
  kind, // 'pre' | 'post'
  assessment = null,
  readOnly = false,
  onSaved,
  titleFallback,
}) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState('60');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [activeKey, setActiveKey] = useState(null);
  const [results, setResults] = useState([]);
  const [gradeModal, setGradeModal] = useState(null);
  const [gradeDraft, setGradeDraft] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!assessment) {
      setTitle(titleFallback || (kind === 'post' ? 'اختبار بعدي' : 'اختبار قبلي'));
      setDescription('');
      setPassingScore('60');
      setDurationMinutes('30');
      setMaxAttempts('1');
      setOpensAt('');
      setClosesAt('');
      setShuffleQuestions(false);
      setShowResults(true);
      const first = createEmptyQuestion();
      setQuestions([first]);
      setActiveKey(first.clientKey);
      return;
    }
    setTitle(assessment.title || titleFallback || '');
    setDescription(assessment.instructions || assessment.description || '');
    setPassingScore(
      assessment.passScore != null || assessment.passingScore != null
        ? String(assessment.passScore ?? assessment.passingScore)
        : '60'
    );
    setDurationMinutes(
      assessment.durationMinutes != null ? String(assessment.durationMinutes) : '30'
    );
    setMaxAttempts(assessment.maxAttempts != null ? String(assessment.maxAttempts) : '1');
    setOpensAt(toDatetimeLocalValue(assessment.opensAt));
    setClosesAt(toDatetimeLocalValue(assessment.closesAt));
    setShuffleQuestions(Boolean(assessment.shuffleQuestions));
    setShowResults(assessment.showResults !== false);

    let cancelled = false;
    const applyQuestions = (source) => {
      if (cancelled) return;
      if (source?.questions?.length) {
        const hydrated = source.questions.map((q) =>
          hydrateQuestionFromApi({
            ...q,
            question_text: q.question_text || q.prompt,
            options: q.options || q.options_json,
          })
        );
        setQuestions(hydrated);
        setActiveKey(hydrated[0]?.clientKey ?? null);
      } else {
        const first = createEmptyQuestion();
        setQuestions([first]);
        setActiveKey(first.clientKey);
      }
    };

    if (assessment.questions?.length) {
      applyQuestions(assessment);
    } else if (assessment.id) {
      getAssessment(assessment.id)
        .then((detail) => applyQuestions(detail || assessment))
        .catch(() => applyQuestions(assessment));
    } else {
      applyQuestions(assessment);
    }

    return () => {
      cancelled = true;
    };
  }, [assessment?.id, assessment?.updatedAt, kind, titleFallback]);

  useEffect(() => {
    if (!assessment?.id || readOnly) return;
    listAssessmentResults(assessment.id)
      .then((rows) => setResults(Array.isArray(rows) ? rows : []))
      .catch(() => setResults([]));
  }, [assessment?.id, assessment?.updatedAt, readOnly]);

  const totals = useMemo(() => computeTotals(questions), [questions]);
  const incompleteCount = useMemo(() => countIncompleteQuestions(questions), [questions]);
  const isPublished = Boolean(assessment?.isPublished);

  function buildBody(publish) {
    return {
      title: title.trim() || titleFallback || (kind === 'post' ? 'اختبار بعدي' : 'اختبار قبلي'),
      description: description.trim() || null,
      duration_minutes: Number(durationMinutes) || null,
      max_attempts: Number(maxAttempts) || 1,
      pass_score: passingScore === '' ? null : Number(passingScore),
      opens_at: opensAt || null,
      closes_at: closesAt || null,
      shuffle_questions: shuffleQuestions,
      show_results: showResults,
      is_published: Boolean(publish),
      questions: questions.map((q, i) => serializeQuestionForApi(q, i)),
    };
  }

  async function save(publish) {
    if (readOnly) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (publish) {
        const validationError = validateBuilderForPublish({ title, questions, passingScore });
        if (validationError) throw Object.assign(new Error(validationError), { isValidation: true });
      }
      const saved = await upsertAssessment(programId, kind, buildBody(false));
      if (publish) {
        await publishAssessment(saved.id);
      }
      setMessage(publish ? 'تم نشر الاختبار.' : 'تم حفظ مسودة الاختبار.');
      onSaved?.(saved);
    } catch (err) {
      setError(err.isValidation ? err.message : getApiErrorMessage(err, 'تعذر حفظ الاختبار.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitGrades() {
    if (!gradeModal?.id) return;
    setBusy(true);
    setError('');
    try {
      const grades = Object.fromEntries(
        Object.entries(gradeDraft).map(([qid, pts]) => [qid, { points: Number(pts) || 0 }])
      );
      await gradeAssessmentAttempt(gradeModal.id, { grades });
      setGradeModal(null);
      setMessage('تم حفظ التصحيح اليدوي.');
      if (assessment?.id) {
        const rows = await listAssessmentResults(assessment.id);
        setResults(Array.isArray(rows) ? rows : []);
      }
      onSaved?.(assessment);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ التصحيح.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ft-qb training-assessment-editor">
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="auth-register__helper">{message}</p> : null}

      <div className="ft-qb-shell">
        <header className="ft-qb-hero">
          <div className="ft-qb-hero__top">
            <StatusBadge variant={isPublished ? 'success' : 'warning'}>
              {isPublished ? 'منشور' : 'مسودة'}
            </StatusBadge>
          </div>
          <div className="ft-qb-hero__body">
            <h2>{kind === 'post' ? 'الاختبار البعدي' : 'الاختبار القبلي'}</h2>
            <p>نفس محرك أسئلة التدريب الميداني — مرتبط بدورة TRAINING_COURSE.</p>
          </div>
          {!readOnly ? (
            <div className="ft-qb-hero__actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPreviewOpen(true)}>
                <Eye size={16} aria-hidden /> معاينة
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => save(false)}>
                {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} aria-hidden />} حفظ مسودة
              </Button>
              <Button type="button" variant="primary" disabled={busy} onClick={() => save(true)}>
                <Send size={16} aria-hidden /> نشر
              </Button>
            </div>
          ) : null}
        </header>

        <div className="ft-qb-layout">
          <div className="ft-qb-main">
            <div className="auth-form__fields-grid">
              <FormInput
                id="ta-title"
                label="عنوان الاختبار"
                value={title}
                disabled={readOnly}
                onChange={(e) => setTitle(e.target.value)}
              />
              <FormInput
                id="ta-pass"
                label="درجة النجاح (%)"
                type="number"
                value={passingScore}
                disabled={readOnly}
                onChange={(e) => setPassingScore(e.target.value)}
              />
              <FormInput
                id="ta-duration"
                label="المدة (دقائق)"
                type="number"
                value={durationMinutes}
                disabled={readOnly}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
              <FormInput
                id="ta-attempts"
                label="عدد المحاولات"
                type="number"
                value={maxAttempts}
                disabled={readOnly}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
              <FormInput
                id="ta-opens"
                label="يفتح في"
                type="datetime-local"
                value={opensAt}
                disabled={readOnly}
                onChange={(e) => setOpensAt(e.target.value)}
              />
              <FormInput
                id="ta-closes"
                label="يغلق في"
                type="datetime-local"
                value={closesAt}
                disabled={readOnly}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
            <FormTextarea
              id="ta-desc"
              label="التعليمات"
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  disabled={readOnly}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                عشوائية ترتيب الأسئلة
              </label>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={showResults}
                  disabled={readOnly}
                  onChange={(e) => setShowResults(e.target.checked)}
                />
                إظهار النتيجة للمتدرب
              </label>
            </div>

            {questions.map((q, index) => (
              <AssessmentQuestionCard
                key={q.clientKey}
                question={q}
                index={index}
                total={questions.length}
                active={activeKey === q.clientKey}
                disabled={readOnly}
                onActivate={() => setActiveKey(q.clientKey)}
                onChange={(next) =>
                  setQuestions((prev) => prev.map((row, i) => (i === index ? next : row)))
                }
                onMove={(dir) =>
                  setQuestions((prev) => {
                    const target = index + dir;
                    if (target < 0 || target >= prev.length) return prev;
                    const next = [...prev];
                    const tmp = next[index];
                    next[index] = next[target];
                    next[target] = tmp;
                    return next;
                  })
                }
                onDuplicate={() => {
                  const copy = { ...q, clientKey: createClientKey(), id: undefined };
                  setQuestions((prev) => {
                    const next = [...prev];
                    next.splice(index + 1, 0, copy);
                    return next;
                  });
                  setActiveKey(copy.clientKey);
                }}
                onRemove={() => {
                  if (questions.length <= 1) return;
                  setQuestions((prev) => prev.filter((_, i) => i !== index));
                }}
              />
            ))}

            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const q = createEmptyQuestion();
                  setQuestions((prev) => [...prev, q]);
                  setActiveKey(q.clientKey);
                }}
              >
                <Plus size={16} aria-hidden /> إضافة سؤال
              </Button>
            ) : null}
          </div>

          <aside className="ft-qb-summary">
            <h3 className="ft-qb-summary__title">ملخص</h3>
            <ul className="ft-qb-summary__list">
              <li>
                <span>عدد الأسئلة</span>
                <strong>{totals.questionCount}</strong>
              </li>
              <li>
                <span>مجموع الدرجات</span>
                <strong>{totals.totalPoints}</strong>
              </li>
              <li>
                <span>درجة النجاح</span>
                <strong>{passingScore || '—'}%</strong>
              </li>
              <li>
                <span>غير مكتمل</span>
                <strong className={incompleteCount > 0 ? 'ft-qb-summary__warn' : undefined}>
                  {incompleteCount}
                </strong>
              </li>
            </ul>
          </aside>
        </div>
      </div>

      {results.length ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>محاولات المتدربين</h3>
          <ul className="simple-list">
            {results.map((row) => (
              <li key={row.id}>
                <strong>{row.traineeName}</strong> — محاولة {row.attemptNo} —{' '}
                {row.score != null ? `${row.score}%` : '—'} — {row.status}
                {row.pendingManual && !readOnly ? (
                  <>
                    {' '}
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => {
                        const details = row.gradingDetails || [];
                        const draft = {};
                        details
                          .filter((d) => d.gradingStatus === 'pending_manual')
                          .forEach((d) => {
                            draft[d.questionId] = d.awardedPoints != null ? String(d.awardedPoints) : '';
                          });
                        setGradeDraft(draft);
                        setGradeModal(row);
                      }}
                    >
                      تصحيح يدوي
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {gradeModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h3>تصحيح محاولة — {gradeModal.traineeName}</h3>
            {Object.keys(gradeDraft).map((qid) => (
              <FormInput
                key={qid}
                id={`grade-${qid}`}
                label={`درجة السؤال ${qid.slice(0, 8)}…`}
                type="number"
                value={gradeDraft[qid]}
                onChange={(e) => setGradeDraft((p) => ({ ...p, [qid]: e.target.value }))}
              />
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Button type="button" variant="primary" disabled={busy} onClick={submitGrades}>
                حفظ التصحيح
              </Button>
              <Button type="button" variant="outline" onClick={() => setGradeModal(null)}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <h3>معاينة: {title}</h3>
            <ol>
              {questions.map((q, i) => (
                <li key={q.clientKey} style={{ marginBottom: '0.75rem' }}>
                  <strong>
                    {i + 1}. {q.question_text || 'بدون نص'}
                  </strong>
                  <div className="auth-register__helper">{q.question_type}</div>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

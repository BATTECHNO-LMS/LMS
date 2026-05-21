import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAdminLessonTraining, saveAdminLessonTraining } from '../../../../features/courses/courses.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

const emptyQuestion = () => ({
  question_text: '',
  code_snippet: '',
  points: 5,
  expected_answer: '',
  sort_order: 0,
});

export function AdminLessonTrainingSection({ courseId, lessonId }) {
  const { t } = useTranslation('courses');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    task_instructions: '',
    task_file_url: '',
    task_file_name: '',
    model_answer_url: '',
    model_answer_name: '',
    correction_prompt: '',
    max_score: 100,
    pass_score: 60,
    upload_weight: 30,
    questions: [emptyQuestion()],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminLessonTraining(courseId, lessonId);
        if (cancelled) return;
        setForm({
          task_instructions: data.task_instructions || '',
          task_file_url: data.task_file_url || '',
          task_file_name: data.task_file_name || '',
          model_answer_url: data.model_answer_url || '',
          model_answer_name: data.model_answer_name || '',
          correction_prompt: data.correction_prompt || '',
          max_score: data.max_score ?? 100,
          pass_score: data.pass_score ?? 60,
          upload_weight: data.upload_weight ?? 30,
          questions: data.questions?.length ? data.questions : [emptyQuestion()],
        });
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveAdminLessonTraining(courseId, lessonId, {
        ...form,
        questions: form.questions.filter((q) => q.question_text?.trim()),
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="crud-muted">{t('training.adminLoading')}</p>;

  return (
    <div className="admin-lesson-training">
      <h4 className="admin-lesson-training__title">{t('training.adminTitle')}</h4>
      {error ? <p className="admin-lesson-training__error">{error}</p> : null}

      <label className="admin-lesson-row__label">{t('training.taskInstructions')}</label>
      <textarea
        className="admin-lesson-row__textarea"
        rows={3}
        value={form.task_instructions}
        onChange={(e) => setForm((f) => ({ ...f, task_instructions: e.target.value }))}
      />

      <label className="admin-lesson-row__label">{t('training.taskFileUrl')}</label>
      <input
        className="admin-lesson-row__input"
        dir="ltr"
        value={form.task_file_url}
        onChange={(e) => setForm((f) => ({ ...f, task_file_url: e.target.value }))}
        placeholder="https://.../task.pdf"
      />

      <label className="admin-lesson-row__label">{t('training.modelAnswerUrl')}</label>
      <input
        className="admin-lesson-row__input"
        dir="ltr"
        value={form.model_answer_url}
        onChange={(e) => setForm((f) => ({ ...f, model_answer_url: e.target.value }))}
      />

      <label className="admin-lesson-row__label">{t('training.correctionPrompt')}</label>
      <textarea
        className="admin-lesson-row__textarea"
        rows={4}
        value={form.correction_prompt}
        onChange={(e) => setForm((f) => ({ ...f, correction_prompt: e.target.value }))}
      />

      <div className="admin-lesson-training__scores">
        <label>
          {t('training.maxScore')}
          <input
            type="number"
            min={1}
            value={form.max_score}
            onChange={(e) => setForm((f) => ({ ...f, max_score: Number(e.target.value) }))}
          />
        </label>
        <label>
          {t('training.passScore')}
          <input
            type="number"
            min={0}
            value={form.pass_score}
            onChange={(e) => setForm((f) => ({ ...f, pass_score: Number(e.target.value) }))}
          />
        </label>
        <label>
          {t('training.uploadWeight')}
          <input
            type="number"
            min={0}
            max={100}
            value={form.upload_weight}
            onChange={(e) => setForm((f) => ({ ...f, upload_weight: Number(e.target.value) }))}
          />
        </label>
      </div>

      <p className="admin-lesson-row__label">{t('training.questionsTitle')}</p>
      {form.questions.map((q, idx) => (
        <div key={idx} className="admin-lesson-training__question">
          <input
            className="admin-lesson-row__input"
            placeholder={t('training.questionText')}
            value={q.question_text}
            onChange={(e) => {
              const questions = [...form.questions];
              questions[idx] = { ...q, question_text: e.target.value };
              setForm((f) => ({ ...f, questions }));
            }}
          />
          <textarea
            className="admin-lesson-row__textarea"
            rows={2}
            placeholder={t('training.codeSnippet')}
            value={q.code_snippet || ''}
            onChange={(e) => {
              const questions = [...form.questions];
              questions[idx] = { ...q, code_snippet: e.target.value };
              setForm((f) => ({ ...f, questions }));
            }}
          />
          <div className="admin-lesson-training__q-meta">
            <input
              type="number"
              min={1}
              value={q.points}
              onChange={(e) => {
                const questions = [...form.questions];
                questions[idx] = { ...q, points: Number(e.target.value) };
                setForm((f) => ({ ...f, questions }));
              }}
            />
            <input
              className="admin-lesson-row__input"
              placeholder={t('training.expectedAnswer')}
              value={q.expected_answer || ''}
              onChange={(e) => {
                const questions = [...form.questions];
                questions[idx] = { ...q, expected_answer: e.target.value };
                setForm((f) => ({ ...f, questions }));
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }))}
      >
        + {t('training.addQuestion')}
      </button>

      <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={handleSave}>
        {saving ? t('structure.saving') : t('training.saveTraining')}
      </button>
    </div>
  );
}

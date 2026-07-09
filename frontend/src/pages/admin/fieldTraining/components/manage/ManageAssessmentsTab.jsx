import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  createOpportunityAssessment,
  publishAssessmentById,
  updateAssessment,
  useOpportunityAssessments,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

const emptyQuestion = {
  question_text: '',
  question_type: 'multiple_choice',
  options: ['', ''],
  correct_answer: '',
  points: 1,
};

export function ManageAssessmentsTab({ opportunityId, type, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data, isLoading } = useOpportunityAssessments(opportunityId, { scope: apiScope });
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState('60');
  const [questions, setQuestions] = useState([{ ...emptyQuestion }]);

  const assessment = useMemo(
    () => (data?.assessments ?? []).find((a) => a.type === type) ?? null,
    [data, type]
  );

  useEffect(() => {
    if (!assessment) return;
    setTitle(assessment.title ?? '');
    setDescription(assessment.description ?? '');
    setPassingScore(assessment.passing_score != null ? String(assessment.passing_score) : '60');
    if (assessment.questions?.length) {
      setQuestions(
        assessment.questions.map((q) => ({
          question_text: q.question_text ?? '',
          question_type: q.question_type ?? 'multiple_choice',
          options: Array.isArray(q.options) ? q.options : ['', ''],
          correct_answer: q.correct_answer ?? '',
          points: q.points ?? 1,
        }))
      );
    }
  }, [assessment?.id]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.assessments(opportunityId, apiScope) });

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        passing_score: passingScore ? Number(passingScore) : null,
        questions: questions
          .filter((q) => q.question_text.trim())
          .map((q, i) => ({
            question_text: q.question_text.trim(),
            question_type: q.question_type,
            options: q.question_type === 'multiple_choice' ? q.options.filter(Boolean) : null,
            correct_answer: q.correct_answer,
            points: Number(q.points) || 1,
            sort_order: i,
          })),
      };
      if (assessment?.id) {
        return updateAssessment(assessment.id, body, { asInstructor: isInstructor });
      }
      return createOpportunityAssessment(opportunityId, { ...body, type }, { asInstructor: isInstructor });
    },
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const publishMut = useMutation({
    mutationFn: () => publishAssessmentById(assessment.id, { asInstructor: isInstructor }),
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <h2 className="ft-manage-panel__title">{t(`manageHub.assessment.${type}.title`)}</h2>
        {assessment?.status ? (
          <StatusBadge variant={assessment.status === 'published' ? 'success' : 'pending'}>
            {t(`assessmentStatus.${assessment.status}`)}
          </StatusBadge>
        ) : null}
      </header>

      <form
        className="ft-assessment-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          saveMut.mutate();
        }}
      >
        <FormInput label={t('manageHub.assessment.title')} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <FormTextarea
          label={t('manageHub.assessment.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <FormInput
          label={t('manageHub.assessment.passingScore')}
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(e) => setPassingScore(e.target.value)}
        />

        <h3 className="ft-manage-panel__subtitle">{t('manageHub.assessment.questions')}</h3>
        {questions.map((q, idx) => (
          <div key={idx} className="ft-question-card">
            <FormTextarea
              label={t('manageHub.assessment.questionText')}
              value={q.question_text}
              onChange={(e) => {
                const next = [...questions];
                next[idx] = { ...next[idx], question_text: e.target.value };
                setQuestions(next);
              }}
              rows={2}
            />
            <select
              className="ft-modal-select__control"
              value={q.question_type}
              onChange={(e) => {
                const next = [...questions];
                next[idx] = { ...next[idx], question_type: e.target.value };
                setQuestions(next);
              }}
            >
              <option value="multiple_choice">{t('manageHub.assessment.mc')}</option>
              <option value="true_false">{t('manageHub.assessment.tf')}</option>
              <option value="short_answer">{t('manageHub.assessment.short')}</option>
            </select>
            {q.question_type === 'multiple_choice' ? (
              <FormInput
                label={t('manageHub.assessment.options')}
                value={(q.options || []).join(', ')}
                onChange={(e) => {
                  const next = [...questions];
                  next[idx] = { ...next[idx], options: e.target.value.split(',').map((s) => s.trim()) };
                  setQuestions(next);
                }}
              />
            ) : null}
            <FormInput
              label={t('manageHub.assessment.correctAnswer')}
              value={String(q.correct_answer ?? '')}
              onChange={(e) => {
                const next = [...questions];
                next[idx] = { ...next[idx], correct_answer: e.target.value };
                setQuestions(next);
              }}
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setQuestions((prev) => [...prev, { ...emptyQuestion }])}>
          {t('manageHub.assessment.addQuestion')}
        </Button>

        {error ? <p className="form-field__error">{error}</p> : null}
        <div className="ft-manage-form-actions">
          <Button type="submit" variant="primary" disabled={saveMut.isPending}>
            {t('save')}
          </Button>
          {assessment?.id && assessment.status !== 'published' ? (
            <Button type="button" variant="outline" disabled={publishMut.isPending} onClick={() => publishMut.mutate()}>
              {t('manageHub.assessment.publish')}
            </Button>
          ) : null}
        </div>
      </form>

      {assessment?.attempts?.length ? (
        <section className="ft-assessment-results">
          <h3>{t('manageHub.assessment.results')}</h3>
          <ul>
            {assessment.attempts.map((a) => (
              <li key={a.id}>
                {a.student_name ?? '—'} — {a.score}%{' '}
                {a.level ? `(${t(`knowledgeLevel.${a.level}`)})` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

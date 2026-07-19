import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { FormNumber, FormTextarea } from '../../components/forms/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { useSubmission } from '../../features/submissions/hooks/useAcademicSubmissionMutations.js';
import { useSubmissions } from '../../features/submissions/hooks/useSubmissions.js';
import {
  useCreateAcademicGrade,
  useFinalizeAcademicGrade,
  useGrade,
  useUpdateAcademicGrade,
} from '../../features/grades/hooks/useAcademicGradeMutations.js';
import {
  createAcademicGradeSchema,
  updateAcademicGradeSchema,
} from '../../features/assessments/academicDeliverySchemas.js';
import { academicSubmissionStatusLabel } from '../../features/assessments/academicStatusMap.js';
import { useLocale } from '../../features/locale/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { safeParse } from '../../utils/zodErrors.js';

function pickLatestSubmission(list) {
  const rows = list || [];
  if (!rows.length) return null;
  return rows.sort(
    (a, b) =>
      new Date(b.updated_at || b.submitted_at || 0) - new Date(a.updated_at || a.submitted_at || 0)
  )[0];
}

/**
 * Instructor academic grading form.
 * Routes:
 * - /instructor/submissions/:submissionId/grade
 * - /instructor/grades/:gradeId/edit
 */
export function InstructorAcademicGradePage() {
  const { submissionId, gradeId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const lang = locale?.startsWith('ar') ? 'ar' : 'en';
  const P = UI_PERMISSION;

  const {
    data: gradeById,
    isLoading: gradeLoading,
    isError: gradeError,
  } = useGrade(gradeId, { enabled: Boolean(gradeId) });

  const {
    data: submissionById,
    isLoading: submissionLoading,
    isError: submissionError,
  } = useSubmission(submissionId, { enabled: Boolean(submissionId) });

  const assessmentIdForList = submissionById?.assessment_id || gradeById?.assessment_id;
  const studentIdForList = submissionById?.student_id || gradeById?.student_id;

  const { data: listPayload, isLoading: listLoading } = useSubmissions(
    {
      assessment_id: assessmentIdForList,
      student_id: studentIdForList,
    },
    {
      enabled: Boolean(gradeId && assessmentIdForList && studentIdForList && !submissionId),
      staleTime: 15_000,
    }
  );

  const submissionFromList = useMemo(
    () => pickLatestSubmission(listPayload?.submissions),
    [listPayload]
  );

  const submission = submissionById || submissionFromList;
  const grade = submission?.current_grade || gradeById;
  const isFinal = Boolean(grade?.is_final);
  const readOnly = isFinal;

  const createMut = useCreateAcademicGrade();
  const updateMut = useUpdateAcademicGrade();
  const finalizeMut = useFinalizeAcademicGrade();
  const pending = createMut.isPending || updateMut.isPending || finalizeMut.isPending;

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!grade) {
      setScore('');
      setFeedback('');
      return;
    }
    setScore(grade.score != null ? String(grade.score) : '');
    setFeedback(grade.feedback ?? '');
  }, [grade]);

  async function saveGrade(e) {
    e.preventDefault();
    if (pending || readOnly) return;
    setApiError('');
    setSuccessMsg('');

    const studentId = submission?.student_id || grade?.student_id;
    const assessmentId = submission?.assessment_id || grade?.assessment_id;
    if (!studentId || !assessmentId) {
      setApiError(tCommon('errors.generic'));
      return;
    }

    if (grade?.id) {
      const parsed = safeParse(updateAcademicGradeSchema, {
        score: score === '' ? undefined : Number(score),
        feedback: feedback.trim() ? feedback : null,
      });
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      try {
        await updateMut.mutateAsync({ gradeId: grade.id, body: parsed.data });
        setSuccessMsg(t('delivery.grade.updated'));
      } catch (err) {
        // Preserve form values on recoverable errors; GRADE_FINALIZED triggers query
        // invalidation in the mutation hook so the page becomes read-only from server state.
        setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
      }
      return;
    }

    const parsed = safeParse(createAcademicGradeSchema, {
      student_id: studentId,
      score: Number(score),
      feedback: feedback.trim() ? feedback : null,
      is_final: false,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    try {
      await createMut.mutateAsync({
        assessmentId,
        body: parsed.data,
      });
      setSuccessMsg(t('delivery.grade.created'));
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function onFinalize() {
    if (!grade?.id || pending || readOnly) return;
    const ok = window.confirm(t('delivery.grade.finalizeConfirm'));
    if (!ok) return;
    setApiError('');
    setSuccessMsg('');
    try {
      await finalizeMut.mutateAsync(grade.id);
      setSuccessMsg(t('delivery.grade.finalized'));
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  const loading =
    (Boolean(submissionId) && submissionLoading) ||
    (Boolean(gradeId) && gradeLoading) ||
    (Boolean(gradeId) && !submissionId && listLoading);

  if (loading) {
    return (
      <PagePermissionGate permission={P.canGradeAssessments}>
        <div className="page page--dashboard page--instructor">
          <LoadingSpinner />
        </div>
      </PagePermissionGate>
    );
  }

  const notFound =
    (submissionId && (submissionError || !submission)) ||
    (gradeId && !submissionId && (gradeError || !gradeById));

  if (notFound) {
    return (
      <PagePermissionGate permission={P.canViewSubmissionsTeaching}>
        <div className="page page--dashboard page--instructor">
          <AdminPageHeader title={t('delivery.grade.notFound')} description="" />
          <Link className="btn btn--primary" to="/instructor/submissions">
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </PagePermissionGate>
    );
  }

  const backTo = gradeId && !submissionId ? '/instructor/grades' : '/instructor/submissions';
  const titleAssessment =
    submission?.assessment?.title || grade?.assessment?.title || t('delivery.grade.submissionCard');

  return (
    <PagePermissionGate permission={P.canGradeAssessments}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader
          title={<>{t('delivery.grade.title')}</>}
          description={<>{t('delivery.grade.description')}</>}
        />
        <SectionCard title={<>{titleAssessment}</>}>
          <dl className="crud-dl" style={{ marginBottom: '1rem' }}>
            <div>
              <dt>{t('delivery.fields.student')}</dt>
              <dd>
                {submission?.student?.full_name ||
                  grade?.student?.full_name ||
                  submission?.student_id ||
                  grade?.student_id}
              </dd>
            </div>
            {submission?.status ? (
              <div>
                <dt>{t('delivery.fields.submissionStatus')}</dt>
                <dd>{academicSubmissionStatusLabel(submission.status, lang)}</dd>
              </div>
            ) : null}
            {submission?.submission_type ? (
              <div>
                <dt>{t('delivery.fields.submissionType')}</dt>
                <dd>{submission.submission_type}</dd>
              </div>
            ) : null}
          </dl>

          {submission?.text_response ? (
            <div style={{ marginBottom: '1rem' }}>
              <h3 className="section-card__title">{t('delivery.fields.textResponse')}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{submission.text_response}</p>
            </div>
          ) : null}
          {submission?.file_url ? (
            <p>
              {t('delivery.fields.fileUrl')}:{' '}
              <a href={submission.file_url} target="_blank" rel="noreferrer">
                {submission.file_url}
              </a>
            </p>
          ) : null}
          {submission?.repo_url ? (
            <p>
              {t('delivery.fields.repoUrl')}:{' '}
              <a href={submission.repo_url} target="_blank" rel="noreferrer">
                {submission.repo_url}
              </a>
            </p>
          ) : null}

          {readOnly ? (
            <p className="crud-muted" role="status">
              {t('delivery.grade.finalReadOnly')}
            </p>
          ) : null}

          <form className="crud-form" onSubmit={saveGrade} noValidate>
            <FormNumber
              id="score"
              label={t('delivery.fields.score')}
              value={score}
              min={0}
              max={100}
              step={0.01}
              disabled={readOnly || pending}
              onChange={(e) => {
                setScore(e.target.value);
                setErrors((er) => ({ ...er, score: undefined }));
              }}
              error={errors.score}
            />
            <FormTextarea
              id="feedback"
              label={t('delivery.fields.feedback')}
              value={feedback}
              rows={5}
              disabled={readOnly || pending}
              onChange={(e) => {
                setFeedback(e.target.value);
                setErrors((er) => ({ ...er, feedback: undefined }));
              }}
              error={errors.feedback}
            />

            {apiError ? <p className="form-field__error">{apiError}</p> : null}
            {successMsg ? <p className="crud-muted" role="status">{successMsg}</p> : null}

            <div className="crud-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={pending}
                onClick={() => navigate(backTo)}
              >
                <ArrowRight size={18} aria-hidden /> {tCommon('actions.backToList')}
              </button>
              {!readOnly ? (
                <button type="submit" className="btn btn--primary" disabled={pending}>
                  <Save size={18} aria-hidden />{' '}
                  {pending ? tCommon('actions.saving') : t('delivery.grade.save')}
                </button>
              ) : null}
              {!readOnly && grade?.id ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={pending}
                  onClick={onFinalize}
                >
                  <CheckCircle2 size={18} aria-hidden /> {t('delivery.grade.finalize')}
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}

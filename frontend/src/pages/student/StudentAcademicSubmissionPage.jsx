import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, ArrowRight } from 'lucide-react';
import { StudentPageHeader, StudentSection } from '../../components/student/index.js';
import { FormSelect, FormTextarea, FormInput } from '../../components/forms/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { useAssessment } from '../../features/assessments/hooks/useAssessment.js';
import {
  academicAssessmentStatusLabel,
  academicSubmissionStatusLabel,
  isAcademicSubmissionEditable,
} from '../../features/assessments/academicStatusMap.js';
import { createAcademicSubmissionSchema } from '../../features/assessments/academicDeliverySchemas.js';
import { useSubmissions } from '../../features/submissions/hooks/useSubmissions.js';
import {
  useCreateAcademicSubmission,
  useSubmission,
  useUpdateAcademicSubmission,
  isAcademicSubmissionExistsConflict,
} from '../../features/submissions/hooks/useAcademicSubmissionMutations.js';
import { useLocale } from '../../features/locale/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { safeParse } from '../../utils/zodErrors.js';
import { SubmissionStatusBadge } from '../../components/assessment/SubmissionStatusBadge.jsx';

function pickLatestSubmission(list, assessmentId) {
  const rows = (list || []).filter((s) => String(s.assessment_id) === String(assessmentId));
  if (!rows.length) return null;
  return rows.sort((a, b) => new Date(b.updated_at || b.submitted_at || 0) - new Date(a.updated_at || a.submitted_at || 0))[0];
}

export function StudentAcademicSubmissionPage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const lang = locale?.startsWith('ar') ? 'ar' : 'en';
  const P = UI_PERMISSION;

  const { data: assessment, isLoading: assessmentLoading, isError: assessmentError } = useAssessment(assessmentId);
  const { data: listPayload, isLoading: listLoading } = useSubmissions(
    { assessment_id: assessmentId },
    { staleTime: 15_000, enabled: Boolean(assessmentId) }
  );
  const listSubmission = useMemo(
    () => pickLatestSubmission(listPayload?.submissions, assessmentId),
    [listPayload, assessmentId]
  );
  const submissionId = listSubmission?.id;
  const {
    data: detailSubmission,
    isLoading: detailLoading,
  } = useSubmission(submissionId, { enabled: Boolean(submissionId) });

  const submission = detailSubmission || listSubmission;
  const editable = !submission || isAcademicSubmissionEditable(submission);
  const locked = Boolean(submission) && !editable;

  const createMut = useCreateAcademicSubmission();
  const updateMut = useUpdateAcademicSubmission();
  const pending = createMut.isPending || updateMut.isPending;

  const preferred = assessment?.preferred_submission_type || 'text_response';
  const [form, setForm] = useState({
    submission_type: preferred,
    text_response: '',
    file_url: '',
    repo_url: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!assessment) return;
    setForm((f) => ({
      ...f,
      submission_type: submission?.submission_type || assessment.preferred_submission_type || 'text_response',
      text_response: submission?.text_response ?? '',
      file_url: submission?.file_url ?? '',
      repo_url: submission?.repo_url ?? '',
    }));
  }, [assessment, submission]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (pending || locked) return;
    setApiError('');
    setSuccessMsg('');
    const body = {
      submission_type: form.submission_type,
      text_response: form.text_response?.trim() ? form.text_response.trim() : null,
      file_url: form.file_url?.trim() ? form.file_url.trim() : null,
      repo_url: form.repo_url?.trim() ? form.repo_url.trim() : null,
    };
    const parsed = safeParse(createAcademicSubmissionSchema, body);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    try {
      if (submission?.id && editable) {
        await updateMut.mutateAsync({ submissionId: submission.id, body: parsed.data });
        setSuccessMsg(t('delivery.submit.updated'));
      } else if (!submission) {
        await createMut.mutateAsync({ assessmentId, body: parsed.data });
        setSuccessMsg(t('delivery.submit.created'));
      }
    } catch (err) {
      // Preserve entered form fields. Exists-conflict refreshes queries so the
      // page switches to edit mode when the existing row loads — POST is not repeated automatically.
      if (isAcademicSubmissionExistsConflict(err)) {
        setApiError(t('delivery.submit.alreadyExists'));
      } else {
        setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
      }
    }
  }

  const loading = assessmentLoading || listLoading || (submissionId && detailLoading);

  if (loading) {
    return (
      <PagePermissionGate permission={P.canSubmitAssessments}>
        <div className="page page--dashboard page--student">
          <LoadingSpinner />
        </div>
      </PagePermissionGate>
    );
  }

  if (assessmentError || !assessment) {
    return (
      <PagePermissionGate permission={P.canViewAssessments}>
        <div className="page page--dashboard page--student">
          <StudentPageHeader title={<>{t('delivery.submit.notFound')}</>} description="" />
          <Link className="btn btn--primary" to="/student/assessments">
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </PagePermissionGate>
    );
  }

  const grade = submission?.current_grade;

  return (
    <PagePermissionGate permission={P.canSubmitAssessments}>
      <div className="page page--dashboard page--student">
        <StudentPageHeader
          title={<>{t('delivery.submit.title')}</>}
          description={<>{t('delivery.submit.description')}</>}
        />
        <StudentSection title={<>{assessment.title}</>} icon={Save}>
          <dl className="crud-dl" style={{ marginBottom: '1rem' }}>
            <div>
              <dt>{t('delivery.fields.assessmentStatus')}</dt>
              <dd>{academicAssessmentStatusLabel(assessment.status, lang)}</dd>
            </div>
            <div>
              <dt>{t('table.dueDate')}</dt>
              <dd>{assessment.due_date ? String(assessment.due_date).slice(0, 16).replace('T', ' ') : '—'}</dd>
            </div>
            {submission ? (
              <div>
                <dt>{t('delivery.fields.submissionStatus')}</dt>
                <dd>
                  <SubmissionStatusBadge state={submission.status} />{' '}
                  <span className="crud-muted">{academicSubmissionStatusLabel(submission.status, lang)}</span>
                </dd>
              </div>
            ) : null}
          </dl>
          {assessment.instructions ? (
            <p className="crud-muted" style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
              {assessment.instructions}
            </p>
          ) : null}

          {locked ? (
            <p className="crud-muted" role="status">
              {t('delivery.submit.locked')}
            </p>
          ) : null}

          {grade ? (
            <div className="section-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <h3 className="section-card__title">{t('delivery.submit.feedbackTitle')}</h3>
              <p>
                {t('delivery.fields.score')}: <strong>{grade.score}</strong>
                {grade.is_final ? ` (${t('delivery.fields.final')})` : ''}
              </p>
              {grade.feedback ? <p style={{ whiteSpace: 'pre-wrap' }}>{grade.feedback}</p> : null}
            </div>
          ) : null}

          <form className="crud-form" onSubmit={onSubmit} noValidate>
            <FormSelect
              id="submission_type"
              label={t('delivery.fields.submissionType')}
              value={form.submission_type}
              disabled={locked || pending}
              onChange={(e) => setField('submission_type', e.target.value)}
              error={errors.submission_type}
            >
              <option value="text_response">{t('delivery.types.text_response')}</option>
              <option value="file">{t('delivery.types.file_url')}</option>
              <option value="repo_url">{t('delivery.types.repo_url')}</option>
              <option value="mixed">{t('delivery.types.mixed')}</option>
            </FormSelect>

            <FormTextarea
              id="text_response"
              label={t('delivery.fields.textResponse')}
              value={form.text_response}
              disabled={locked || pending}
              onChange={(e) => setField('text_response', e.target.value)}
              error={errors.text_response}
              rows={6}
            />

            <FormInput
              id="file_url"
              label={t('delivery.fields.fileUrl')}
              value={form.file_url}
              disabled={locked || pending}
              onChange={(e) => setField('file_url', e.target.value)}
              error={errors.file_url}
              placeholder="https://"
            />
            <p className="crud-muted">{t('delivery.submit.fileUrlHint')}</p>

            <FormInput
              id="repo_url"
              label={t('delivery.fields.repoUrl')}
              value={form.repo_url}
              disabled={locked || pending}
              onChange={(e) => setField('repo_url', e.target.value)}
              error={errors.repo_url}
              placeholder="https://"
            />

            {apiError ? <p className="form-field__error">{apiError}</p> : null}
            {successMsg ? <p className="crud-muted" role="status">{successMsg}</p> : null}

            <div className="crud-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate('/student/assessments')}
                disabled={pending}
              >
                <ArrowRight size={18} aria-hidden /> {tCommon('actions.backToList')}
              </button>
              {!locked ? (
                <button type="submit" className="btn btn--primary" disabled={pending}>
                  <Save size={18} aria-hidden />{' '}
                  {pending
                    ? tCommon('actions.saving')
                    : submission
                      ? t('delivery.submit.saveEdit')
                      : t('delivery.submit.saveNew')}
                </button>
              ) : null}
            </div>
          </form>
        </StudentSection>
      </div>
    </PagePermissionGate>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAssessments } from '../../../features/assessments/index.js';
import { useSessions } from '../../../features/sessions/index.js';
import { useEnrollments } from '../../../features/enrollments/index.js';
import { useEvidenceItem, useUpdateEvidence } from '../../../features/evidence/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function EvidenceEditPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('evidence');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useEvidenceItem(id, { staleTime: 30_000 });
  const ev = data?.evidence;
  const updateMut = useUpdateEvidence();

  const [form, setForm] = useState({
    title: '',
    evidence_type: '',
    file_url: '',
    student_id: '',
    assessment_id: '',
    session_id: '',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!ev) return;
    setForm({
      title: ev.title ?? '',
      evidence_type: ev.evidence_type ?? '',
      file_url: ev.file_url ?? '',
      student_id: ev.student_id ?? '',
      assessment_id: ev.assessment_id ?? '',
      session_id: ev.session_id ?? '',
    });
  }, [ev]);

  const cohortId = ev?.cohort_id;

  const { data: assPayload } = useAssessments(
    { cohort_id: cohortId || undefined },
    { enabled: Boolean(cohortId), staleTime: 30_000 }
  );
  const assessments = assPayload?.assessments ?? [];

  const { data: sessPayload } = useSessions(cohortId || undefined, {
    enabled: Boolean(cohortId),
    staleTime: 30_000,
  });
  const sessions = sessPayload?.sessions ?? [];

  const { data: enPayload } = useEnrollments(cohortId || undefined, {
    enabled: Boolean(cohortId),
    staleTime: 30_000,
  });
  const enrollments = enPayload?.enrollments ?? [];

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        title: form.title.trim(),
        evidence_type: form.evidence_type.trim(),
        file_url: form.file_url.trim(),
        student_id: form.student_id || null,
        assessment_id: form.assessment_id || null,
        session_id: form.session_id || null,
      };
      await updateMut.mutateAsync({ id, body });
      navigate(`${base}/evidence/${id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  const ready = useMemo(() => Boolean(ev), [ev]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('edit.title')}</>} description={null} />
      <SectionCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p className="form-error">{String(error?.message ?? tCommon('errors.generic'))}</p>
        ) : ready ? (
          <form className="form-grid" onSubmit={onSubmit}>
            {apiError ? <p className="form-error">{apiError}</p> : null}
            <FormInput id="ev-title" label={t('form.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} required />
            <FormInput
              id="ev-type"
              label={t('form.evidenceType')}
              value={form.evidence_type}
              onChange={(e) => setField('evidence_type', e.target.value)}
              required
            />
            <FormTextarea id="ev-url" label={t('form.fileUrl')} value={form.file_url} onChange={(e) => setField('file_url', e.target.value)} rows={2} required />
            <FormSelect id="ev-student" label={t('form.student')} value={form.student_id} onChange={(e) => setField('student_id', e.target.value)}>
              <option value="">{t('form.none')}</option>
              {enrollments.map((en) => (
                <option key={en.id} value={en.student_id}>
                  {en.student?.full_name ?? en.student_id}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="ev-assessment" label={t('form.assessment')} value={form.assessment_id} onChange={(e) => setField('assessment_id', e.target.value)}>
              <option value="">{t('form.none')}</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="ev-session" label={t('form.session')} value={form.session_id} onChange={(e) => setField('session_id', e.target.value)}>
              <option value="">{t('form.none')}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </FormSelect>
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={updateMut.isPending}>
                <Save size={18} aria-hidden /> {t('edit.submit')}
              </Button>
              <Link className="btn btn--outline" to={`${base}/evidence/${id}`}>
                <X size={18} aria-hidden /> {t('create.cancel')}
              </Link>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}

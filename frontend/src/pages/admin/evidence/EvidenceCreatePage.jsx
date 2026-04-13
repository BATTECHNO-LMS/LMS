import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useAssessments } from '../../../features/assessments/index.js';
import { useSessions } from '../../../features/sessions/index.js';
import { useEnrollments } from '../../../features/enrollments/index.js';
import { useCreateEvidence } from '../../../features/evidence/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function EvidenceCreatePage() {
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('evidence');
  const { t: tCommon } = useTranslation('common');
  const createMut = useCreateEvidence();

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const [form, setForm] = useState({
    cohort_id: '',
    micro_credential_id: '',
    title: '',
    evidence_type: 'document',
    file_url: '',
    student_id: '',
    assessment_id: '',
    session_id: '',
  });
  const [apiError, setApiError] = useState('');

  const selectedCohort = useMemo(
    () => cohorts.find((c) => String(c.id) === String(form.cohort_id)),
    [cohorts, form.cohort_id]
  );

  useEffect(() => {
    if (!cohorts.length || form.cohort_id) return;
    const c = cohorts[0];
    setForm((f) => ({
      ...f,
      cohort_id: c.id,
      micro_credential_id: c.micro_credential?.id ?? '',
    }));
  }, [cohorts, form.cohort_id]);

  useEffect(() => {
    if (!selectedCohort?.micro_credential?.id) return;
    setForm((f) =>
      f.micro_credential_id === selectedCohort.micro_credential.id
        ? f
        : { ...f, micro_credential_id: selectedCohort.micro_credential.id, assessment_id: '', session_id: '', student_id: '' }
    );
  }, [selectedCohort]);

  const { data: assPayload } = useAssessments(
    { cohort_id: form.cohort_id || undefined },
    { enabled: Boolean(form.cohort_id), staleTime: 30_000 }
  );
  const assessments = assPayload?.assessments ?? [];

  const { data: sessPayload } = useSessions(form.cohort_id || undefined, {
    enabled: Boolean(form.cohort_id),
    staleTime: 30_000,
  });
  const sessions = sessPayload?.sessions ?? [];

  const { data: enPayload } = useEnrollments(form.cohort_id || undefined, {
    enabled: Boolean(form.cohort_id),
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
        cohort_id: form.cohort_id,
        micro_credential_id: form.micro_credential_id,
        title: form.title.trim(),
        evidence_type: form.evidence_type.trim(),
        file_url: form.file_url.trim(),
      };
      if (form.student_id) body.student_id = form.student_id;
      if (form.assessment_id) body.assessment_id = form.assessment_id;
      if (form.session_id) body.session_id = form.session_id;
      const res = await createMut.mutateAsync(body);
      const id = res?.evidence?.id;
      if (id) navigate(`${base}/evidence/${id}`);
      else navigate(`${base}/evidence`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create.title')}</>} description={<>{t('create.description')}</>} />
      <SectionCard>
        <form className="form-grid" onSubmit={onSubmit}>
          {apiError ? <p className="form-error">{apiError}</p> : null}
          <FormSelect
            id="ev-cohort"
            label={t('form.cohort')}
            value={form.cohort_id}
            onChange={(e) => {
              const cid = e.target.value;
              const c = cohorts.find((x) => String(x.id) === cid);
              setForm((f) => ({
                ...f,
                cohort_id: cid,
                micro_credential_id: c?.micro_credential?.id ?? '',
                assessment_id: '',
                session_id: '',
                student_id: '',
              }));
            }}
            required
          >
            <option value="">{t('form.none')}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </FormSelect>
          <FormInput
            id="ev-mc"
            label={t('form.microCredential')}
            value={form.micro_credential_id}
            onChange={(e) => setField('micro_credential_id', e.target.value)}
            required
            readOnly
          />
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
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              <Save size={18} aria-hidden /> {t('create.submit')}
            </Button>
            <Link className="btn btn--outline" to={`${base}/evidence`}>
              <X size={18} aria-hidden /> {t('create.cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

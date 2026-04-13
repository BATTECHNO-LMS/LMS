import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useEnrollments } from '../../../features/enrollments/index.js';
import { useAssessments } from '../../../features/assessments/index.js';
import { useCreateIntegrityCase } from '../../../features/integrity/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const CASE_TYPES = ['cheating', 'plagiarism', 'non_original_submission', 'attendance_manipulation', 'unauthorized_tools', 'other'];
const STATUSES = ['reported', 'under_investigation'];

export function IntegrityCaseCreatePage() {
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('integrityCases');
  const { t: tCommon } = useTranslation('common');
  const createMut = useCreateIntegrityCase();
  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const [form, setForm] = useState({
    cohort_id: '',
    student_id: '',
    case_type: 'cheating',
    assessment_id: '',
    evidence_notes: '',
    decision: '',
    status: 'reported',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!cohorts.length || form.cohort_id) return;
    setForm((f) => ({ ...f, cohort_id: cohorts[0].id }));
  }, [cohorts, form.cohort_id]);

  const { data: enPayload } = useEnrollments(form.cohort_id || undefined, {
    enabled: Boolean(form.cohort_id),
    staleTime: 30_000,
  });
  const enrollments = enPayload?.enrollments ?? [];

  const { data: assPayload } = useAssessments(
    { cohort_id: form.cohort_id || undefined },
    { enabled: Boolean(form.cohort_id), staleTime: 30_000 }
  );
  const assessments = assPayload?.assessments ?? [];

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        cohort_id: form.cohort_id,
        student_id: form.student_id,
        case_type: form.case_type,
        status: form.status,
      };
      if (form.assessment_id) body.assessment_id = form.assessment_id;
      if (form.evidence_notes.trim()) body.evidence_notes = form.evidence_notes.trim();
      if (form.decision.trim()) body.decision = form.decision.trim();
      const res = await createMut.mutateAsync(body);
      const id = res?.integrity_case?.id;
      if (id) navigate(`${base}/integrity-cases/${id}`);
      else navigate(`${base}/integrity-cases`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create.title')}</>} description={null} />
      <SectionCard>
        <form className="form-grid" onSubmit={onSubmit}>
          {apiError ? <p className="form-error">{apiError}</p> : null}
          <FormSelect id="ic-cohort" label={t('form.cohort')} value={form.cohort_id} onChange={(e) => setForm((f) => ({ ...f, cohort_id: e.target.value, student_id: '', assessment_id: '' }))} required>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="ic-student" label={t('form.student')} value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} required>
            <option value="">{tCommon('emptyStates.noResultsTitle')}</option>
            {enrollments.map((en) => (
              <option key={en.id} value={en.student_id}>
                {en.student?.full_name ?? en.student_id}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="ic-type" label={t('form.caseType')} value={form.case_type} onChange={(e) => setForm((f) => ({ ...f, case_type: e.target.value }))} required>
            {CASE_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="ic-assessment" label={t('form.assessment')} value={form.assessment_id} onChange={(e) => setForm((f) => ({ ...f, assessment_id: e.target.value }))}>
            <option value="">{t('form.noneAssessment')}</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </FormSelect>
          <FormTextarea
            id="ic-notes"
            label={t('form.evidenceNotes')}
            value={form.evidence_notes}
            onChange={(e) => setForm((f) => ({ ...f, evidence_notes: e.target.value }))}
            rows={3}
          />
          <FormTextarea id="ic-decision" label={t('form.decision')} value={form.decision} onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))} rows={2} />
          <FormSelect id="ic-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FormSelect>
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              <Save size={18} aria-hidden /> {t('create.submit')}
            </Button>
            <Link className="btn btn--outline" to={`${base}/integrity-cases`}>
              <X size={18} aria-hidden /> {t('create.cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

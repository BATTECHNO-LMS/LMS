import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useEnrollments } from '../../../features/enrollments/index.js';
import { useCreateRiskCase } from '../../../features/risks/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const RISK_TYPES = ['low_attendance', 'assessment_failure', 'missing_project', 'continuous_decline', 'other'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'escalated'];

export function RiskCaseCreatePage() {
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('riskCases');
  const { t: tCommon } = useTranslation('common');
  const createMut = useCreateRiskCase();
  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const [form, setForm] = useState({
    cohort_id: '',
    student_id: '',
    risk_type: 'low_attendance',
    risk_level: 'medium',
    action_plan: '',
    status: 'open',
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

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        cohort_id: form.cohort_id,
        student_id: form.student_id,
        risk_type: form.risk_type,
        risk_level: form.risk_level,
        status: form.status,
      };
      if (form.action_plan.trim()) body.action_plan = form.action_plan.trim();
      const res = await createMut.mutateAsync(body);
      const id = res?.risk_case?.id;
      if (id) navigate(`${base}/risk-cases/${id}`);
      else navigate(`${base}/risk-cases`);
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
          <FormSelect id="rk-cohort" label={t('form.cohort')} value={form.cohort_id} onChange={(e) => setForm((f) => ({ ...f, cohort_id: e.target.value, student_id: '' }))} required>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="rk-student" label={t('form.student')} value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} required>
            <option value="">{tCommon('emptyStates.noResultsTitle')}</option>
            {enrollments.map((en) => (
              <option key={en.id} value={en.student_id}>
                {en.student?.full_name ?? en.student_id}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="rk-type" label={t('form.riskType')} value={form.risk_type} onChange={(e) => setForm((f) => ({ ...f, risk_type: e.target.value }))} required>
            {RISK_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </FormSelect>
          <FormSelect id="rk-level" label={t('form.riskLevel')} value={form.risk_level} onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value }))} required>
            {RISK_LEVELS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </FormSelect>
          <FormTextarea id="rk-plan" label={t('form.actionPlan')} value={form.action_plan} onChange={(e) => setForm((f) => ({ ...f, action_plan: e.target.value }))} rows={3} />
          <FormSelect id="rk-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
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
            <Link className="btn btn--outline" to={`${base}/risk-cases`}>
              <X size={18} aria-hidden /> {t('create.cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

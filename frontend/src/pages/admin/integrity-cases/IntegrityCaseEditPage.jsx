import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAssessments } from '../../../features/assessments/index.js';
import { useIntegrityCase, useUpdateIntegrityCase } from '../../../features/integrity/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const STATUSES = ['reported', 'under_investigation', 'resolved', 'closed'];

export function IntegrityCaseEditPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('integrityCases');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useIntegrityCase(id, { staleTime: 30_000 });
  const row = data?.integrity_case;
  const updateMut = useUpdateIntegrityCase();

  const cohortId = row?.cohort_id;

  const { data: assPayload } = useAssessments(
    { cohort_id: cohortId || undefined },
    { enabled: Boolean(cohortId), staleTime: 30_000 }
  );
  const assessments = assPayload?.assessments ?? [];

  const [form, setForm] = useState({
    assessment_id: '',
    evidence_notes: '',
    decision: '',
    status: 'reported',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      assessment_id: row.assessment_id ?? '',
      evidence_notes: row.evidence_notes ?? '',
      decision: row.decision ?? '',
      status: row.status,
    });
  }, [row]);

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      await updateMut.mutateAsync({
        id,
        body: {
          assessment_id: form.assessment_id || null,
          evidence_notes: form.evidence_notes.trim() || null,
          decision: form.decision.trim() || null,
          status: form.status,
        },
      });
      navigate(`${base}/integrity-cases/${id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('edit.title')}</>} description={null} />
      <SectionCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p className="form-error">{String(error?.message ?? tCommon('errors.generic'))}</p>
        ) : row ? (
          <form className="form-grid" onSubmit={onSubmit}>
            {apiError ? <p className="form-error">{apiError}</p> : null}
            <p className="form-hint">
              {row.student?.full_name} · {row.cohort?.title} · {row.case_type}
            </p>
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
            <FormSelect id="ic-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FormSelect>
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={updateMut.isPending}>
                <Save size={18} aria-hidden /> {t('edit.submit')}
              </Button>
              <Link className="btn btn--outline" to={`${base}/integrity-cases/${id}`}>
                <X size={18} aria-hidden /> {t('create.cancel')}
              </Link>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}

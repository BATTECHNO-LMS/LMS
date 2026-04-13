import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useRiskCase, useUpdateRiskCase } from '../../../features/risks/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'escalated', 'resolved', 'closed'];

export function RiskCaseEditPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('riskCases');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useRiskCase(id, { staleTime: 30_000 });
  const row = data?.risk_case;
  const updateMut = useUpdateRiskCase();

  const [form, setForm] = useState({
    risk_level: 'medium',
    action_plan: '',
    status: 'open',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      risk_level: row.risk_level,
      action_plan: row.action_plan ?? '',
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
          risk_level: form.risk_level,
          action_plan: form.action_plan.trim() || null,
          status: form.status,
        },
      });
      navigate(`${base}/risk-cases/${id}`);
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
              {row.student?.full_name} · {row.cohort?.title} · {row.risk_type}
            </p>
            <FormSelect id="rk-level" label={t('form.riskLevel')} value={form.risk_level} onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value }))} required>
              {RISK_LEVELS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FormSelect>
            <FormTextarea id="rk-plan" label={t('form.actionPlan')} value={form.action_plan} onChange={(e) => setForm((f) => ({ ...f, action_plan: e.target.value }))} rows={3} />
            <FormSelect id="rk-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
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
              <Link className="btn btn--outline" to={`${base}/risk-cases/${id}`}>
                <X size={18} aria-hidden /> {t('create.cancel')}
              </Link>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}

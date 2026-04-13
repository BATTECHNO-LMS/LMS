import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea, FormDate } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useQaReview, useUpdateQaReview } from '../../../features/qa/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const REVIEW_TYPES = ['scheduled', 'periodic', 'pre_closure', 'special'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export function QAReviewEditPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('qaReviews');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useQaReview(id, {}, { staleTime: 30_000 });
  const row = data?.qa_review;
  const updateMut = useUpdateQaReview();

  const [form, setForm] = useState({
    review_date: '',
    review_type: 'scheduled',
    reviewer_id: '',
    findings: '',
    action_required: '',
    status: 'open',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      review_date: row.review_date ? String(row.review_date).slice(0, 10) : '',
      review_type: row.review_type,
      reviewer_id: row.reviewer_id ?? '',
      findings: row.findings ?? '',
      action_required: row.action_required ?? '',
      status: row.status,
    });
  }, [row]);

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        review_date: form.review_date,
        review_type: form.review_type,
        status: form.status,
      };
      if (form.reviewer_id.trim()) body.reviewer_id = form.reviewer_id.trim();
      else body.reviewer_id = null;
      body.findings = form.findings.trim() || null;
      body.action_required = form.action_required.trim() || null;
      await updateMut.mutateAsync({ id, body });
      navigate(`${base}/qa-reviews/${id}`);
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
            <FormDate id="qa-date" label={t('form.reviewDate')} value={form.review_date} onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))} required />
            <FormSelect id="qa-type" label={t('form.reviewType')} value={form.review_type} onChange={(e) => setForm((f) => ({ ...f, review_type: e.target.value }))} required>
              {REVIEW_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`types.${rt}`, { defaultValue: rt })}
                </option>
              ))}
            </FormSelect>
            <FormInput id="qa-reviewer" label={t('form.reviewer')} value={form.reviewer_id} onChange={(e) => setForm((f) => ({ ...f, reviewer_id: e.target.value }))} placeholder="UUID" />
            <FormTextarea id="qa-findings" label={t('form.findings')} value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} rows={3} />
            <FormTextarea
              id="qa-action"
              label={t('form.actionRequired')}
              value={form.action_required}
              onChange={(e) => setForm((f) => ({ ...f, action_required: e.target.value }))}
              rows={2}
            />
            <FormSelect id="qa-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
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
              <Link className="btn btn--outline" to={`${base}/qa-reviews/${id}`}>
                <X size={18} aria-hidden /> {t('create.cancel')}
              </Link>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}

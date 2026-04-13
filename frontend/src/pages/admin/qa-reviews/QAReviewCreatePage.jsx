import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea, FormDate } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useCreateQaReview } from '../../../features/qa/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const REVIEW_TYPES = ['scheduled', 'periodic', 'pre_closure', 'special'];

export function QAReviewCreatePage() {
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('qaReviews');
  const { t: tCommon } = useTranslation('common');
  const createMut = useCreateQaReview();
  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const [form, setForm] = useState({
    cohort_id: '',
    review_date: '',
    review_type: 'scheduled',
    reviewer_id: '',
    findings: '',
    action_required: '',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!cohorts.length || form.cohort_id) return;
    setForm((f) => ({ ...f, cohort_id: cohorts[0].id }));
  }, [cohorts, form.cohort_id]);

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        cohort_id: form.cohort_id,
        review_date: form.review_date,
        review_type: form.review_type,
      };
      if (form.reviewer_id.trim()) body.reviewer_id = form.reviewer_id.trim();
      if (form.findings.trim()) body.findings = form.findings.trim();
      if (form.action_required.trim()) body.action_required = form.action_required.trim();
      const res = await createMut.mutateAsync(body);
      const id = res?.qa_review?.id;
      if (id) navigate(`${base}/qa-reviews/${id}`);
      else navigate(`${base}/qa-reviews`);
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
          <FormSelect id="qa-cohort" label={t('form.cohort')} value={form.cohort_id} onChange={(e) => setForm((f) => ({ ...f, cohort_id: e.target.value }))} required>
            <option value="">{t('form.selectCohort')}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </FormSelect>
          <FormDate id="qa-date" label={t('form.reviewDate')} value={form.review_date} onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))} required />
          <FormSelect id="qa-type" label={t('form.reviewType')} value={form.review_type} onChange={(e) => setForm((f) => ({ ...f, review_type: e.target.value }))} required>
            {REVIEW_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {t(`types.${rt}`, { defaultValue: rt })}
              </option>
            ))}
          </FormSelect>
          <FormInput
            id="qa-reviewer"
            label={t('form.reviewer')}
            value={form.reviewer_id}
            onChange={(e) => setForm((f) => ({ ...f, reviewer_id: e.target.value }))}
            placeholder="UUID"
          />
          <FormTextarea id="qa-findings" label={t('form.findings')} value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} rows={3} />
          <FormTextarea
            id="qa-action"
            label={t('form.actionRequired')}
            value={form.action_required}
            onChange={(e) => setForm((f) => ({ ...f, action_required: e.target.value }))}
            rows={2}
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              <Save size={18} aria-hidden /> {t('create.submit')}
            </Button>
            <Link className="btn btn--outline" to={`${base}/qa-reviews`}>
              <X size={18} aria-hidden /> {t('create.cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

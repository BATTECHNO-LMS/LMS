import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea, FormDate } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { useQaReviews } from '../../../features/qa/index.js';
import { useCreateCorrectiveAction } from '../../../features/correctiveActions/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const STATUSES = ['open', 'in_progress', 'overdue'];

export function CorrectiveActionCreatePage() {
  const [searchParams] = useSearchParams();
  const presetQa = searchParams.get('qa_review_id') || '';
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');
  const createMut = useCreateCorrectiveAction();
  const { data: qaPayload } = useQaReviews({}, { staleTime: 30_000 });
  const qaRows = qaPayload?.qa_reviews ?? [];

  const [form, setForm] = useState({
    qa_review_id: presetQa,
    action_text: '',
    due_date: '',
    assigned_to: '',
    status: 'open',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (presetQa) setForm((f) => ({ ...f, qa_review_id: presetQa }));
  }, [presetQa]);

  useEffect(() => {
    if (form.qa_review_id || !qaRows.length) return;
    setForm((f) => ({ ...f, qa_review_id: qaRows[0].id }));
  }, [qaRows, form.qa_review_id]);

  const qaOptions = useMemo(
    () =>
      qaRows.map((r) => ({
        id: r.id,
        label: `${r.cohort?.title ?? r.cohort_id} · ${r.review_date ? String(r.review_date).slice(0, 10) : ''}`,
      })),
    [qaRows]
  );

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        qa_review_id: form.qa_review_id,
        action_text: form.action_text.trim(),
        due_date: form.due_date,
        status: form.status,
      };
      if (form.assigned_to.trim()) body.assigned_to = form.assigned_to.trim();
      const res = await createMut.mutateAsync(body);
      const id = res?.corrective_action?.id;
      if (id) navigate(`${base}/corrective-actions/${id}`);
      else navigate(`${base}/corrective-actions`);
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
          <FormSelect
            id="ca-qa"
            label={t('form.qaReview')}
            value={form.qa_review_id}
            onChange={(e) => setForm((f) => ({ ...f, qa_review_id: e.target.value }))}
            required
          >
            {qaOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <FormTextarea
            id="ca-text"
            label={t('form.actionText')}
            value={form.action_text}
            onChange={(e) => setForm((f) => ({ ...f, action_text: e.target.value }))}
            rows={4}
            required
          />
          <FormDate id="ca-due" label={t('form.dueDate')} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required />
          <FormInput
            id="ca-assign"
            label={t('form.assignee')}
            value={form.assigned_to}
            onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
            placeholder="UUID"
          />
          <FormSelect id="ca-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
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
            <Link className="btn btn--outline" to={`${base}/corrective-actions`}>
              <X size={18} aria-hidden /> {t('create.cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

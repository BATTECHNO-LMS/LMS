import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea, FormDate } from '../../../components/forms/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useCorrectiveAction, useUpdateCorrectiveAction } from '../../../features/correctiveActions/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const STATUSES = ['open', 'in_progress', 'overdue', 'resolved', 'closed'];

export function CorrectiveActionEditPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const navigate = useNavigate();
  const { t } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useCorrectiveAction(id, { staleTime: 30_000 });
  const row = data?.corrective_action;
  const updateMut = useUpdateCorrectiveAction();

  const [form, setForm] = useState({
    action_text: '',
    due_date: '',
    assigned_to: '',
    status: 'open',
  });
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      action_text: row.action_text ?? '',
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : '',
      assigned_to: row.assigned_to ?? '',
      status: row.status,
    });
  }, [row]);

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    try {
      const body = {
        action_text: form.action_text.trim(),
        due_date: form.due_date,
        status: form.status,
        assigned_to: form.assigned_to.trim() || null,
      };
      await updateMut.mutateAsync({ id, body });
      navigate(`${base}/corrective-actions/${id}`);
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
              {t('form.qaReview')}: {row.qa_review?.cohort?.title ?? row.qa_review_id}
            </p>
            <FormTextarea
              id="ca-text"
              label={t('form.actionText')}
              value={form.action_text}
              onChange={(e) => setForm((f) => ({ ...f, action_text: e.target.value }))}
              rows={4}
              required
            />
            <FormDate id="ca-due" label={t('form.dueDate')} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required />
            <FormInput id="ca-assign" label={t('form.assignee')} value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} />
            <FormSelect id="ca-status" label={t('form.status')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} required>
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
              <Link className="btn btn--outline" to={`${base}/corrective-actions/${id}`}>
                <X size={18} aria-hidden /> {t('create.cancel')}
              </Link>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}

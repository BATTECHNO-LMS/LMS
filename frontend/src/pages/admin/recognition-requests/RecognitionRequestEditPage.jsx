import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { useRecognitionRequest } from '../../../features/recognition/hooks/useRecognitionRequest.js';
import { useUpdateRecognitionRequest } from '../../../features/recognition/hooks/useUpdateRecognitionRequest.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function RecognitionRequestEditPage() {
  const { t } = useTranslation('recognition');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useRecognitionRequest(id, { staleTime: 30_000 });
  const updateMutation = useUpdateRecognitionRequest();
  const [decisionNotes, setDecisionNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const row = data?.recognition_request;
    if (row) setDecisionNotes(row.decision_notes ?? '');
  }, [data]);

  function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!id) return;
    updateMutation.mutate(
      { id, body: { decision_notes: decisionNotes || null } },
      {
        onSuccess: () => navigate(`/admin/recognition-requests/${id}`),
        onError: (err) => setFormError(getApiErrorMessage(err, tCommon('errors.generic'))),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <p className="crud-muted">{tCommon('loading')}</p>
      </div>
    );
  }

  if (isError || !data?.recognition_request) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.generic')} description={getApiErrorMessage(error, '')} />
        <Link className="btn btn--primary" to="/admin/recognition-requests">
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('edit.title')} description={t('list.description')} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={t('view.title')}
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/recognition-requests/${id}`}>
                <X size={18} aria-hidden /> {t('form.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={updateMutation.isPending}>
                <Save size={18} aria-hidden /> {t('form.update')}
              </button>
            </>
          }
        >
          {formError ? (
            <p className="crud-muted" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="crud-form-grid">
            <div className="form-field">
              <label className="form-field__label" htmlFor="decision_notes">
                {t('form.decisionNotes')}
              </label>
              <textarea
                id="decision_notes"
                className="form-field__control"
                rows={6}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

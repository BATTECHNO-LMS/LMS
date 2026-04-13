import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { createRubric } from '../../../features/rubrics/rubrics.service.js';
import { rubricsKeys } from '../../../features/rubrics/hooks/useRubrics.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function RubricCreatePage() {
  const { t } = useTranslation('rubrics');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [apiError, setApiError] = useState('');

  const mut = useMutation({
    mutationFn: () => createRubric({ title, description: description || null, status }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: rubricsKeys.all });
      navigate(`/admin/rubrics/${data.id}`);
    },
  });

  function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    if (!title.trim()) {
      setApiError(tCommon('errors.generic'));
      return;
    }
    mut.mutate(undefined, {
      onError: (err) => setApiError(getApiErrorMessage(err, tCommon('errors.generic'))),
    });
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create.title')}</>} description={<>{t('create.description')}</>} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/rubrics">
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={mut.isPending}>
                <Save size={18} aria-hidden /> {tCommon('actions.save')}
              </button>
            </>
          }
        >
          {apiError ? <p className="form-error">{apiError}</p> : null}
          <div className="crud-form-grid">
            <FormInput id="rubric-title" label={t('table.title')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <FormSelect id="rubric-status" label={t('table.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </FormSelect>
            <FormTextarea id="rubric-desc" label={t('create.descriptionField')} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

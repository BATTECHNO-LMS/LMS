import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormNumber } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useRubric } from '../../../features/rubrics/index.js';
import { createRubricCriterion, deleteRubricCriterion } from '../../../features/rubrics/rubrics.service.js';
import { rubricsKeys } from '../../../features/rubrics/hooks/useRubrics.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function RubricDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation('rubrics');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const { data, isLoading, isError } = useRubric(id);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('10');
  const [apiError, setApiError] = useState('');

  const addMut = useMutation({
    mutationFn: () => createRubricCriterion(id, { criterion_name: name.trim(), weight: Number(weight) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rubricsKeys.detail(id) });
      setName('');
      setWeight('10');
    },
  });

  const delMut = useMutation({
    mutationFn: (cid) => deleteRubricCriterion(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: rubricsKeys.detail(id) }),
  });

  function onAdd(e) {
    e.preventDefault();
    setApiError('');
    if (!name.trim()) return;
    addMut.mutate(undefined, {
      onError: (err) => setApiError(getApiErrorMessage(err, tCommon('errors.generic'))),
    });
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={t('detail.notFound')} description="" />
        <Link className="btn btn--primary" to="/admin/rubrics">
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  const criteria = data.criteria ?? [];

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{data.title}</>} description={<>{t('detail.title')}</>} />
      <SectionCard title={tCommon('actions.details')}>
        <p>
          {t('detail.weightSum')}: {data.criteria_weight_sum ?? 0}% —{' '}
          {data.criteria_weights_valid ? t('detail.valid') : t('detail.invalid')}
        </p>
        <Link className="btn btn--outline" to="/admin/rubrics">
          {tCommon('actions.backToList')}
        </Link>
      </SectionCard>

      <SectionCard title={t('detail.addCriterion')}>
        {apiError ? <p className="form-error">{apiError}</p> : null}
        <form className="crud-form-grid" style={{ maxWidth: 560 }} onSubmit={onAdd}>
          <FormInput id="c-name" label={t('detail.criterionName')} value={name} onChange={(e) => setName(e.target.value)} />
          <FormNumber id="c-weight" label={t('detail.weight')} value={weight} onChange={(e) => setWeight(e.target.value)} min={0} max={100} />
          <div style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn--primary" disabled={addMut.isPending}>
              {t('detail.addCriterion')}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title={t('detail.criteriaList')}>
        <DataTable
          emptyTitle={tCommon('emptyStates.noResultsTitle')}
          emptyDescription=""
          columns={[
            { key: 'criterion_name', label: t('detail.criterionName') },
            { key: 'weight', label: t('detail.weight'), render: (r) => `${r.weight}%` },
            {
              key: 'actions',
              label: t('table.actions'),
              render: (r) => (
                <button type="button" className="btn btn--outline" disabled={delMut.isPending} onClick={() => delMut.mutate(r.id)}>
                  {t('detail.delete')}
                </button>
              ),
            },
          ]}
          rows={criteria}
        />
      </SectionCard>
    </div>
  );
}

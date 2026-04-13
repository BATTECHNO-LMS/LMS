import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput } from '../../../components/forms/index.js';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { learningOutcomeSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  useLearningOutcomes,
  useCreateLearningOutcome,
  useUpdateLearningOutcome,
  useDeleteLearningOutcome,
} from '../index.js';

/**
 * @param {{ microCredentialId: string, readOnly?: boolean }} props
 */
export function LearningOutcomesPanel({ microCredentialId, readOnly = false }) {
  const { t } = useTranslation('learningOutcomes');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useLearningOutcomes(microCredentialId);
  const createLo = useCreateLearningOutcome();
  const updateLo = useUpdateLearningOutcome();
  const deleteLo = useDeleteLearningOutcome();

  const rows = useMemo(() => data?.learning_outcomes ?? [], [data]);

  const [form, setForm] = useState({ outcome_code: '', outcome_text: '', outcome_type: '' });
  const [formErrors, setFormErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [msg, setMsg] = useState('');

  function resetForm() {
    setForm({ outcome_code: '', outcome_text: '', outcome_type: '' });
    setFormErrors({});
    setMsg('');
  }

  async function onCreate(e) {
    e.preventDefault();
    setMsg('');
    const res = safeParse(learningOutcomeSchema, form);
    if (!res.ok) {
      setFormErrors(res.errors);
      return;
    }
    try {
      await createLo.mutateAsync({
        microCredentialId,
        body: {
          outcome_code: res.data.outcome_code,
          outcome_text: res.data.outcome_text,
          outcome_type: res.data.outcome_type || undefined,
        },
      });
      resetForm();
    } catch (err) {
      setMsg(getApiErrorMessage(err, t('errors.save')));
    }
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editId || !editForm) return;
    setMsg('');
    const res = safeParse(learningOutcomeSchema, editForm);
    if (!res.ok) {
      setFormErrors(res.errors);
      return;
    }
    try {
      await updateLo.mutateAsync({
        id: editId,
        microCredentialId,
        body: {
          outcome_code: res.data.outcome_code,
          outcome_text: res.data.outcome_text,
          outcome_type: res.data.outcome_type || null,
        },
      });
      setEditId(null);
      setEditForm(null);
      setFormErrors({});
    } catch (err) {
      setMsg(getApiErrorMessage(err, t('errors.save')));
    }
  }

  async function onDelete(id) {
    if (!window.confirm(t('confirmDelete'))) return;
    setMsg('');
    try {
      await deleteLo.mutateAsync({ id, microCredentialId });
    } catch (err) {
      setMsg(getApiErrorMessage(err, t('errors.delete')));
    }
  }

  if (isLoading) {
    return (
      <SectionCard title={t('panelTitle')}>
        <LoadingSpinner />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('panelTitle')}>
      {isError ? (
        <p className="auth-form__error" role="alert">
          {getApiErrorMessage(error, tCommon('errors.generic'))}
        </p>
      ) : null}
      {msg ? (
        <p className="auth-form__error" role="alert">
          {msg}
        </p>
      ) : null}

      <DataTable
        emptyTitle={t('empty.title')}
        emptyDescription={t('empty.description')}
        columns={[
          { key: 'outcome_code', label: t('table.code') },
          { key: 'outcome_text', label: t('table.text') },
          { key: 'outcome_type', label: t('table.type') },
          ...(readOnly
            ? []
            : [
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: (r) => (
                    <div className="table-actions">
                      <button type="button" className="btn btn--outline" onClick={() => {
                        setEditId(r.id);
                        setEditForm({
                          outcome_code: r.outcome_code,
                          outcome_text: r.outcome_text,
                          outcome_type: r.outcome_type ?? '',
                        });
                        setFormErrors({});
                        setMsg('');
                      }}>
                        {tCommon('actions.edit')}
                      </button>
                      <button type="button" className="btn btn--outline" onClick={() => onDelete(r.id)}>
                        {tCommon('actions.delete')}
                      </button>
                    </div>
                  ),
                },
              ]),
        ]}
        rows={rows}
      />

      {!readOnly && editId && editForm ? (
        <form className="crud-form-grid" style={{ marginTop: '1rem' }} onSubmit={onSaveEdit}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('editOutcome')}</h3>
          <FormInput
            id="lo-edit-code"
            label={t('table.code')}
            value={editForm.outcome_code}
            onChange={(e) => setEditForm((f) => ({ ...f, outcome_code: e.target.value }))}
            error={formErrors.outcome_code}
          />
          <FormInput
            id="lo-edit-text"
            label={t('table.text')}
            value={editForm.outcome_text}
            onChange={(e) => setEditForm((f) => ({ ...f, outcome_text: e.target.value }))}
            error={formErrors.outcome_text}
          />
          <FormInput
            id="lo-edit-type"
            label={t('table.type')}
            value={editForm.outcome_type}
            onChange={(e) => setEditForm((f) => ({ ...f, outcome_type: e.target.value }))}
            error={formErrors.outcome_type}
          />
          <div className="crud-view-actions">
            <button type="button" className="btn btn--outline" onClick={() => { setEditId(null); setEditForm(null); }}>
              {tCommon('actions.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={updateLo.isPending}>
              {tCommon('actions.save')}
            </button>
          </div>
        </form>
      ) : null}

      {!readOnly ? (
        <form className="crud-form-grid" style={{ marginTop: '1.25rem' }} onSubmit={onCreate}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('addOutcome')}</h3>
          <FormInput
            id="lo-code"
            label={t('table.code')}
            value={form.outcome_code}
            onChange={(e) => setForm((f) => ({ ...f, outcome_code: e.target.value }))}
            error={formErrors.outcome_code}
          />
          <FormInput
            id="lo-text"
            label={t('table.text')}
            value={form.outcome_text}
            onChange={(e) => setForm((f) => ({ ...f, outcome_text: e.target.value }))}
            error={formErrors.outcome_text}
          />
          <FormInput
            id="lo-type"
            label={t('table.type')}
            value={form.outcome_type}
            onChange={(e) => setForm((f) => ({ ...f, outcome_type: e.target.value }))}
            error={formErrors.outcome_type}
          />
          <button type="submit" className="btn btn--primary" disabled={createLo.isPending}>
            {t('addOutcome')}
          </button>
        </form>
      ) : null}
    </SectionCard>
  );
}

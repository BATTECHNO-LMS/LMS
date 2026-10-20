import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  assignExternalSupervisor,
  fetchExternalSupervisors,
  revokeExternalSupervisor,
} from '../../../../../../features/fieldTraining/fieldTraining.service.js';
import { LoadingSpinner } from '../../../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../../../../../services/apiHelpers.js';

export function ManageExternalSupervisorsTab({ opportunityId, asInstructor = false }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [form, setForm] = useState({
    supervisor_user_id: '',
    application_id: '',
    organization_label: '',
  });

  const list = useQuery({
    queryKey: ['ft-ext-sup', opportunityId, asInstructor],
    queryFn: () => fetchExternalSupervisors(opportunityId, { asInstructor }),
    enabled: Boolean(opportunityId),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      assignExternalSupervisor(
        opportunityId,
        {
          supervisor_user_id: form.supervisor_user_id,
          application_id: form.application_id || null,
          organization_label: form.organization_label || null,
        },
        { asInstructor }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ft-ext-sup', opportunityId] });
      setForm({ supervisor_user_id: '', application_id: '', organization_label: '' });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (assignmentId) => revokeExternalSupervisor(assignmentId, { asInstructor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ft-ext-sup', opportunityId] }),
  });

  if (list.isLoading) return <LoadingSpinner />;
  if (list.isError) {
    return (
      <EmptyState
        title={t('externalSupervisors.loadError')}
        description={getApiErrorMessage(list.error, t('loadError'))}
      />
    );
  }

  const items = list.data?.items || [];

  return (
    <div className="ft-ext-sup">
      <header>
        <h2>{t('externalSupervisors.title')}</h2>
        <p>{t('externalSupervisors.lead')}</p>
      </header>

      <form
        className="ft-ext-sup__form"
        onSubmit={(e) => {
          e.preventDefault();
          assignMut.mutate();
        }}
      >
        <input
          required
          placeholder={t('externalSupervisors.supervisorUserId')}
          value={form.supervisor_user_id}
          onChange={(e) => setForm((f) => ({ ...f, supervisor_user_id: e.target.value }))}
        />
        <input
          placeholder={t('externalSupervisors.applicationIdOptional')}
          value={form.application_id}
          onChange={(e) => setForm((f) => ({ ...f, application_id: e.target.value }))}
        />
        <input
          placeholder={t('externalSupervisors.organization')}
          value={form.organization_label}
          onChange={(e) => setForm((f) => ({ ...f, organization_label: e.target.value }))}
        />
        <button type="submit" className="ft-btn ft-btn--primary" disabled={assignMut.isPending}>
          {t('externalSupervisors.assign')}
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState title={t('externalSupervisors.empty')} />
      ) : (
        <ul className="ft-ext-sup__list">
          {items.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.supervisor_name || a.supervisor_user_id}</strong>
                <span>{a.supervisor_email}</span>
                <span>{a.organization_label || '—'}</span>
                <span>{a.is_active ? t('externalSupervisors.active') : t('externalSupervisors.revoked')}</span>
              </div>
              {a.is_active ? (
                <button
                  type="button"
                  className="ft-btn ft-btn--ghost"
                  onClick={() => revokeMut.mutate(a.id)}
                >
                  {t('externalSupervisors.revoke')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

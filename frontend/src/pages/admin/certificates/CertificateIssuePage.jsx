import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput } from '../../../components/forms/index.js';
import { useCreateCertificate } from '../../../features/certificates/hooks/useCreateCertificate.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function CertificateIssuePage() {
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const create = useCreateCertificate();
  const [form, setForm] = useState({ student_id: '', cohort_id: '', micro_credential_id: '' });
  const [err, setErr] = useState('');

  function onSubmit(e) {
    e.preventDefault();
    setErr('');
    create.mutate(form, {
      onSuccess: (payload) => {
        const id = payload?.certificate?.id;
        navigate(id ? `/admin/certificates/${id}` : '/admin/certificates');
      },
      onError: (er) => setErr(getApiErrorMessage(er, t('issue.error'))),
    });
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('issue.title')} description={t('list.description')} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={t('issue.title')}
          actions={
            <Link className="btn btn--outline" to="/admin/certificates">
              {t('issue.cancel')}
            </Link>
          }
        >
          {err ? (
            <p className="crud-muted" role="alert">
              {err}
            </p>
          ) : null}
          <div className="crud-form-grid">
            <FormInput
              id="student_id"
              label={t('issue.studentId')}
              value={form.student_id}
              onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
            />
            <FormInput
              id="cohort_id"
              label={t('issue.cohortId')}
              value={form.cohort_id}
              onChange={(e) => setForm((f) => ({ ...f, cohort_id: e.target.value }))}
            />
            <FormInput
              id="micro_credential_id"
              label={t('issue.microCredentialId')}
              value={form.micro_credential_id}
              onChange={(e) => setForm((f) => ({ ...f, micro_credential_id: e.target.value }))}
            />
          </div>
          <div className="crud-view-actions">
            <button type="submit" className="btn btn--primary" disabled={create.isPending}>
              {t('issue.submit')}
            </button>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

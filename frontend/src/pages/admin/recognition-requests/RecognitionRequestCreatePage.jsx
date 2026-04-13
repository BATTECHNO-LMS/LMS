import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useUniversities } from '../../../features/universities/hooks/useUniversities.js';
import { useCohorts } from '../../../features/cohorts/hooks/useCohorts.js';
import { useCreateRecognitionRequest } from '../../../features/recognition/hooks/useCreateRecognitionRequest.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const CREATE_STATUSES = ['draft', 'in_preparation'];

export function RecognitionRequestCreatePage() {
  const { t } = useTranslation('recognition');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGlobal = Boolean(user?.isGlobal);
  const [universityId, setUniversityId] = useState(() => (isGlobal ? '' : user?.tenantId) || '');
  const [cohortId, setCohortId] = useState('');
  const [status, setStatus] = useState('draft');
  const [formError, setFormError] = useState('');

  const { data: uniPayload } = useUniversities({ enabled: Boolean(user) && isGlobal });
  const universities = uniPayload?.universities ?? [];

  const { data: cohortsPayload, isLoading: cohortsLoading } = useCohorts(
    { university_id: universityId || undefined },
    { enabled: Boolean(universityId), staleTime: 30_000 }
  );
  const cohorts = cohortsPayload?.cohorts ?? [];

  const selectedCohort = useMemo(() => cohorts.find((c) => c.id === cohortId), [cohorts, cohortId]);

  useEffect(() => {
    if (!isGlobal && user?.tenantId) setUniversityId(String(user.tenantId));
  }, [isGlobal, user?.tenantId]);

  const createMutation = useCreateRecognitionRequest();

  function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!selectedCohort) {
      setFormError(t('form.selectCohortHint'));
      return;
    }
    createMutation.mutate(
      {
        university_id: selectedCohort.university_id,
        micro_credential_id: selectedCohort.micro_credential_id,
        cohort_id: selectedCohort.id,
        status,
      },
      {
        onSuccess: (payload) => {
          const id = payload?.recognition_request?.id;
          navigate(id ? `/admin/recognition-requests/${id}` : '/admin/recognition-requests');
        },
        onError: (err) => setFormError(getApiErrorMessage(err, t('form.createError'))),
      }
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('create.title')} description={t('list.description')} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={t('view.title')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/recognition-requests">
                <X size={18} aria-hidden /> {t('form.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
                <Save size={18} aria-hidden /> {t('form.save')}
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
            {isGlobal ? (
              <FormSelect
                id="universityId"
                label={t('form.university')}
                value={universityId}
                onChange={(e) => {
                  setUniversityId(e.target.value);
                  setCohortId('');
                }}
              >
                <option value="">{t('form.selectUniversity')}</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </FormSelect>
            ) : null}
            <FormSelect
              id="cohortId"
              label={t('form.cohort')}
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              disabled={!universityId || cohortsLoading}
            >
              <option value="">{cohortsLoading ? tCommon('loading') : t('form.selectCohortPlaceholder')}</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.micro_credential?.title ? `— ${c.micro_credential.title}` : ''}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="status" label={t('form.initialStatus')} value={status} onChange={(e) => setStatus(e.target.value)}>
              {CREATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormDate } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useMicroCredentials } from '../../../features/microCredentials/index.js';
import { useUniversities } from '../../../features/universities/index.js';
import { useUsers } from '../../../features/users/index.js';
import { useCohort, useUpdateCohort } from '../../../features/cohorts/index.js';
import { cohortSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function CohortEditPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('cohorts');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCohort(id);
  const updateMut = useUpdateCohort();

  const { data: mcData } = useMicroCredentials({}, { staleTime: 60_000 });
  const micros = mcData?.micro_credentials ?? [];
  const { data: uniData } = useUniversities();
  const unis = uniData?.universities ?? [];

  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const userParams = useMemo(() => {
    const p = { page: 1, page_size: 100 };
    if (form?.university_id) p.university_id = form.university_id;
    return p;
  }, [form?.university_id]);

  const { data: usersPayload } = useUsers(userParams, { staleTime: 30_000, enabled: Boolean(form?.university_id) });
  const instructors = useMemo(() => {
    const items = usersPayload?.items ?? [];
    return items.filter((u) => Array.isArray(u.roles) && u.roles.map((r) => String(r).toLowerCase()).includes(ROLES.INSTRUCTOR));
  }, [usersPayload]);

  useEffect(() => {
    if (!data) return;
    setForm({
      title: data.title ?? '',
      micro_credential_id: data.micro_credential?.id ?? '',
      university_id: data.university?.id ?? '',
      instructor_id: data.instructor?.id ?? '',
      capacity: data.capacity ?? 1,
      start_date: data.start_date ?? '',
      end_date: data.end_date ?? '',
      status: data.status ?? 'planned',
    });
  }, [data]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form) return;
    setApiError('');
    const res = safeParse(cohortSchema, {
      ...form,
      instructor_id: form.instructor_id || undefined,
      capacity: form.capacity === '' ? undefined : form.capacity,
    });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      await updateMut.mutateAsync({ id, body: res.data });
      navigate(`${base}/cohorts/${id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading || !form) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.notFound')} description="" />
        <Link className="btn btn--primary" to={`${base}/cohorts`}>
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('edit.title')}</>} description={<>{t('description')}</>} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`${base}/cohorts/${id}`}>
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={updateMut.isPending}>
                <Save size={18} aria-hidden /> {tCommon('actions.update')}
              </button>
            </>
          }
        >
          {apiError ? <p className="form-error" role="alert">{apiError}</p> : null}
          <div className="crud-form-grid">
            <FormInput
              id="title"
              label={t('form.title')}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              error={errors.title}
            />
            <FormSelect
              id="micro_credential_id"
              label={t('table.certificate')}
              value={form.micro_credential_id}
              onChange={(e) => setField('micro_credential_id', e.target.value)}
              error={errors.micro_credential_id}
            >
              {micros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="university_id"
              label={t('form.university')}
              value={form.university_id}
              onChange={(e) => setField('university_id', e.target.value)}
              error={errors.university_id}
            >
              {unis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="instructor_id"
              label={t('form.instructor')}
              value={form.instructor_id}
              onChange={(e) => setField('instructor_id', e.target.value)}
              error={errors.instructor_id}
            >
              <option value="">—</option>
              {instructors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="capacity"
              type="number"
              min={1}
              label={t('form.capacity')}
              value={String(form.capacity)}
              onChange={(e) => setField('capacity', e.target.value === '' ? '' : Number(e.target.value))}
              error={errors.capacity}
            />
            <FormDate
              id="start_date"
              label={t('table.startDate')}
              value={form.start_date}
              onChange={(e) => setField('start_date', e.target.value)}
              error={errors.start_date}
            />
            <FormDate
              id="end_date"
              label={t('table.endDate')}
              value={form.end_date}
              onChange={(e) => setField('end_date', e.target.value)}
              error={errors.end_date}
            />
            <FormSelect
              id="status"
              label={tCommon('status.label')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="planned">{t('status.planned')}</option>
              <option value="open_for_enrollment">{t('status.open_for_enrollment')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="closed">{t('status.closed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

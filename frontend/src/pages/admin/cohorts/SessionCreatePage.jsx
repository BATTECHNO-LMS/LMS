import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { useCreateSession } from '../../../features/sessions/index.js';
import { sessionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

const SESSION_TYPES = ['lecture', 'lab', 'workshop', 'review', 'assessment', 'other'];

export function SessionCreatePage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('sessions');
  const { t: tCommon } = useTranslation('common');
  const { id: cohortId } = useParams();
  const navigate = useNavigate();
  const createMut = useCreateSession();

  const [form, setForm] = useState({
    title: '',
    session_date: '',
    start_time: '09:00',
    end_time: '10:00',
    session_type: 'lecture',
    module_id: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    const body = {
      ...form,
      module_id: form.module_id || undefined,
      notes: form.notes || undefined,
    };
    const res = safeParse(sessionSchema, body);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      await createMut.mutateAsync({ cohortId, body: res.data });
      navigate(`${base}/cohorts/${cohortId}/sessions`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create')}</>} description="" />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`${base}/cohorts/${cohortId}/sessions`}>
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={createMut.isPending}>
                <Save size={18} aria-hidden /> {tCommon('actions.save')}
              </button>
            </>
          }
        >
          {apiError ? <p className="form-error">{apiError}</p> : null}
          <div className="crud-form-grid">
            <FormInput id="title" label={t('sessionTitle')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} />
            <FormInput
              id="session_date"
              type="date"
              label={t('sessionDate')}
              value={form.session_date}
              onChange={(e) => setField('session_date', e.target.value)}
              error={errors.session_date}
            />
            <FormInput
              id="start_time"
              type="time"
              label={t('startTime')}
              value={form.start_time}
              onChange={(e) => setField('start_time', e.target.value)}
              error={errors.start_time}
            />
            <FormInput
              id="end_time"
              type="time"
              label={t('endTime')}
              value={form.end_time}
              onChange={(e) => setField('end_time', e.target.value)}
              error={errors.end_time}
            />
            <FormSelect id="session_type" label={t('sessionType')} value={form.session_type} onChange={(e) => setField('session_type', e.target.value)}>
              {SESSION_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </FormSelect>
            <FormInput id="notes" label={t('notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} error={errors.notes} />
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

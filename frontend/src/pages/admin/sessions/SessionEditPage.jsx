import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useSession, useUpdateSession, useUpdateSessionDocumentationStatus } from '../../../features/sessions/index.js';
import { sessionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

const SESSION_TYPES = ['lecture', 'lab', 'workshop', 'review', 'assessment', 'other'];
const DOC_STATUSES = ['pending', 'documented', 'incomplete'];

export function SessionEditPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('sessions');
  const { t: tCommon } = useTranslation('common');
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSession(sessionId);
  const updateMut = useUpdateSession();
  const docMut = useUpdateSessionDocumentationStatus();

  const [form, setForm] = useState(null);
  const [docStatus, setDocStatus] = useState('pending');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm({
      title: data.title ?? '',
      session_date: data.session_date ?? '',
      start_time: (data.start_time || '').slice(0, 5),
      end_time: (data.end_time || '').slice(0, 5),
      session_type: data.session_type ?? 'lecture',
      module_id: data.module_id ?? '',
      notes: data.notes ?? '',
    });
    setDocStatus(data.documentation_status ?? 'pending');
  }, [data]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form) return;
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
      await updateMut.mutateAsync({ id: sessionId, body: res.data });
      navigate(`${base}/sessions/${sessionId}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function applyDoc() {
    setApiError('');
    try {
      await docMut.mutateAsync({ id: sessionId, body: { documentation_status: docStatus } });
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
          {tCommon('actions.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('edit')}</>} description={data.title} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`${base}/sessions/${sessionId}`}>
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={updateMut.isPending}>
                <Save size={18} aria-hidden /> {tCommon('actions.update')}
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

      <SectionCard title={t('documentation')}>
        <div className="crud-form-grid" style={{ maxWidth: 480 }}>
          <FormSelect id="doc-status" value={docStatus} onChange={(e) => setDocStatus(e.target.value)}>
            {DOC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FormSelect>
          <div style={{ alignSelf: 'end' }}>
            <button type="button" className="btn btn--primary" disabled={docMut.isPending} onClick={applyDoc}>
              {tCommon('actions.update')}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

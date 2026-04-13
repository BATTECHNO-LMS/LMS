import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormTextarea } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { microCredentialSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useTracks } from '../../../features/tracks/index.js';
import { useUniversities } from '../../../features/universities/index.js';
import { useMicroCredential, useUpdateMicroCredential } from '../../../features/microCredentials/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { LearningOutcomesPanel } from '../../../features/learningOutcomes/components/LearningOutcomesPanel.jsx';

export function MicroCredentialEditPage() {
  const { t } = useTranslation('microCredentials');
  const { t: tCommon } = useTranslation('common');
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: row, isLoading, isError } = useMicroCredential(id);
  const { data: tracksPayload } = useTracks({}, { staleTime: 60_000 });
  const tracks = tracksPayload?.tracks ?? [];
  const { data: uniPayload } = useUniversities();
  const universities = uniPayload?.universities ?? [];
  const updateMutation = useUpdateMicroCredential();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!row) return;
    setForm({
      title: row.title ?? '',
      code: row.code ?? '',
      track_id: row.track_id ?? '',
      level: row.level ?? '',
      duration_hours: row.duration_hours != null ? String(row.duration_hours) : '',
      delivery_mode: row.delivery_mode ?? 'online',
      description: row.description ?? '',
      prerequisites: row.prerequisites ?? '',
      passing_policy: row.passing_policy ?? '',
      attendance_policy: row.attendance_policy ?? '',
      internal_approval_status: row.internal_approval_status ?? 'not_started',
      status: row.status ?? 'draft',
      university_ids: Array.isArray(row.linked_university_ids) ? [...row.linked_university_ids] : [],
    });
  }, [row]);

  function setField(key, value) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function toggleUniversity(uid) {
    setForm((f) => {
      if (!f) return f;
      const set = new Set(f.university_ids);
      if (set.has(uid)) set.delete(uid);
      else set.add(uid);
      return { ...f, university_ids: [...set] };
    });
  }

  const trackIdValid = useMemo(
    () => Boolean(form?.track_id && tracks.some((tr) => tr.id === form.track_id)),
    [form?.track_id, tracks]
  );

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      duration_hours: form.duration_hours === '' ? undefined : form.duration_hours,
    };
    const res = safeParse(microCredentialSchema, payload);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id,
        body: {
          title: res.data.title,
          code: res.data.code,
          track_id: res.data.track_id,
          level: res.data.level,
          duration_hours: res.data.duration_hours,
          delivery_mode: res.data.delivery_mode,
          description: res.data.description?.trim() || null,
          prerequisites: res.data.prerequisites?.trim() || null,
          passing_policy: res.data.passing_policy?.trim() || null,
          attendance_policy: res.data.attendance_policy?.trim() || null,
          internal_approval_status: res.data.internal_approval_status,
          status: res.data.status,
          university_ids: res.data.university_ids ?? [],
        },
      });
      navigate(`/admin/micro-credentials/${id}`);
    } catch (err) {
      setErrors({ _form: getApiErrorMessage(err, isArabic ? 'تعذّر التحديث.' : 'Could not update micro-credential.') });
    }
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={<>{tCommon('errors.generic')}</>} description={<>{t('empty.noRecords')}</>} />
        <Link className="btn btn--primary" to="/admin/micro-credentials">
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
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
              <Link className="btn btn--outline" to={`/admin/micro-credentials/${id}`}>
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={updateMutation.isPending || !trackIdValid}>
                <Save size={18} aria-hidden /> {tCommon('actions.update')}
              </button>
            </>
          }
        >
          {errors._form ? <p className="auth-form__error">{errors._form}</p> : null}
          <div className="crud-form-grid">
            <FormInput id="title" label={t('table.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} />
            <FormInput id="code" label={t('table.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} />
            <FormSelect id="track_id" label={t('table.track')} value={form.track_id} onChange={(e) => setField('track_id', e.target.value)} error={errors.track_id}>
              {tracks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </FormSelect>
            <FormInput id="level" label={t('table.level')} value={form.level} onChange={(e) => setField('level', e.target.value)} error={errors.level} />
            <FormNumber
              id="duration_hours"
              label={t('table.hours')}
              value={form.duration_hours}
              onChange={(e) => setField('duration_hours', e.target.value)}
              error={errors.duration_hours}
              min={0.01}
              step={0.5}
            />
            <FormSelect id="delivery_mode" label={t('fields.deliveryMode')} value={form.delivery_mode} onChange={(e) => setField('delivery_mode', e.target.value)} error={errors.delivery_mode}>
              <option value="online">online</option>
              <option value="onsite">onsite</option>
              <option value="hybrid">hybrid</option>
              <option value="self_paced">self_paced</option>
            </FormSelect>
            <FormTextarea id="description" label={t('fields.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} error={errors.description} rows={3} />
            <FormTextarea id="prerequisites" label={t('fields.prerequisites')} value={form.prerequisites} onChange={(e) => setField('prerequisites', e.target.value)} error={errors.prerequisites} rows={2} />
            <FormTextarea id="passing_policy" label={t('fields.passingPolicy')} value={form.passing_policy} onChange={(e) => setField('passing_policy', e.target.value)} error={errors.passing_policy} rows={2} />
            <FormTextarea id="attendance_policy" label={t('fields.attendancePolicy')} value={form.attendance_policy} onChange={(e) => setField('attendance_policy', e.target.value)} error={errors.attendance_policy} rows={2} />
            <FormSelect
              id="internal_approval_status"
              label={t('table.internalApproval')}
              value={form.internal_approval_status}
              onChange={(e) => setField('internal_approval_status', e.target.value)}
              error={errors.internal_approval_status}
            >
              <option value="not_started">not_started</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </FormSelect>
            <FormSelect id="status" label={t('table.status')} value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="draft">draft</option>
              <option value="under_review">under_review</option>
              <option value="approved">approved</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </FormSelect>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span className="form-field__label">{t('fields.universities')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                {universities.map((u) => (
                  <label key={u.id} className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={form.university_ids.includes(u.id)} onChange={() => toggleUniversity(u.id)} />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </form>
      <div style={{ marginTop: '1.5rem' }}>
        <LearningOutcomesPanel microCredentialId={id} readOnly={false} />
      </div>
    </div>
  );
}

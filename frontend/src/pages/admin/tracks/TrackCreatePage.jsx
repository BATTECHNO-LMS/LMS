import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormTextarea } from '../../../components/forms/index.js';
import { trackSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useCreateTrack } from '../../../features/tracks/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function TrackCreatePage() {
  const { t } = useTranslation('tracks');
  const { t: tCommon } = useTranslation('common');
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const createMutation = useCreateTrack();
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(trackSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: res.data.name,
        code: res.data.code,
        description: res.data.description?.trim() || null,
        status: res.data.status,
      });
      navigate('/admin/tracks');
    } catch (err) {
      setErrors({ _form: getApiErrorMessage(err, isArabic ? 'تعذّر إنشاء المسار.' : 'Could not create track.') });
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create.title')}</>} description={<>{t('description')}</>} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/tracks">
                <X size={18} aria-hidden /> {tCommon('actions.cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
                <Save size={18} aria-hidden /> {tCommon('actions.save')}
              </button>
            </>
          }
        >
          {errors._form ? <p className="auth-form__error">{errors._form}</p> : null}
          <div className="crud-form-grid">
            <FormInput
              id="name"
              label={t('table.name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <FormInput
              id="code"
              label={t('table.code')}
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              error={errors.code}
            />
            <FormTextarea
              id="description"
              label={t('fields.description')}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              error={errors.description}
              rows={3}
            />
            <FormSelect
              id="status"
              label={tCommon('status.label')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="active">{tCommon('status.active')}</option>
              <option value="inactive">{tCommon('status.inactive')}</option>
              <option value="archived">{tCommon('status.archived')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

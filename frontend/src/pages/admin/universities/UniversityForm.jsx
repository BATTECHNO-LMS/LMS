import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormSwitch, FormTextarea } from '../../../components/forms/index.js';
import { useSpecialties } from '../../../features/specialties/index.js';
import { getSpecialtyLabel } from '../../../features/specialties/specialties.service.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { universityFormSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

function emptyDomain() {
  return { _key: crypto.randomUUID(), id: null, domain: '', is_active: true, is_primary: false };
}

function emptySpecialty() {
  return {
    _key: crypto.randomUUID(),
    id: null,
    name_ar: '',
    name_en: '',
    code: '',
    college_name_ar: '',
    college_name_en: '',
    specialty_id: '',
    status: 'active',
  };
}

export function buildUniversityFormState(row) {
  return {
    name: row?.name ?? '',
    name_en: row?.name_en ?? '',
    short_name: row?.short_name ?? '',
    code: row?.code ?? '',
    type: row?.type ?? '',
    website: row?.website ?? '',
    country: row?.country ?? '',
    city: row?.city ?? '',
    address: row?.address ?? '',
    contact_person: row?.contact_person ?? '',
    contact_email: row?.contact_email ?? '',
    contact_phone: row?.contact_phone ?? '',
    logo_url: row?.logo_url ?? '',
    status: row?.status ?? 'active',
    partnership_state: row?.partnership_state ?? 'active',
    notes: row?.notes ?? '',
    email_domains: (row?.email_domains || []).map((d) => ({
      _key: d.id || crypto.randomUUID(),
      id: d.id ?? null,
      domain: d.domain ?? '',
      is_active: d.is_active !== false,
      is_primary: Boolean(d.is_primary),
    })),
    specialties: (row?.specialties || []).map((s) => ({
      _key: s.id || crypto.randomUUID(),
      id: s.id ?? null,
      name_ar: s.name_ar ?? '',
      name_en: s.name_en ?? '',
      code: s.code ?? '',
      college_name_ar: s.college_name_ar ?? '',
      college_name_en: s.college_name_en ?? '',
      specialty_id: s.specialty_id ?? '',
      status: s.status ?? 'active',
    })),
  };
}

function toApiPayload(data) {
  return {
    name: data.name.trim(),
    name_en: data.name_en?.trim() || null,
    short_name: data.short_name?.trim() || null,
    code: data.code?.trim() || null,
    type: data.type?.trim() || null,
    website: data.website?.trim() || null,
    country: data.country?.trim() || null,
    city: data.city?.trim() || null,
    address: data.address?.trim() || null,
    contact_person: data.contact_person?.trim() || null,
    contact_email: data.contact_email?.trim() || null,
    contact_phone: data.contact_phone?.trim() || null,
    logo_url: data.logo_url?.trim() || null,
    status: data.status,
    partnership_state: data.partnership_state,
    notes: data.notes?.trim() || null,
    email_domains: (data.email_domains || []).map((d) => ({
      ...(d.id ? { id: d.id } : {}),
      domain: String(d.domain || '').trim(),
      is_active: d.is_active !== false,
      is_primary: Boolean(d.is_primary),
    })),
    specialties: (data.specialties || []).map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      name_ar: String(s.name_ar || '').trim(),
      name_en: s.name_en?.trim() || null,
      code: String(s.code || '').trim(),
      college_name_ar: s.college_name_ar?.trim() || null,
      college_name_en: s.college_name_en?.trim() || null,
      specialty_id: s.specialty_id || null,
      status: s.status || 'active',
    })),
  };
}

/**
 * Shared create/edit university form with BATTECHNO card sections.
 */
export function UniversityForm({
  initial,
  mode = 'create',
  universityId = null,
  submitting = false,
  formError = null,
  onSubmit,
  cancelTo,
}) {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data: canonicalSpecialties = [] } = useSpecialties();
  const [form, setForm] = useState(() => buildUniversityFormState(initial));
  const [errors, setErrors] = useState({});

  const specialtyOptions = useMemo(
    () =>
      (canonicalSpecialties || []).map((s) => ({
        id: s.id,
        label: getSpecialtyLabel(s, locale),
      })),
    [canonicalSpecialties, locale]
  );

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateDomain(index, patch) {
    setForm((f) => {
      const email_domains = f.email_domains.map((d, i) => {
        if (i !== index) {
          if (patch.is_primary === true) return { ...d, is_primary: false };
          return d;
        }
        return { ...d, ...patch };
      });
      return { ...f, email_domains };
    });
  }

  function addDomain() {
    setForm((f) => ({ ...f, email_domains: [...f.email_domains, emptyDomain()] }));
  }

  function removeDomain(index) {
    setForm((f) => ({
      ...f,
      email_domains: f.email_domains.filter((_, i) => i !== index),
    }));
  }

  function updateSpecialty(index, patch) {
    setForm((f) => ({
      ...f,
      specialties: f.specialties.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSpecialty() {
    setForm((f) => ({ ...f, specialties: [...f.specialties, emptySpecialty()] }));
  }

  function removeSpecialty(index) {
    setForm((f) => {
      const row = f.specialties[index];
      // Existing specialty: mark inactive instead of dropping (safe for linked students).
      if (row?.id) {
        return {
          ...f,
          specialties: f.specialties.map((s, i) => (i === index ? { ...s, status: 'inactive' } : s)),
        };
      }
      return { ...f, specialties: f.specialties.filter((_, i) => i !== index) };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const res = safeParse(universityFormSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    await onSubmit(toApiPayload(res.data));
  }

  return (
    <form className="university-form" onSubmit={handleSubmit} noValidate>
      {formError ? <p className="auth-form__error university-form__banner">{formError}</p> : null}
      {errors._form ? <p className="auth-form__error university-form__banner">{errors._form}</p> : null}

      <SectionCard title={tr(isArabic, 'معلومات الجامعة الأساسية', 'Basic university information')}>
        <div className="crud-form-grid university-form__grid">
          <FormInput
            id="name"
            label={tr(isArabic, 'اسم الجامعة بالعربية', 'University name (Arabic)')}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            required
          />
          <FormInput
            id="name_en"
            label={tr(isArabic, 'اسم الجامعة بالإنجليزية', 'University name (English)')}
            value={form.name_en}
            onChange={(e) => setField('name_en', e.target.value)}
            error={errors.name_en}
          />
          <FormInput
            id="short_name"
            label={tr(isArabic, 'الاسم المختصر', 'Short name')}
            value={form.short_name}
            onChange={(e) => setField('short_name', e.target.value)}
            error={errors.short_name}
          />
          <FormInput
            id="code"
            label={tr(isArabic, 'كود الجامعة الفريد', 'Unique university code')}
            value={form.code}
            onChange={(e) => setField('code', e.target.value)}
            error={errors.code}
          />
          <FormInput
            id="type"
            label={tr(isArabic, 'نوع الجامعة', 'University type')}
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
            error={errors.type}
            placeholder={tr(isArabic, 'حكومية / خاصة / …', 'Public / Private / …')}
          />
          <FormInput
            id="website"
            label={tr(isArabic, 'الموقع الإلكتروني', 'Website')}
            value={form.website}
            onChange={(e) => setField('website', e.target.value)}
            error={errors.website}
            placeholder="https://"
          />
          <FormInput
            id="logo_url"
            label={tr(isArabic, 'شعار الجامعة (رابط)', 'University logo (URL)')}
            value={form.logo_url}
            onChange={(e) => setField('logo_url', e.target.value)}
            error={errors.logo_url}
            placeholder="/uploads/logos/…"
          />
        </div>
      </SectionCard>

      <SectionCard title={tr(isArabic, 'معلومات الاتصال والموقع', 'Contact & location')}>
        <div className="crud-form-grid university-form__grid">
          <FormInput
            id="country"
            label={tr(isArabic, 'الدولة', 'Country')}
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            error={errors.country}
          />
          <FormInput
            id="city"
            label={tr(isArabic, 'المحافظة / المدينة', 'Governorate / city')}
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            error={errors.city}
          />
          <FormInput
            id="address"
            label={tr(isArabic, 'العنوان', 'Address')}
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            error={errors.address}
            className="university-form__span-2"
          />
          <FormInput
            id="contact_person"
            label={tr(isArabic, 'اسم جهة الاتصال', 'Contact person')}
            value={form.contact_person}
            onChange={(e) => setField('contact_person', e.target.value)}
            error={errors.contact_person}
          />
          <FormInput
            id="contact_email"
            type="email"
            label={tr(isArabic, 'البريد الإلكتروني الرسمي', 'Official email')}
            value={form.contact_email}
            onChange={(e) => setField('contact_email', e.target.value)}
            error={errors.contact_email}
          />
          <FormInput
            id="contact_phone"
            label={tr(isArabic, 'رقم الهاتف', 'Phone')}
            value={form.contact_phone}
            onChange={(e) => setField('contact_phone', e.target.value)}
            error={errors.contact_phone}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={tr(isArabic, 'نطاقات البريد الإلكتروني المعتمدة', 'Approved email domains')}
        actions={
          <button type="button" className="btn btn--outline btn--sm" onClick={addDomain}>
            <Plus size={16} aria-hidden /> {tr(isArabic, 'إضافة نطاق', 'Add domain')}
          </button>
        }
      >
        <p className="university-form__hint">
          {tr(
            isArabic,
            'أدخل النطاق فقط مثل mutah.edu.jo بدون https أو مسارات. يُستخدم للتحقق من بريد الطالب عند التسجيل.',
            'Enter host only, e.g. mutah.edu.jo — no https or paths. Used to validate student email at registration.'
          )}
        </p>
        {errors.email_domains ? <p className="form-field__error">{errors.email_domains}</p> : null}
        {!form.email_domains.length ? (
          <p className="crud-muted">{tr(isArabic, 'لا توجد نطاقات بعد. أضف نطاقًا واحدًا على الأقل للتسجيل.', 'No domains yet. Add at least one for registration.')}</p>
        ) : (
          <div className="university-form__rows">
            {form.email_domains.map((d, index) => (
              <div key={d._key} className="university-form__row university-form__row--domain">
                <FormInput
                  id={`domain-${d._key}`}
                  label={tr(isArabic, 'اسم النطاق', 'Domain')}
                  value={d.domain}
                  onChange={(e) => updateDomain(index, { domain: e.target.value })}
                  error={errors[`email_domains.${index}.domain`] || errors[`email_domains[${index}].domain`]}
                  placeholder="mutah.edu.jo"
                />
                <FormSwitch
                  id={`domain-active-${d._key}`}
                  label={tr(isArabic, 'فعال', 'Active')}
                  checked={d.is_active}
                  onChange={(e) => updateDomain(index, { is_active: e.target.checked })}
                />
                <FormSwitch
                  id={`domain-primary-${d._key}`}
                  label={tr(isArabic, 'نطاق أساسي', 'Primary')}
                  checked={d.is_primary}
                  onChange={(e) => updateDomain(index, { is_primary: e.target.checked })}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm university-form__remove"
                  onClick={() => removeDomain(index)}
                  aria-label={tr(isArabic, 'حذف النطاق', 'Remove domain')}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="specialties"
        title={tr(isArabic, 'تخصصات الجامعة', 'University specialties')}
        actions={
          <button type="button" className="btn btn--outline btn--sm" onClick={addSpecialty}>
            <Plus size={16} aria-hidden /> {tr(isArabic, 'إضافة تخصص', 'Add specialty')}
          </button>
        }
      >
        <p className="university-form__hint">
          {tr(
            isArabic,
            'هذه التخصصات هي التي تظهر للطالب بعد اختيار الجامعة في التسجيل — وليست القائمة العالمية الموحدة.',
            'These programs appear to students after they pick this university — not the global catalog alone.'
          )}
        </p>
        {mode === 'edit' && universityId ? (
          <p className="university-form__manage-link">
            <a href="#specialties">{tr(isArabic, 'إدارة تخصصات الجامعة', 'Manage university specialties')}</a>
          </p>
        ) : null}
        {errors.specialties ? <p className="form-field__error">{errors.specialties}</p> : null}
        {!form.specialties.length ? (
          <p className="crud-muted">{tr(isArabic, 'لا توجد تخصصات مرتبطة. يمكنك إضافتها الآن أو لاحقًا.', 'No linked specialties. You can add them now or later.')}</p>
        ) : (
          <div className="university-form__rows">
            {form.specialties.map((s, index) => (
              <div
                key={s._key}
                className={`university-form__row university-form__row--specialty${s.status === 'inactive' ? ' is-inactive' : ''}`}
              >
                <FormInput
                  id={`spec-ar-${s._key}`}
                  label={tr(isArabic, 'الاسم العربي', 'Arabic name')}
                  value={s.name_ar}
                  onChange={(e) => updateSpecialty(index, { name_ar: e.target.value })}
                  error={errors[`specialties.${index}.name_ar`]}
                />
                <FormInput
                  id={`spec-en-${s._key}`}
                  label={tr(isArabic, 'الاسم الإنجليزي', 'English name')}
                  value={s.name_en}
                  onChange={(e) => updateSpecialty(index, { name_en: e.target.value })}
                />
                <FormInput
                  id={`spec-code-${s._key}`}
                  label={tr(isArabic, 'الكود', 'Code')}
                  value={s.code}
                  onChange={(e) => updateSpecialty(index, { code: e.target.value })}
                  error={errors[`specialties.${index}.code`]}
                />
                <FormInput
                  id={`spec-college-ar-${s._key}`}
                  label={tr(isArabic, 'الكلية (عربي)', 'College (Arabic)')}
                  value={s.college_name_ar}
                  onChange={(e) => updateSpecialty(index, { college_name_ar: e.target.value })}
                />
                <FormInput
                  id={`spec-college-en-${s._key}`}
                  label={tr(isArabic, 'الكلية (إنجليزي)', 'College (English)')}
                  value={s.college_name_en}
                  onChange={(e) => updateSpecialty(index, { college_name_en: e.target.value })}
                />
                <FormSelect
                  id={`spec-canonical-${s._key}`}
                  label={tr(isArabic, 'التخصص المرجعي (Canonical)', 'Canonical specialty')}
                  value={s.specialty_id || ''}
                  onChange={(e) => updateSpecialty(index, { specialty_id: e.target.value })}
                >
                  <option value="">{tr(isArabic, '— بدون ربط —', '— None —')}</option>
                  {specialtyOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id={`spec-status-${s._key}`}
                  label={tr(isArabic, 'الحالة', 'Status')}
                  value={s.status}
                  onChange={(e) => updateSpecialty(index, { status: e.target.value })}
                >
                  <option value="active">{tr(isArabic, 'فعال', 'Active')}</option>
                  <option value="inactive">{tr(isArabic, 'غير فعال', 'Inactive')}</option>
                </FormSelect>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm university-form__remove"
                  onClick={() => removeSpecialty(index)}
                  aria-label={tr(isArabic, 'إزالة / تعطيل التخصص', 'Remove / deactivate specialty')}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={tr(isArabic, 'الإعدادات والحالة', 'Settings & status')}>
        <div className="crud-form-grid university-form__grid">
          <FormSelect
            id="status"
            label={tr(isArabic, 'حالة الجامعة', 'University status')}
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
            error={errors.status}
          >
            <option value="active">{tr(isArabic, 'نشطة', 'Active')}</option>
            <option value="inactive">{tr(isArabic, 'غير نشطة', 'Inactive')}</option>
            <option value="archived">{tr(isArabic, 'مؤرشفة', 'Archived')}</option>
          </FormSelect>
          <FormSelect
            id="partnership_state"
            label={tr(isArabic, 'حالة الشراكة', 'Partnership status')}
            value={form.partnership_state}
            onChange={(e) => setField('partnership_state', e.target.value)}
            error={errors.partnership_state}
          >
            <option value="active">{tr(isArabic, 'نشطة', 'Active')}</option>
            <option value="inactive">{tr(isArabic, 'غير نشطة', 'Inactive')}</option>
            <option value="pending">{tr(isArabic, 'قيد الانتظار', 'Pending')}</option>
            <option value="ended">{tr(isArabic, 'منتهية', 'Ended')}</option>
          </FormSelect>
          <FormTextarea
            id="notes"
            className="university-form__span-2"
            label={tr(isArabic, 'ملاحظات إدارية (اختياري)', 'Admin notes (optional)')}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            error={errors.notes}
            rows={4}
          />
        </div>
      </SectionCard>

      <div className="university-form__actions">
        <Link className="btn btn--outline" to={cancelTo}>
          <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
        </Link>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          <Save size={18} aria-hidden />{' '}
          {submitting
            ? tr(isArabic, 'جاري الحفظ…', 'Saving…')
            : mode === 'edit'
              ? tr(isArabic, 'تحديث', 'Update')
              : tr(isArabic, 'حفظ', 'Save')}
        </button>
      </div>
    </form>
  );
}

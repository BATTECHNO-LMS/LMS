import { Link, useParams } from 'react-router-dom';
import { GraduationCap, Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUniversity } from '../../../features/universities/index.js';

function Field({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? '—'}</dd>
    </div>
  );
}

export function UniversityViewPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const { data: row, isLoading, isError } = useUniversity(id);

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
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على الجامعة.', 'University not found.')}
        />
        <Link className="btn btn--primary" to="/admin/universities">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  const domains = row.email_domains || [];
  const specialties = row.specialties || [];

  return (
    <div className="page page--dashboard page--admin crud-page university-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل الجامعة', 'University details')}
        description={tr(isArabic, 'عرض بيانات الجامعة والنطاقات والتخصصات.', 'View university profile, domains, and specialties.')}
      />

      <SectionCard
        title={tr(isArabic, 'معلومات الجامعة الأساسية', 'Basic information')}
        actions={
          <>
            <Link className="btn btn--outline" to={`/admin/universities/${id}/edit#specialties`}>
              <GraduationCap size={18} aria-hidden /> {tr(isArabic, 'إدارة تخصصات الجامعة', 'Manage university specialties')}
            </Link>
            <Link className="btn btn--primary" to={`/admin/universities/${id}/edit`}>
              <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
            </Link>
          </>
        }
      >
        <dl className="crud-dl">
          <Field label={tr(isArabic, 'الاسم بالعربية', 'Arabic name')}>{row.name}</Field>
          <Field label={tr(isArabic, 'الاسم بالإنجليزية', 'English name')}>{row.name_en}</Field>
          <Field label={tr(isArabic, 'الاسم المختصر', 'Short name')}>{row.short_name}</Field>
          <Field label={tr(isArabic, 'الكود', 'Code')}>{row.code}</Field>
          <Field label={tr(isArabic, 'النوع', 'Type')}>{row.type}</Field>
          <Field label={tr(isArabic, 'الموقع', 'Website')}>
            {row.website ? (
              <a href={row.website} target="_blank" rel="noreferrer">
                {row.website}
              </a>
            ) : (
              '—'
            )}
          </Field>
          <Field label={tr(isArabic, 'الحالة', 'Status')}>
            <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
          </Field>
          <Field label={tr(isArabic, 'الشراكة', 'Partnership')}>{row.partnership_state}</Field>
        </dl>
      </SectionCard>

      <SectionCard title={tr(isArabic, 'معلومات الاتصال والموقع', 'Contact & location')}>
        <dl className="crud-dl">
          <Field label={tr(isArabic, 'الدولة', 'Country')}>{row.country}</Field>
          <Field label={tr(isArabic, 'المحافظة / المدينة', 'City')}>{row.city}</Field>
          <Field label={tr(isArabic, 'العنوان', 'Address')}>{row.address}</Field>
          <Field label={tr(isArabic, 'جهة الاتصال', 'Contact')}>{row.contact_person}</Field>
          <Field label={tr(isArabic, 'البريد الرسمي', 'Official email')}>{row.contact_email}</Field>
          <Field label={tr(isArabic, 'الهاتف', 'Phone')}>{row.contact_phone}</Field>
          <Field label={tr(isArabic, 'ملاحظات', 'Notes')}>{row.notes}</Field>
        </dl>
      </SectionCard>

      <SectionCard title={tr(isArabic, 'نطاقات البريد الإلكتروني المعتمدة', 'Approved email domains')}>
        {!domains.length ? (
          <p className="crud-muted">{tr(isArabic, 'لا توجد نطاقات.', 'No domains.')}</p>
        ) : (
          <ul className="university-view__list">
            {domains.map((d) => (
              <li key={d.id}>
                <strong>{d.domain}</strong>
                {d.is_primary ? <span className="university-view__chip">{tr(isArabic, 'أساسي', 'Primary')}</span> : null}
                <span className={`university-view__chip${d.is_active ? ' is-on' : ''}`}>
                  {d.is_active ? tr(isArabic, 'فعال', 'Active') : tr(isArabic, 'غير فعال', 'Inactive')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={tr(isArabic, 'تخصصات الجامعة', 'University specialties')}>
        {!specialties.length ? (
          <p className="crud-muted">{tr(isArabic, 'لا توجد تخصصات مرتبطة.', 'No linked specialties.')}</p>
        ) : (
          <ul className="university-view__list">
            {specialties.map((s) => (
              <li key={s.id}>
                <strong>{isArabic ? s.name_ar : s.name_en || s.name_ar}</strong>
                <span className="university-view__meta">
                  {s.code}
                  {s.college_name_ar || s.college_name_en
                    ? ` · ${isArabic ? s.college_name_ar || s.college_name_en : s.college_name_en || s.college_name_ar}`
                    : ''}
                </span>
                <span className={`university-view__chip${s.status === 'active' ? ' is-on' : ''}`}>
                  {s.status === 'active' ? tr(isArabic, 'فعال', 'Active') : tr(isArabic, 'غير فعال', 'Inactive')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="crud-view-actions">
        <Link className="btn btn--outline" to="/admin/universities">
          {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
        </Link>
      </div>
    </div>
  );
}

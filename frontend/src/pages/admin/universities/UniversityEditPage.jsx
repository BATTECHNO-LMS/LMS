import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUniversity, useUpdateUniversity } from '../../../features/universities/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { UniversityForm, buildUniversityFormState } from './UniversityForm.jsx';

export function UniversityEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = Boolean(location.state?.justCreated);
  const { data: row, isLoading, isError } = useUniversity(id);
  const updateUniversityMutation = useUpdateUniversity();
  const [formError, setFormError] = useState(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (row?.id) setFormKey((k) => k + 1);
  }, [row?.id, row?.updated_at]);

  async function handleSubmit(payload) {
    setFormError(null);
    try {
      await updateUniversityMutation.mutateAsync({ id, body: payload });
      navigate(`/admin/universities/${id}`);
    } catch (err) {
      setFormError(getApiErrorMessage(err, isArabic ? 'تعذّر التحديث.' : 'Could not update university.'));
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

  return (
    <div className="page page--dashboard page--admin crud-page university-page">
      <AdminPageHeader
        title={tr(isArabic, 'تعديل جامعة', 'Edit university')}
        description={tr(isArabic, 'تحديث بيانات الجامعة والنطاقات والتخصصات.', 'Update university, domains, and specialties.')}
      />
      {justCreated ? (
        <div className="university-form__success-banner" role="status">
          <p>
            {tr(
              isArabic,
              'تم إنشاء الجامعة بنجاح. يمكنك الآن إدارة تخصصاتها ونطاقات بريدها من الأقسام أدناه.',
              'University created. You can manage specialties and email domains in the sections below.'
            )}
          </p>
          <a className="btn btn--primary btn--sm" href="#specialties">
            <GraduationCap size={16} aria-hidden /> {tr(isArabic, 'إدارة تخصصات الجامعة', 'Manage university specialties')}
          </a>
        </div>
      ) : null}
      <UniversityForm
        key={formKey}
        initial={buildUniversityFormState(row)}
        mode="edit"
        universityId={id}
        submitting={updateUniversityMutation.isPending}
        formError={formError}
        onSubmit={handleSubmit}
        cancelTo={`/admin/universities/${id}`}
      />
    </div>
  );
}

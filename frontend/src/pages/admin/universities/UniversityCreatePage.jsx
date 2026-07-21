import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useCreateUniversity } from '../../../features/universities/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { UniversityForm, buildUniversityFormState } from './UniversityForm.jsx';

export function UniversityCreatePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const createUniversityMutation = useCreateUniversity();
  const [formError, setFormError] = useState(null);

  async function handleSubmit(payload) {
    setFormError(null);
    try {
      const created = await createUniversityMutation.mutateAsync(payload);
      const id = created?.id;
      if (id) {
        navigate(`/admin/universities/${id}/edit`, {
          state: { justCreated: true },
        });
      } else {
        navigate('/admin/universities');
      }
    } catch (err) {
      setFormError(getApiErrorMessage(err, isArabic ? 'تعذّر إنشاء الجامعة.' : 'Could not create university.'));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page university-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء جامعة', 'Create university')}
        description={tr(
          isArabic,
          'أدخل بيانات الجامعة ونطاقات البريد والتخصصات ثم احفظ.',
          'Enter university profile, email domains, and specialties, then save.'
        )}
      />
      <UniversityForm
        initial={buildUniversityFormState(null)}
        mode="create"
        submitting={createUniversityMutation.isPending}
        formError={formError}
        onSubmit={handleSubmit}
        cancelTo="/admin/universities"
      />
    </div>
  );
}

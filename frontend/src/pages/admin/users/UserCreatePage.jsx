import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useCreateUser } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { UserForm } from './UserForm.jsx';

export function UserCreatePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const createUserMutation = useCreateUser();
  const [formError, setFormError] = useState(null);

  async function handleSubmit(payload) {
    setFormError(null);
    try {
      const created = await createUserMutation.mutateAsync(payload);
      const id = created?.id;
      navigate(id ? `/admin/users/${id}` : '/admin/users');
    } catch (err) {
      setFormError(getApiErrorMessage(err, isArabic ? 'تعذّر إنشاء المستخدم.' : 'Could not create user.'));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page user-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء مستخدم', 'Create user')}
        description={tr(
          isArabic,
          'أدخل البيانات الشخصية والحساب والدور والحقول المرتبطة بالدور ثم احفظ.',
          'Enter personal, account, role, and role-specific fields, then save.'
        )}
      />
      <UserForm
        mode="create"
        submitting={createUserMutation.isPending}
        formError={formError}
        onSubmit={handleSubmit}
        cancelTo="/admin/users"
      />
    </div>
  );
}

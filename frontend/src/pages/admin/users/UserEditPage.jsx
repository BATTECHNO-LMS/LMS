import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUser, useUpdateUser } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { UserForm, buildUserEditFormState } from './UserForm.jsx';

export function UserEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: row, isLoading, isError } = useUser(id);
  const updateUserMutation = useUpdateUser();
  const [formError, setFormError] = useState(null);

  async function handleSubmit(payload) {
    setFormError(null);
    try {
      const body = { ...payload };
      delete body.password;
      await updateUserMutation.mutateAsync({ id, body });
      navigate(`/admin/users/${id}`);
    } catch (err) {
      setFormError(getApiErrorMessage(err, isArabic ? 'تعذّر التحديث.' : 'Could not update.'));
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
          description={tr(isArabic, 'لم يتم العثور على المستخدم.', 'User not found.')}
        />
        <Link className="btn btn--primary" to="/admin/users">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page user-page">
      <AdminPageHeader
        title={tr(isArabic, 'تعديل مستخدم', 'Edit user')}
        description={tr(isArabic, 'تحديث بيانات المستخدم والدور والنطاق الأكاديمي.', 'Update user profile, role, and academic scope.')}
      />
      <UserForm
        key={row.id + String(row.updated_at || '')}
        mode="edit"
        initial={buildUserEditFormState(row)}
        submitting={updateUserMutation.isPending}
        formError={formError}
        onSubmit={handleSubmit}
        cancelTo={`/admin/users/${id}`}
      />
    </div>
  );
}

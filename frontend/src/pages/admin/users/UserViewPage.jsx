import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUser, useUpdateUserStatus } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UserViewPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const { data: row, isLoading, isError } = useUser(id);
  const updateStatus = useUpdateUserStatus();
  const [statusMsg, setStatusMsg] = useState('');

  async function handleSetStatus(status) {
    if (!id) return;
    setStatusMsg('');
    try {
      await updateStatus.mutateAsync({ id, status });
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, tr(isArabic, 'تعذّر تحديث الحالة.', 'Could not update status.')));
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

  const primaryRole = Array.isArray(row.roles) && row.roles.length ? row.roles[0] : '';

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل المستخدم', 'User details')}
        description={tr(isArabic, 'عرض بيانات المستخدم والحالة.', 'View user details and status.')}
      />
      <SectionCard
        title={tr(isArabic, 'البيانات', 'Details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/users/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{tr(isArabic, 'الاسم', 'Name')}</dt>
            <dd>{row.full_name ?? row.name ?? '—'}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'البريد الإلكتروني', 'Email')}</dt>
            <dd>{row.email}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الدور', 'Role')}</dt>
            <dd>{roleLabelAr(primaryRole, locale)}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'آخر دخول', 'Last login')}</dt>
            <dd>{row.last_login_at ? String(row.last_login_at) : '—'}</dd>
          </div>
        </dl>
        {statusMsg ? <p className="auth-form__error">{statusMsg}</p> : null}
        <div className="crud-view-actions">
          {row.status === 'active' ? (
            <button
              type="button"
              className="btn btn--outline"
              disabled={updateStatus.isPending}
              onClick={() => handleSetStatus('suspended')}
            >
              {tr(isArabic, 'تعليق الحساب', 'Suspend account')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={updateStatus.isPending}
              onClick={() => handleSetStatus('active')}
            >
              {tr(isArabic, 'تفعيل الحساب', 'Activate account')}
            </button>
          )}
          <Link className="btn btn--outline" to="/admin/users">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

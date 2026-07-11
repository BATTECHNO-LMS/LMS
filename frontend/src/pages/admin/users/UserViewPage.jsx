import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal.jsx';
import { genericStatusVariant } from '../../../utils/statusMap.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUser, useUpdateUserStatus, useVerifyUserEmail } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UserViewPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const { data: row, isLoading, isError } = useUser(id);
  const updateStatus = useUpdateUserStatus();
  const verifyEmail = useVerifyUserEmail();
  const [statusMsg, setStatusMsg] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);

  async function handleSetStatus(status) {
    if (!id) return;
    setStatusMsg('');
    try {
      await updateStatus.mutateAsync({ id, status });
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, tr(isArabic, 'تعذّر تحديث الحالة.', 'Could not update status.')));
    }
  }

  async function confirmVerify() {
    if (!id) return;
    setStatusMsg('');
    try {
      const result = await verifyEmail.mutateAsync(id);
      setStatusMsg(result?.message || t('list.verifyEmailSuccess'));
      setVerifyOpen(false);
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, tCommon('errors.generic')));
      setVerifyOpen(false);
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
  const emailVerified = Boolean(row.email_verified_at);
  const accountLabel =
    row.status === 'active'
      ? t('list.accountActive')
      : row.status === 'suspended'
        ? t('list.accountSuspended')
        : t('list.accountInactive');

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
            <dd>{row.full_name ?? row.name ?? tCommon('notAvailable', { defaultValue: t('empty.noData') })}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'البريد الإلكتروني', 'Email')}</dt>
            <dd>{row.email}</dd>
          </div>
          <div>
            <dt>{t('table.emailVerified')}</dt>
            <dd>
              <StatusBadge variant={emailVerified ? 'success' : 'warning'}>
                {emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الدور', 'Role')}</dt>
            <dd>{roleLabelAr(primaryRole, locale)}</dd>
          </div>
          <div>
            <dt>{t('table.accountStatus')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{accountLabel}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'آخر دخول', 'Last login')}</dt>
            <dd>
              {row.last_login_at
                ? String(row.last_login_at)
                : tCommon('notAvailable', { defaultValue: t('empty.noData') })}
            </dd>
          </div>
        </dl>
        {statusMsg ? <p className="auth-register__helper" role="status">{statusMsg}</p> : null}
        <div className="crud-view-actions">
          {!emailVerified ? (
            <button
              type="button"
              className="btn btn--outline"
              disabled={verifyEmail.isPending}
              onClick={() => setVerifyOpen(true)}
            >
              {t('list.verifyEmail')}
            </button>
          ) : null}
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

      <ConfirmDeleteModal
        open={verifyOpen}
        title={t('list.verifyEmailConfirmTitle')}
        message={t('list.verifyEmailConfirmText')}
        confirmLabel={t('list.verifyEmailConfirm')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={verifyEmail.isPending}
        onClose={() => setVerifyOpen(false)}
        onConfirm={confirmVerify}
      />
    </div>
  );
}

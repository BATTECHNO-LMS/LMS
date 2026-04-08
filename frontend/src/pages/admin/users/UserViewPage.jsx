import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function UserViewPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const row = adminCrudStore.users.getById(id);

  if (!row) {
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
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'البريد الإلكتروني', 'Email')}</dt>
            <dd>{row.email}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الدور', 'Role')}</dt>
            <dd>{roleLabelAr(row.role, locale)}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'آخر دخول', 'Last login')}</dt>
            <dd>{row.lastLogin}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/users">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

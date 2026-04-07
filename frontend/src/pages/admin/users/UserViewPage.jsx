import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';

export function UserViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.users.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على المستخدم." />
        <Link className="btn btn--primary" to="/admin/users">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل المستخدم" description="عرض بيانات المستخدم والحالة." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/users/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>الاسم</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>البريد الإلكتروني</dt>
            <dd>{row.email}</dd>
          </div>
          <div>
            <dt>الدور</dt>
            <dd>{roleLabelAr(row.role)}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>آخر دخول</dt>
            <dd>{row.lastLogin}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/users">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

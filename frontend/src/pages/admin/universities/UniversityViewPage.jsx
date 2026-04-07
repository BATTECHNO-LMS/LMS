import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';

export function UniversityViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.universities.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على الجامعة." />
        <Link className="btn btn--primary" to="/admin/universities">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل الجامعة" description="عرض بيانات الجامعة." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/universities/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>اسم الجامعة</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>جهة الاتصال</dt>
            <dd>{row.contact}</dd>
          </div>
          <div>
            <dt>البريد الإلكتروني</dt>
            <dd>{row.email}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>عدد البرامج</dt>
            <dd>{row.programs ?? 0}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/universities">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

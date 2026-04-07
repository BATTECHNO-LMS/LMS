import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';

export function CohortViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.cohorts.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على الدفعة." />
        <Link className="btn btn--primary" to="/admin/cohorts">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل الدفعة" description="عرض بيانات الدفعة والجداول." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/cohorts/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>اسم الدفعة</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>الشهادة</dt>
            <dd>{row.credentialName}</dd>
          </div>
          <div>
            <dt>الجامعة</dt>
            <dd>{row.universityName}</dd>
          </div>
          <div>
            <dt>المدرّب</dt>
            <dd>{row.instructor}</dd>
          </div>
          <div>
            <dt>تاريخ البداية</dt>
            <dd>{row.startDate}</dd>
          </div>
          <div>
            <dt>تاريخ النهاية</dt>
            <dd>{row.endDate}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/cohorts">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

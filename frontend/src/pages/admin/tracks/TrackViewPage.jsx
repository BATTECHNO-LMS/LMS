import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';

export function TrackViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.tracks.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على المسار." />
        <Link className="btn btn--primary" to="/admin/tracks">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل المسار" description="عرض بيانات المسار." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/tracks/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>اسم المسار</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>الرمز</dt>
            <dd>{row.code}</dd>
          </div>
          <div>
            <dt>المستوى</dt>
            <dd>{row.level}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>الدفعات المرتبطة</dt>
            <dd>{row.cohorts ?? 0}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/tracks">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';

export function MicroCredentialViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.microCredentials.getById(id);
  const track = row ? adminCrudStore.tracks.getById(row.trackId) : null;

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على السجل." />
        <Link className="btn btn--primary" to="/admin/micro-credentials">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل الشهادة المصغرة" description="عرض بيانات الشهادة." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/micro-credentials/${id}/edit`}>
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
            <dt>الرمز</dt>
            <dd>{row.code}</dd>
          </div>
          <div>
            <dt>المستوى</dt>
            <dd>{row.level}</dd>
          </div>
          <div>
            <dt>الساعات</dt>
            <dd>{row.hours}</dd>
          </div>
          <div>
            <dt>المسار</dt>
            <dd>{track?.name ?? row.trackId}</dd>
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
          <Link className="btn btn--outline" to="/admin/micro-credentials">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

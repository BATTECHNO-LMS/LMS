import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';

export function RecognitionRequestViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.recognition.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على الطلب." />
        <Link className="btn btn--primary" to="/admin/recognition-requests">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل طلب الاعتراف" description="عرض بيانات الطلب والحالة." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/recognition-requests/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>عنوان الطلب</dt>
            <dd>{row.title}</dd>
          </div>
          <div>
            <dt>الجامعة</dt>
            <dd>{row.universityName}</dd>
          </div>
          <div>
            <dt>اسم الشهادة</dt>
            <dd>{row.credentialName}</dd>
          </div>
          <div>
            <dt>اسم الدفعة</dt>
            <dd>{row.cohortName}</dd>
          </div>
          <div>
            <dt>تاريخ الإنشاء</dt>
            <dd>{row.createdAt}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/recognition-requests">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

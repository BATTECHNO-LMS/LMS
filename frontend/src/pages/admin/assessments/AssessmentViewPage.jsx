import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { assessmentTypeLabelAr } from '../../../utils/labelsAr.js';

export function AssessmentViewPage() {
  const { id } = useParams();
  const row = adminCrudStore.assessments.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="غير موجود" description="لم يتم العثور على التقييم." />
        <Link className="btn btn--primary" to="/admin/assessments">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تفاصيل التقييم" description="عرض بيانات التقييم والدفعة." />
      <SectionCard
        title="البيانات"
        actions={
          <Link className="btn btn--primary" to={`/admin/assessments/${id}/edit`}>
            <Pencil size={18} aria-hidden /> تعديل
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>اسم التقييم</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>النوع</dt>
            <dd>{assessmentTypeLabelAr(row.type)}</dd>
          </div>
          <div>
            <dt>الوزن</dt>
            <dd>{row.weight}%</dd>
          </div>
          <div>
            <dt>الدفعة</dt>
            <dd>{row.cohortName}</dd>
          </div>
          <div>
            <dt>تاريخ الاستحقاق</dt>
            <dd>{row.dueDate}</dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/assessments">
            رجوع للقائمة
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

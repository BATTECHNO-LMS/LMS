import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { assessmentTypeLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function AssessmentViewPage() {
  const { locale, isArabic } = useLocale();
  const { id } = useParams();
  const row = adminCrudStore.assessments.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على التقييم.', 'Assessment not found.')}
        />
        <Link className="btn btn--primary" to="/admin/assessments">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل التقييم', 'Assessment details')}
        description={tr(isArabic, 'عرض بيانات التقييم والدفعة.', 'View assessment and cohort details.')}
      />
      <SectionCard
        title={tr(isArabic, 'البيانات', 'Details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/assessments/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{tr(isArabic, 'اسم التقييم', 'Assessment name')}</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'النوع', 'Type')}</dt>
            <dd>{assessmentTypeLabelAr(row.type, locale)}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الوزن', 'Weight')}</dt>
            <dd>{row.weight}%</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الدفعة', 'Cohort')}</dt>
            <dd>{row.cohortName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'تاريخ الاستحقاق', 'Due date')}</dt>
            <dd>{row.dueDate}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/assessments">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

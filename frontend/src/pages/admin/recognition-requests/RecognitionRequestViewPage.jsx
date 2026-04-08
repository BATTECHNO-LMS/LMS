import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function RecognitionRequestViewPage() {
  const { locale, isArabic } = useLocale();
  const { id } = useParams();
  const row = adminCrudStore.recognition.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على الطلب.', 'Request not found.')}
        />
        <Link className="btn btn--primary" to="/admin/recognition-requests">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل طلب الاعتراف', 'Recognition request details')}
        description={tr(isArabic, 'عرض بيانات الطلب والحالة.', 'View request details and status.')}
      />
      <SectionCard
        title={tr(isArabic, 'البيانات', 'Details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/recognition-requests/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{tr(isArabic, 'عنوان الطلب', 'Request title')}</dt>
            <dd>{row.title}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الجامعة', 'University')}</dt>
            <dd>{row.universityName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'اسم الشهادة', 'Certificate name')}</dt>
            <dd>{row.credentialName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'اسم الدفعة', 'Cohort name')}</dt>
            <dd>{row.cohortName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'تاريخ الإنشاء', 'Created at')}</dt>
            <dd>{row.createdAt}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/recognition-requests">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

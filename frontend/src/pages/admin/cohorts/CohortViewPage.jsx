import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function CohortViewPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const row = adminCrudStore.cohorts.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على الدفعة.', 'Batch not found.')}
        />
        <Link className="btn btn--primary" to="/admin/cohorts">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل الدفعة', 'Batch details')}
        description={tr(isArabic, 'عرض بيانات الدفعة والجداول.', 'View batch details and schedule.')}
      />
      <SectionCard
        title={tr(isArabic, 'البيانات', 'Details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/cohorts/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{tr(isArabic, 'اسم الدفعة', 'Batch name')}</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الشهادة', 'Certificate')}</dt>
            <dd>{row.credentialName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الجامعة', 'University')}</dt>
            <dd>{row.universityName}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'المدرّب', 'Trainer')}</dt>
            <dd>{row.instructor}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'تاريخ البداية', 'Start date')}</dt>
            <dd>{row.startDate}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'تاريخ النهاية', 'End date')}</dt>
            <dd>{row.endDate}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/cohorts">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

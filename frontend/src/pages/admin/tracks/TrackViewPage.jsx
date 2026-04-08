import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function TrackViewPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const row = adminCrudStore.tracks.getById(id);

  if (!row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على المسار.', 'Track not found.')}
        />
        <Link className="btn btn--primary" to="/admin/tracks">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تفاصيل المسار', 'Track details')}
        description={tr(isArabic, 'عرض بيانات المسار.', 'View track details.')}
      />
      <SectionCard
        title={tr(isArabic, 'البيانات', 'Details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/tracks/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tr(isArabic, 'تعديل', 'Edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{tr(isArabic, 'اسم المسار', 'Track name')}</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الرمز', 'Code')}</dt>
            <dd>{row.code}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'المستوى', 'Level')}</dt>
            <dd>{row.level}</dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الحالة', 'Status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tr(isArabic, 'الدفعات المرتبطة', 'Linked cohorts')}</dt>
            <dd>{row.cohorts ?? 0}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/tracks">
            {tr(isArabic, 'رجوع للقائمة', 'Back to list')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

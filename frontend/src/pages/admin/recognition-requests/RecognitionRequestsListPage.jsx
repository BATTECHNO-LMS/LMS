import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Award, Plus } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useTranslation } from 'react-i18next';
import { tr } from '../../../utils/i18n.js';

export function RecognitionRequestsListPage() {
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const location = useLocation();
  const { filterRows, scopeId } = useTenant();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setTick((x) => x + 1);
  }, [location.key, location.pathname, scopeId]);

  const rows = useMemo(() => filterRows(adminCrudStore.recognition.getAll()), [filterRows, scopeId, tick, location.key]);

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.title.includes(q) ||
      (r.universityName && r.universityName.includes(q)) ||
      (r.credentialName && r.credentialName.includes(q)) ||
      (r.cohortName && r.cohortName.includes(q));
    const matchStatus = !status || r.status === status;
    return matchQ && matchStatus;
  });

  const stats = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'طلبات الاعتراف الأكاديمي', 'Academic recognition requests')}
        description={tr(
          isArabic,
          'متابعة طلبات الاعتراف والاعتماد بين الجامعات.',
          'Track recognition and accreditation requests across universities.'
        )}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/recognition-requests/create">
          <Plus size={18} aria-hidden /> {tr(isArabic, 'إضافة طلب', 'Add request')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr(isArabic, 'بحث بالعنوان أو الجامعة أو الدفعة', 'Search by title, university, or cohort')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField
          id="rec-status"
          label={tr(isArabic, 'الحالة', 'Status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
          <option value="pending">{tr(isArabic, 'قيد المراجعة', 'Pending review')}</option>
          <option value="approved">{tr(isArabic, 'معتمد', 'Approved')}</option>
          <option value="rejected">{tr(isArabic, 'مرفوض', 'Rejected')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجمالي الطلبات', 'Total requests')} value={String(stats.total)} icon={Award} />
        <StatCard label={tr(isArabic, 'قيد المراجعة', 'Pending review')} value={String(stats.pending)} icon={Award} />
        <StatCard label={tr(isArabic, 'معتمدة', 'Approved')} value={String(stats.approved)} icon={Award} />
        <StatCard label={tr(isArabic, 'مرفوضة', 'Rejected')} value={String(stats.rejected)} icon={Award} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الطلبات', 'Requests list')}>
        <DataTable
          emptyTitle={
            rows.length === 0
              ? tCommon('tenant.noRecognitionForTenant')
              : rows.length && !filtered.length
                ? tr(isArabic, 'لا توجد نتائج', 'No results')
                : tr(isArabic, 'لا توجد بيانات', 'No data')
          }
          emptyDescription={
            rows.length === 0
              ? tCommon('tenant.emptyForScope')
              : rows.length && !filtered.length
                ? tr(isArabic, 'جرّب تعديل عوامل التصفية أو البحث.', 'Try adjusting filters or search.')
                : tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')
          }
          columns={[
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'universityName', label: tr(isArabic, 'الجامعة', 'University') },
            { key: 'credentialName', label: tr(isArabic, 'الشهادة', 'Certificate') },
            { key: 'cohortName', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'createdAt', label: tr(isArabic, 'تاريخ الإنشاء', 'Created at') },
            {
              key: 'status',
              label: tr(isArabic, 'الحالة', 'Status'),
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
              ),
            },
            {
              key: 'actions',
              label: tr(isArabic, 'الإجراءات', 'Actions'),
              render: (r) => (
                <TableIconActions
                  viewTo={`/admin/recognition-requests/${r.id}`}
                  editTo={`/admin/recognition-requests/${r.id}/edit`}
                  onDelete={() => setDeleteId(r.id)}
                />
              ),
            },
          ]}
          rows={filtered}
          footer={
            <div className="data-table__pagination">
              {tr(isArabic, 'ترقيم الصفحات — سيتم تفعيله لاحقاً', 'Pagination — will be enabled later')}
            </div>
          }
        />
      </SectionCard>
      <ConfirmDeleteModal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) adminCrudStore.recognition.remove(deleteId);
          setDeleteId(null);
          setTick((x) => x + 1);
        }}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
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
import { assessmentTypeLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useTranslation } from 'react-i18next';
import { tr } from '../../../utils/i18n.js';

export function AssessmentsListPage() {
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

  const rows = useMemo(() => filterRows(adminCrudStore.assessments.getAll()), [filterRows, scopeId, tick, location.key]);

  const filtered = rows.filter((r) => {
    const matchQ = !q || r.name.includes(q) || (r.cohortName && r.cohortName.includes(q));
    const matchStatus = !status || r.status === status;
    return matchQ && matchStatus;
  });

  const stats = {
    total: rows.length,
    published: rows.filter((r) => r.status === 'published').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    draft: rows.filter((r) => r.status === 'draft').length,
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إدارة التقييمات', 'Assessment management')}
        description={tr(isArabic, 'تعريف التقييمات وربطها بالدفعات والمواعيد.', 'Define assessments and link them to cohorts and due dates.')}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/assessments/create">
          <Plus size={18} aria-hidden /> {tr(isArabic, 'إضافة تقييم', 'Add assessment')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr(isArabic, 'بحث بالاسم أو الدفعة', 'Search by name or cohort')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField
          id="assess-status"
          label={tr(isArabic, 'الحالة', 'Status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
          <option value="pending">{tr(isArabic, 'قيد المراجعة', 'Pending review')}</option>
          <option value="published">{tr(isArabic, 'منشور', 'Published')}</option>
          <option value="closed">{tr(isArabic, 'مغلق', 'Closed')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجمالي التقييمات', 'Total assessments')} value={String(stats.total)} icon={ClipboardList} />
        <StatCard label={tr(isArabic, 'منشورة', 'Published')} value={String(stats.published)} icon={ClipboardList} />
        <StatCard label={tr(isArabic, 'قيد المراجعة', 'Pending review')} value={String(stats.pending)} icon={ClipboardList} />
        <StatCard label={tr(isArabic, 'مسودات', 'Drafts')} value={String(stats.draft)} icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة التقييمات', 'Assessments list')}>
        <DataTable
          emptyTitle={
            rows.length === 0
              ? tCommon('tenant.noAssessmentsForTenant')
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
            { key: 'name', label: tr(isArabic, 'اسم التقييم', 'Assessment name') },
            {
              key: 'type',
              label: tr(isArabic, 'النوع', 'Type'),
              render: (r) => assessmentTypeLabelAr(r.type, locale),
            },
            { key: 'weight', label: tr(isArabic, 'الوزن %', 'Weight %') },
            { key: 'cohortName', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'dueDate', label: tr(isArabic, 'تاريخ الاستحقاق', 'Due date') },
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
                  viewTo={`/admin/assessments/${r.id}`}
                  editTo={`/admin/assessments/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.assessments.remove(deleteId);
          setDeleteId(null);
          setTick((x) => x + 1);
        }}
      />
    </div>
  );
}

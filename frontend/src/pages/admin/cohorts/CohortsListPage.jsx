import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
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

export function CohortsListPage() {
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

  const rows = useMemo(() => filterRows(adminCrudStore.cohorts.getAll()), [filterRows, scopeId, tick, location.key]);

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.name.includes(q) ||
      r.instructor.includes(q) ||
      (r.credentialName && r.credentialName.includes(q)) ||
      (r.universityName && r.universityName.includes(q));
    const matchStatus = !status || r.status === status;
    return matchQ && matchStatus;
  });

  const stats = {
    total: rows.length,
    running: rows.filter((r) => r.status === 'running').length,
    planned: rows.filter((r) => r.status === 'planned').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إدارة الدفعات', 'Batch management')}
        description={tr(
          isArabic,
          'متابعة الدفعات التدريبية والجداول الزمنية.',
          'Track training batches and schedules.'
        )}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/cohorts/create">
          <Plus size={18} aria-hidden /> {tr(isArabic, 'إضافة دفعة', 'Add batch')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr(isArabic, 'بحث بالاسم أو المدرب أو الشهادة', 'Search by name, trainer, or certificate')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField
          id="cohort-status"
          label={tr(isArabic, 'الحالة', 'Status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="planned">{tr(isArabic, 'مخطط', 'Planned')}</option>
          <option value="running">{tr(isArabic, 'قيد التنفيذ', 'In progress')}</option>
          <option value="completed">{tr(isArabic, 'مكتمل', 'Completed')}</option>
          <option value="cancelled">{tr(isArabic, 'ملغى', 'Cancelled')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجمالي الدفعات', 'Total batches')} value={String(stats.total)} icon={Users} />
        <StatCard label={tr(isArabic, 'قيد التنفيذ', 'In progress')} value={String(stats.running)} icon={Users} />
        <StatCard label={tr(isArabic, 'مخطط', 'Planned')} value={String(stats.planned)} icon={Users} />
        <StatCard label={tr(isArabic, 'مكتمل', 'Completed')} value={String(stats.completed)} icon={Users} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الدفعات', 'Batches list')}>
        <DataTable
          emptyTitle={
            rows.length === 0
              ? tCommon('tenant.noCohortsForTenant')
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
            { key: 'name', label: tr(isArabic, 'اسم الدفعة', 'Batch name') },
            { key: 'credentialName', label: tr(isArabic, 'الشهادة', 'Certificate') },
            { key: 'instructor', label: tr(isArabic, 'المدرّب', 'Trainer') },
            { key: 'startDate', label: tr(isArabic, 'تاريخ البداية', 'Start date') },
            { key: 'endDate', label: tr(isArabic, 'تاريخ النهاية', 'End date') },
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
                  viewTo={`/admin/cohorts/${r.id}`}
                  editTo={`/admin/cohorts/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.cohorts.remove(deleteId);
          setDeleteId(null);
          setTick((x) => x + 1);
        }}
      />
    </div>
  );
}

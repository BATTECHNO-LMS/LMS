import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GitBranch, Layers, Plus, Route } from 'lucide-react';
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

export function TracksListPage() {
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

  const rows = useMemo(() => filterRows(adminCrudStore.tracks.getAll()), [filterRows, scopeId, tick, location.key]);

  const filtered = rows.filter((r) => {
    const matchQ = !q || r.name.includes(q) || r.code.toLowerCase().includes(q.toLowerCase()) || r.level.includes(q);
    const matchStatus = !status || r.status === status;
    return matchQ && matchStatus;
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    cohorts: rows.reduce((a, r) => a + (r.cohorts || 0), 0),
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إدارة المسارات', 'Track management')}
        description={tr(
          isArabic,
          'تعريف المسارات التعليمية والمستويات.',
          'Define educational tracks and levels.'
        )}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/tracks/create">
          <Plus size={18} aria-hidden /> {tr(isArabic, 'إضافة مسار', 'Add track')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr(isArabic, 'بحث بالاسم أو الرمز أو المستوى', 'Search by name, code, or level')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField
          id="track-status"
          label={tr(isArabic, 'الحالة', 'Status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="active">{tr(isArabic, 'نشط', 'Active')}</option>
          <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
          <option value="inactive">{tr(isArabic, 'غير نشط', 'Inactive')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجمالي المسارات', 'Total tracks')} value={String(stats.total)} icon={Route} />
        <StatCard label={tr(isArabic, 'المسارات النشطة', 'Active tracks')} value={String(stats.active)} icon={GitBranch} />
        <StatCard label={tr(isArabic, 'المسارات (مسودة)', 'Draft tracks')} value={String(stats.draft)} icon={Layers} />
        <StatCard
          label={tr(isArabic, 'إجمالي الدفعات المرتبطة', 'Total linked cohorts')}
          value={String(stats.cohorts)}
          icon={Layers}
        />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة المسارات', 'Tracks list')}>
        <DataTable
          emptyTitle={
            rows.length === 0
              ? tCommon('tenant.emptyForScope')
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
            { key: 'name', label: tr(isArabic, 'اسم المسار', 'Track name') },
            { key: 'code', label: tr(isArabic, 'الرمز', 'Code') },
            { key: 'level', label: tr(isArabic, 'المستوى', 'Level') },
            {
              key: 'status',
              label: tr(isArabic, 'الحالة', 'Status'),
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
              ),
            },
            { key: 'cohorts', label: tr(isArabic, 'الدفعات', 'Cohorts') },
            {
              key: 'actions',
              label: tr(isArabic, 'الإجراءات', 'Actions'),
              render: (r) => (
                <TableIconActions
                  viewTo={`/admin/tracks/${r.id}`}
                  editTo={`/admin/tracks/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.tracks.remove(deleteId);
          setDeleteId(null);
          setTick((x) => x + 1);
        }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
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

export function TracksListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.tracks.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.tracks.getAll());
  }, [location.key, location.pathname]);

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
      <AdminPageHeader title="إدارة المسارات" description="تعريف المسارات التعليمية والمستويات." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/tracks/create">
          <Plus size={18} aria-hidden /> إضافة مسار
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرمز أو المستوى" />
        <SelectField id="track-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="draft">مسودة</option>
          <option value="inactive">غير نشط</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي المسارات" value={String(stats.total)} icon={Route} />
        <StatCard label="المسارات النشطة" value={String(stats.active)} icon={GitBranch} />
        <StatCard label="المسارات (مسودة)" value={String(stats.draft)} icon={Layers} />
        <StatCard label="إجمالي الدفعات المرتبطة" value={String(stats.cohorts)} icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المسارات">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'اسم المسار' },
            { key: 'code', label: 'الرمز' },
            { key: 'level', label: 'المستوى' },
            {
              key: 'status',
              label: 'الحالة',
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status)}</StatusBadge>
              ),
            },
            { key: 'cohorts', label: 'الدفعات' },
            {
              key: 'actions',
              label: 'الإجراءات',
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
          footer={<div className="data-table__pagination">ترقيم الصفحات — سيتم تفعيله لاحقاً</div>}
        />
      </SectionCard>
      <ConfirmDeleteModal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) adminCrudStore.tracks.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.tracks.getAll());
        }}
      />
    </div>
  );
}

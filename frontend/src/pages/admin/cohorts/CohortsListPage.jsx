import { useEffect, useState } from 'react';
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

export function CohortsListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.cohorts.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.cohorts.getAll());
  }, [location.key, location.pathname]);

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
      <AdminPageHeader title="إدارة الدفعات" description="متابعة الدفعات التدريبية والجداول الزمنية." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/cohorts/create">
          <Plus size={18} aria-hidden /> إضافة دفعة
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو المدرب أو الشهادة" />
        <SelectField id="cohort-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="planned">مخطط</option>
          <option value="running">قيد التنفيذ</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغى</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي الدفعات" value={String(stats.total)} icon={Users} />
        <StatCard label="قيد التنفيذ" value={String(stats.running)} icon={Users} />
        <StatCard label="مخطط" value={String(stats.planned)} icon={Users} />
        <StatCard label="مكتمل" value={String(stats.completed)} icon={Users} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الدفعات">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'اسم الدفعة' },
            { key: 'credentialName', label: 'الشهادة' },
            { key: 'instructor', label: 'المدرّب' },
            { key: 'startDate', label: 'تاريخ البداية' },
            { key: 'endDate', label: 'تاريخ النهاية' },
            {
              key: 'status',
              label: 'الحالة',
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status)}</StatusBadge>
              ),
            },
            {
              key: 'actions',
              label: 'الإجراءات',
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
          footer={<div className="data-table__pagination">ترقيم الصفحات — سيتم تفعيله لاحقاً</div>}
        />
      </SectionCard>
      <ConfirmDeleteModal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) adminCrudStore.cohorts.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.cohorts.getAll());
        }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react';

export function UsersListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.users.getAll());
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.users.getAll());
  }, [location.key, location.pathname]);

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.name.includes(q) ||
      r.email.toLowerCase().includes(q.toLowerCase());
    const matchRole = !role || r.role === role;
    const matchStatus = !status || r.status === status;
    return matchQ && matchRole && matchStatus;
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    new: rows.filter((r) => r.lastLogin === '—').length,
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="إدارة المستخدمين" description="إدارة حسابات المستخدمين وصلاحياتهم ضمن النظام." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/users/create">
          <Plus size={18} aria-hidden /> إضافة مستخدم
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد" />
        <SelectField id="role-filter" label="الدور" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">كل الأدوار</option>
          <option value="instructor">مدرّس</option>
          <option value="student">طالب</option>
          <option value="admin">إداري</option>
          <option value="qa_officer">مسؤول جودة</option>
        </SelectField>
        <SelectField id="status-filter" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي المستخدمين" value={String(stats.total)} icon={Users} />
        <StatCard label="المستخدمون النشطون" value={String(stats.active)} icon={UserCheck} />
        <StatCard label="المستخدمون الموقوفون" value={String(stats.inactive)} icon={UserX} />
        <StatCard label="مستخدمون جدد" value={String(stats.new)} icon={UserPlus} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المستخدمين">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'email', label: 'البريد الإلكتروني' },
            {
              key: 'role',
              label: 'الدور',
              render: (r) => roleLabelAr(r.role),
            },
            {
              key: 'status',
              label: 'الحالة',
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status)}</StatusBadge>
              ),
            },
            { key: 'lastLogin', label: 'آخر دخول' },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: (r) => (
                <TableIconActions
                  viewTo={`/admin/users/${r.id}`}
                  editTo={`/admin/users/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.users.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.users.getAll());
        }}
      />
    </div>
  );
}

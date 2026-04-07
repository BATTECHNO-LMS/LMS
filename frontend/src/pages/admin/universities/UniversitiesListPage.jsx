import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Plus, School, ShieldAlert } from 'lucide-react';
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

export function UniversitiesListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.universities.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.universities.getAll());
  }, [location.key, location.pathname]);

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.name.includes(q) ||
      r.contact.includes(q) ||
      r.email.toLowerCase().includes(q.toLowerCase());
    const matchStatus = !status || r.status === status;
    return matchQ && matchStatus;
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
    programs: rows.reduce((a, r) => a + (r.programs || 0), 0),
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="إدارة الجامعات" description="إدارة مؤسسات التعليم العالي والشراكات." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/universities/create">
          <Plus size={18} aria-hidden /> إضافة جامعة
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد أو جهة الاتصال" />
        <SelectField id="uni-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="suspended">موقوف</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي الجامعات" value={String(stats.total)} icon={Building2} />
        <StatCard label="الجامعات النشطة" value={String(stats.active)} icon={School} />
        <StatCard label="الجامعات الموقوفة" value={String(stats.suspended)} icon={ShieldAlert} />
        <StatCard label="إجمالي البرامج" value={String(stats.programs)} icon={Building2} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الجامعات">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'اسم الجامعة' },
            { key: 'contact', label: 'جهة الاتصال' },
            { key: 'email', label: 'البريد الإلكتروني' },
            {
              key: 'status',
              label: 'الحالة',
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status)}</StatusBadge>
              ),
            },
            { key: 'programs', label: 'عدد البرامج' },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: (r) => (
                <TableIconActions
                  viewTo={`/admin/universities/${r.id}`}
                  editTo={`/admin/universities/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.universities.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.universities.getAll());
        }}
      />
    </div>
  );
}

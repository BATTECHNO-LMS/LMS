import { useEffect, useState } from 'react';
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

export function AssessmentsListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.assessments.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.assessments.getAll());
  }, [location.key, location.pathname]);

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
      <AdminPageHeader title="إدارة التقييمات" description="تعريف التقييمات وربطها بالدفعات والمواعيد." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/assessments/create">
          <Plus size={18} aria-hidden /> إضافة تقييم
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الدفعة" />
        <SelectField id="assess-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="pending">قيد المراجعة</option>
          <option value="published">منشور</option>
          <option value="closed">مغلق</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي التقييمات" value={String(stats.total)} icon={ClipboardList} />
        <StatCard label="منشورة" value={String(stats.published)} icon={ClipboardList} />
        <StatCard label="قيد المراجعة" value={String(stats.pending)} icon={ClipboardList} />
        <StatCard label="مسودات" value={String(stats.draft)} icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title="قائمة التقييمات">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'اسم التقييم' },
            {
              key: 'type',
              label: 'النوع',
              render: (r) => assessmentTypeLabelAr(r.type),
            },
            { key: 'weight', label: 'الوزن %' },
            { key: 'cohortName', label: 'الدفعة' },
            { key: 'dueDate', label: 'تاريخ الاستحقاق' },
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
                  viewTo={`/admin/assessments/${r.id}`}
                  editTo={`/admin/assessments/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.assessments.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.assessments.getAll());
        }}
      />
    </div>
  );
}

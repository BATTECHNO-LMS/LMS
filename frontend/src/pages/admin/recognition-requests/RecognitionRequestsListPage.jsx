import { useEffect, useState } from 'react';
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

export function RecognitionRequestsListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.recognition.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setRows(adminCrudStore.recognition.getAll());
  }, [location.key, location.pathname]);

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
      <AdminPageHeader title="طلبات الاعتراف الأكاديمي" description="متابعة طلبات الاعتراف والاعتماد بين الجامعات." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/recognition-requests/create">
          <Plus size={18} aria-hidden /> إضافة طلب
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالعنوان أو الجامعة أو الدفعة" />
        <SelectField id="rec-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">معتمد</option>
          <option value="rejected">مرفوض</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي الطلبات" value={String(stats.total)} icon={Award} />
        <StatCard label="قيد المراجعة" value={String(stats.pending)} icon={Award} />
        <StatCard label="معتمدة" value={String(stats.approved)} icon={Award} />
        <StatCard label="مرفوضة" value={String(stats.rejected)} icon={Award} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الطلبات">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'universityName', label: 'الجامعة' },
            { key: 'credentialName', label: 'الشهادة' },
            { key: 'cohortName', label: 'الدفعة' },
            { key: 'createdAt', label: 'تاريخ الإنشاء' },
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
                  viewTo={`/admin/recognition-requests/${r.id}`}
                  editTo={`/admin/recognition-requests/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.recognition.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.recognition.getAll());
        }}
      />
    </div>
  );
}

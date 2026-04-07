import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Award, Clock, Plus } from 'lucide-react';
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

export function MicroCredentialsListPage() {
  const location = useLocation();
  const [rows, setRows] = useState(() => adminCrudStore.microCredentials.getAll());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [trackId, setTrackId] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const tracks = useMemo(() => adminCrudStore.tracks.getAll(), [location.key]);
  const trackNameById = useMemo(() => Object.fromEntries(tracks.map((t) => [t.id, t.name])), [tracks]);

  useEffect(() => {
    setRows(adminCrudStore.microCredentials.getAll());
  }, [location.key, location.pathname]);

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.name.includes(q) ||
      r.code.toLowerCase().includes(q.toLowerCase()) ||
      r.level.includes(q);
    const matchStatus = !status || r.status === status;
    const matchTrack = !trackId || r.trackId === trackId;
    return matchQ && matchStatus && matchTrack;
  });

  const stats = {
    total: rows.length,
    approved: rows.filter((r) => r.status === 'approved').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    hours: rows.reduce((a, r) => a + (r.hours || 0), 0),
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="إدارة الشهادات المصغرة" description="تعريف الشهادات المصغرة والساعات والمستويات." />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/micro-credentials/create">
          <Plus size={18} aria-hidden /> إضافة شهادة مصغرة
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرمز أو المستوى" />
        <SelectField id="mc-track" label="المسار" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
          <option value="">كل المسارات</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="mc-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="approved">معتمد</option>
          <option value="archived">مؤرشف</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي الشهادات" value={String(stats.total)} icon={Award} />
        <StatCard label="المعتمدة" value={String(stats.approved)} icon={Award} />
        <StatCard label="مسودات" value={String(stats.draft)} icon={Award} />
        <StatCard label="إجمالي الساعات" value={String(stats.hours)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الشهادات المصغرة">
        <DataTable
          emptyTitle={rows.length && !filtered.length ? 'لا توجد نتائج' : 'لا توجد بيانات'}
          emptyDescription={
            rows.length && !filtered.length ? 'جرّب تعديل عوامل التصفية أو البحث.' : 'لم يتم العثور على سجلات.'
          }
          columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'code', label: 'الرمز' },
            { key: 'level', label: 'المستوى' },
            { key: 'hours', label: 'الساعات' },
            {
              key: 'trackId',
              label: 'المسار',
              render: (r) => trackNameById[r.trackId] ?? r.trackId,
            },
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
                  viewTo={`/admin/micro-credentials/${r.id}`}
                  editTo={`/admin/micro-credentials/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.microCredentials.remove(deleteId);
          setDeleteId(null);
          setRows(adminCrudStore.microCredentials.getAll());
        }}
      />
    </div>
  );
}

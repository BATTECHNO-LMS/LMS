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
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useTranslation } from 'react-i18next';
import { tr } from '../../../utils/i18n.js';

export function MicroCredentialsListPage() {
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const location = useLocation();
  const { filterRows, scopeId } = useTenant();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [trackId, setTrackId] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setTick((x) => x + 1);
  }, [location.key, location.pathname, scopeId]);

  const rows = useMemo(() => filterRows(adminCrudStore.microCredentials.getAll()), [filterRows, scopeId, tick, location.key]);

  const tracks = useMemo(() => filterRows(adminCrudStore.tracks.getAll()), [filterRows, scopeId, tick, location.key]);
  const trackNameById = useMemo(() => Object.fromEntries(tracks.map((t) => [t.id, t.name])), [tracks]);

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
      <AdminPageHeader
        title={tr(isArabic, 'إدارة الشهادات المصغرة', 'Micro-credential management')}
        description={tr(
          isArabic,
          'تعريف الشهادات المصغرة والساعات والمستويات.',
          'Define micro-credentials, hours, and levels.'
        )}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/micro-credentials/create">
          <Plus size={18} aria-hidden /> {tr(isArabic, 'إضافة شهادة مصغرة', 'Add micro-credential')}
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
          id="mc-track"
          label={tr(isArabic, 'المسار', 'Track')}
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل المسارات', 'All tracks')}</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="mc-status"
          label={tr(isArabic, 'الحالة', 'Status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
          <option value="approved">{tr(isArabic, 'معتمد', 'Approved')}</option>
          <option value="archived">{tr(isArabic, 'مؤرشف', 'Archived')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجمالي الشهادات', 'Total credentials')} value={String(stats.total)} icon={Award} />
        <StatCard label={tr(isArabic, 'المعتمدة', 'Approved')} value={String(stats.approved)} icon={Award} />
        <StatCard label={tr(isArabic, 'مسودات', 'Drafts')} value={String(stats.draft)} icon={Award} />
        <StatCard label={tr(isArabic, 'إجمالي الساعات', 'Total hours')} value={String(stats.hours)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الشهادات المصغرة', 'Micro-credentials list')}>
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
            { key: 'name', label: tr(isArabic, 'الاسم', 'Name') },
            { key: 'code', label: tr(isArabic, 'الرمز', 'Code') },
            { key: 'level', label: tr(isArabic, 'المستوى', 'Level') },
            { key: 'hours', label: tr(isArabic, 'الساعات', 'Hours') },
            {
              key: 'trackId',
              label: tr(isArabic, 'المسار', 'Track'),
              render: (r) => trackNameById[r.trackId] ?? r.trackId,
            },
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
                  viewTo={`/admin/micro-credentials/${r.id}`}
                  editTo={`/admin/micro-credentials/${r.id}/edit`}
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
          if (deleteId) adminCrudStore.microCredentials.remove(deleteId);
          setDeleteId(null);
          setTick((x) => x + 1);
        }}
      />
    </div>
  );
}

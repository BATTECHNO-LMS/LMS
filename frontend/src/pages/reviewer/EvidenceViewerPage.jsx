import { FolderOpen, FileText, Image, Paperclip } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { useEvidence } from '../../features/evidence/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function EvidenceViewerPage() {
  const { scopeId, isAllTenantsSelected } = useTenant();
  const params = !isAllTenantsSelected && scopeId ? { university_id: scopeId } : {};
  const { data, isLoading, isError, error } = useEvidence(params, { staleTime: 30_000 });
  const rows = (data?.evidence ?? []).map((e) => ({
    id: e.id,
    title: e.title ?? '—',
    category: e.evidence_type ?? '—',
    size: e.file_url ? '—' : '—',
    uploaded: e.created_at ? String(e.created_at).slice(0, 19) : '—',
  }));
  const docs = rows.filter((r) => String(r.category).includes('document')).length;
  const images = rows.filter((r) => String(r.category).includes('image')).length;
  const attachments = rows.length - docs - images;
  const loadError = isError ? getApiErrorMessage(error) : '';

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title="الأدلة والمرفقات" description="استعراض الأدلة المؤسسية والمرفقات الداعمة لطلبات الاعتراف والتقارير." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان أو النوع" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي العناصر" value={String(rows.length)} icon={FolderOpen} />
        <StatCard label="مستندات" value={String(docs)} icon={FileText} />
        <StatCard label="صور" value={String(images)} icon={Image} />
        <StatCard label="مرفقات" value={String(attachments)} icon={Paperclip} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الأدلة">
        {isLoading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!isLoading ? (
          <DataTable
            columns={[
              { key: 'title', label: 'العنوان' },
              { key: 'category', label: 'التصنيف' },
              { key: 'size', label: 'الحجم' },
              { key: 'uploaded', label: 'الرفع' },
            ]}
            rows={loadError ? [] : rows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

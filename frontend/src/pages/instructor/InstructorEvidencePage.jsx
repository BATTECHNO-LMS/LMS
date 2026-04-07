import { FolderOpen, FileText, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { Button } from '../../components/common/Button.jsx';

export function InstructorEvidencePage() {
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title="الأدلة"
        description="رفع وإدارة الأدلة المرتبطة بالدفعات المسندة إليك فقط — حسب صلاحيات الواجهة."
      />
      <AdminActionBar>
        <PermissionGate permission={P.canUploadEvidence}>
          <Button type="button" variant="primary">
            <Upload size={18} aria-hidden /> رفع دليل
          </Button>
        </PermissionGate>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان أو النوع" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="ملفات مرفوعة" value="—" icon={FolderOpen} />
        <StatCard label="مستندات" value="—" icon={FileText} />
        <StatCard label="مرفقات" value="—" icon={Paperclip} />
        <StatCard label="معتمدة" value="—" icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الأدلة">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'type', label: 'النوع' },
            { key: 'updated', label: 'آخر تحديث' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}

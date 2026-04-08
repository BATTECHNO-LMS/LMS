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
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function InstructorEvidencePage() {
  const P = UI_PERMISSION;
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={tr(isArabic, 'الأدلة', 'Evidence')}
        description={tr(
          isArabic,
          'رفع وإدارة الأدلة المرتبطة بالدفعات المسندة إليك فقط — حسب صلاحيات الواجهة.',
          'Upload and manage evidence linked only to your assigned cohorts, based on UI permissions.'
        )}
      />
      <AdminActionBar>
        <PermissionGate permission={P.canUploadEvidence}>
          <Button type="button" variant="primary">
            <Upload size={18} aria-hidden /> {tr(isArabic, 'رفع دليل', 'Upload evidence')}
          </Button>
        </PermissionGate>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالعنوان أو النوع', 'Search by title or type')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'ملفات مرفوعة', 'Uploaded files')} value="—" icon={FolderOpen} />
        <StatCard label={tr(isArabic, 'مستندات', 'Documents')} value="—" icon={FileText} />
        <StatCard label={tr(isArabic, 'مرفقات', 'Attachments')} value="—" icon={Paperclip} />
        <StatCard label={tr(isArabic, 'معتمدة', 'Approved')} value="—" icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الأدلة', 'Evidence list')}>
        <DataTable
          columns={[
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'type', label: tr(isArabic, 'النوع', 'Type') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}

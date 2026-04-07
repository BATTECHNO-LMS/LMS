import { Award, ShieldCheck, Download, QrCode } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';

export function CertificatePage() {
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title="الشهادة الرقمية"
        description="حالة الشهادة المعتمدة، المعاينة، والتنزيل عند الجاهزية."
      />
      <AdminStatsGrid>
        <StatCard label="حالة الإصدار" value="قيد الاعتماد" icon={Award} />
        <StatCard label="التحقق" value="—" icon={QrCode} />
        <StatCard label="التنزيلات" value="—" icon={Download} />
        <StatCard label="السلامة" value="معتمد" icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard
        title="الشهادة"
        actions={
          <StatusBadge variant="warning">قيد الاعتماد</StatusBadge>
        }
      >
        <p className="certificate-page__desc">
          عند إكمال جميع المتطلبات واعتماد الشهادة من الجهة المختصة، ستتوفر هنا معاينة وتنزيل النسخة الرسمية.
        </p>
        <PermissionGate permission={P.canViewCertificates}>
          <div className="certificate-page__actions">
            <Button type="button" variant="primary" disabled>
              <Download size={18} aria-hidden /> تنزيل (قريباً)
            </Button>
            <Button type="button" variant="outline" disabled>
              معاينة
            </Button>
          </div>
        </PermissionGate>
      </SectionCard>
    </div>
  );
}

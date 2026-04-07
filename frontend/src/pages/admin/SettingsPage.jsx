import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { TextField } from '../../components/admin/TextField.jsx';
import { Button } from '../../components/common/Button.jsx';

export function SettingsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الإعدادات" description="إعدادات النظام العامة والتكامل والإشعارات." />
      <SectionCard
        title="الملف الشخصي للمسؤول"
        actions={
          <Button type="button" variant="primary">
            حفظ
          </Button>
        }
      >
        <div className="admin-settings-grid">
          <TextField id="admin-name" label="الاسم الظاهر" placeholder="—" />
          <TextField id="admin-email" label="البريد" type="email" placeholder="—" />
        </div>
      </SectionCard>
      <SectionCard title="إعدادات النظام">
        <div className="admin-settings-grid">
          <TextField id="sys-name" label="اسم المنصة" placeholder="BATTECHNO-LMS" />
          <TextField id="sys-locale" label="المنطقة الزمنية" placeholder="Asia/Riyadh" />
        </div>
      </SectionCard>
      <SectionCard title="التكامل والإشعارات">
        <p className="text-muted mb-3">ربط الويب هوك والبريد سيتم تفعيله لاحقاً من الخادم.</p>
        <Button type="button" variant="outline">
          فتح إعدادات التكامل
        </Button>
      </SectionCard>
    </div>
  );
}

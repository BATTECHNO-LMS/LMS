import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { TextField } from '../../components/admin/TextField.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الإعدادات', 'Settings')}
        description={tr(
          isArabic,
          'إعدادات النظام العامة والتكامل والإشعارات.',
          'General system, integration, and notification settings.'
        )}
      />
      <SectionCard
        title={tr(isArabic, 'الملف الشخصي للمسؤول', 'Admin profile')}
        actions={
          <Button type="button" variant="primary">
            {tr(isArabic, 'حفظ', 'Save')}
          </Button>
        }
      >
        <div className="admin-settings-grid">
          <TextField
            id="admin-name"
            label={tr(isArabic, 'الاسم الظاهر', 'Display name')}
            placeholder="—"
          />
          <TextField
            id="admin-email"
            label={tr(isArabic, 'البريد', 'Email')}
            type="email"
            placeholder="—"
          />
        </div>
      </SectionCard>
      <SectionCard title={tr(isArabic, 'إعدادات النظام', 'System settings')}>
        <div className="admin-settings-grid">
          <TextField
            id="sys-name"
            label={tr(isArabic, 'اسم المنصة', 'Platform name')}
            placeholder="BATTECHNO-LMS"
          />
          <TextField
            id="sys-timezone"
            label={tr(isArabic, 'المنطقة الزمنية', 'Time zone')}
            placeholder="Asia/Riyadh"
          />
          <FormSelect
            id="sys-locale"
            label={tr(isArabic, 'لغة الواجهة', 'Interface language')}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            <option value="ar">{tr(isArabic, 'العربية (RTL)', 'Arabic (RTL)')}</option>
            <option value="en">{tr(isArabic, 'English (LTR)', 'English (LTR)')}</option>
          </FormSelect>
        </div>
      </SectionCard>
      <SectionCard title={tr(isArabic, 'التكامل والإشعارات', 'Integrations and notifications')}>
        <p className="text-muted mb-3">
          {tr(
            isArabic,
            'ربط الويب هوك والبريد سيتم تفعيله لاحقاً من الخادم.',
            'Webhook and email integrations will be enabled later from the backend.'
          )}
        </p>
        <Button type="button" variant="outline">
          {tr(isArabic, 'فتح إعدادات التكامل', 'Open integration settings')}
        </Button>
      </SectionCard>
    </div>
  );
}

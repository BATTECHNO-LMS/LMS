import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { TextField } from '../../components/admin/TextField.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useSettings, useUpdateSettings } from '../../features/settings/index.js';
import { tr } from '../../utils/i18n.js';

export function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const isArabic = locale === 'ar';
  const { data, isLoading, isError, error, refetch } = useSettings();
  const updateMutation = useUpdateSettings();

  const settings = data?.settings ?? {};
  const [form, setForm] = useState({
    platform_name: '',
    timezone: '',
    default_locale: 'ar',
    support_email: '',
  });
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!data?.settings) return;
    setForm({
      platform_name: data.settings.platform_name ?? 'BATTECHNO LMS',
      timezone: data.settings.timezone ?? 'Asia/Riyadh',
      default_locale: data.settings.default_locale ?? 'ar',
      support_email: data.settings.support_email ?? '',
    });
  }, [data]);

  const handleSave = async () => {
    setSaveMessage('');
    try {
      await updateMutation.mutateAsync({
        platform_name: form.platform_name,
        timezone: form.timezone,
        default_locale: form.default_locale,
        support_email: form.support_email || null,
      });
      setSaveMessage(tr(isArabic, 'تم حفظ الإعدادات.', 'Settings saved.'));
    } catch (err) {
      setSaveMessage(err?.message || tr(isArabic, 'فشل الحفظ.', 'Save failed.'));
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="page page--dashboard page--admin">
        <EmptyState
          title={tr(isArabic, 'تعذّر تحميل الإعدادات', 'Failed to load settings')}
          description={error?.message}
          actionLabel={tr(isArabic, 'إعادة المحاولة', 'Retry')}
          onAction={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الإعدادات', 'Settings')}
        description={tr(
          isArabic,
          'إعدادات النظام العامة المحفوظة في قاعدة البيانات.',
          'General system settings persisted in the database.'
        )}
      />
      <SectionCard
        title={tr(isArabic, 'إعدادات النظام', 'System settings')}
        actions={
          <Button type="button" variant="primary" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending
              ? tr(isArabic, 'جارٍ الحفظ…', 'Saving…')
              : tr(isArabic, 'حفظ', 'Save')}
          </Button>
        }
      >
        <div className="admin-settings-grid">
          <TextField
            id="sys-name"
            label={tr(isArabic, 'اسم المنصة', 'Platform name')}
            value={form.platform_name}
            onChange={(e) => setForm((f) => ({ ...f, platform_name: e.target.value }))}
          />
          <TextField
            id="sys-timezone"
            label={tr(isArabic, 'المنطقة الزمنية', 'Time zone')}
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
          <FormSelect
            id="sys-locale"
            label={tr(isArabic, 'لغة الواجهة الافتراضية', 'Default interface language')}
            value={form.default_locale}
            onChange={(e) => setForm((f) => ({ ...f, default_locale: e.target.value }))}
          >
            <option value="ar">{tr(isArabic, 'العربية (RTL)', 'Arabic (RTL)')}</option>
            <option value="en">{tr(isArabic, 'English (LTR)', 'English (LTR)')}</option>
          </FormSelect>
          <TextField
            id="sys-support-email"
            label={tr(isArabic, 'بريد الدعم', 'Support email')}
            type="email"
            value={form.support_email}
            onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
          />
          <FormSelect
            id="ui-locale"
            label={tr(isArabic, 'لغة واجهتك الحالية', 'Your current UI language')}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            <option value="ar">{tr(isArabic, 'العربية', 'Arabic')}</option>
            <option value="en">English</option>
          </FormSelect>
        </div>
        {saveMessage ? <p className="text-muted mt-3">{saveMessage}</p> : null}
      </SectionCard>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, Save, Settings } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { FormSwitch } from '../../components/forms/index.js';
import { useLocale, useTr } from '../../features/locale/index.js';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../../features/notifications/notifications.service.js';
import { notificationsKeys } from '../../features/notifications/hooks/notificationsQueryKeys.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { getNotificationsPathForUser } from '../../utils/notificationsPath.js';
import { useAuth } from '../../features/auth/index.js';
import { cn } from '../../utils/helpers.js';
import {
  CRITICAL_PREFERENCE_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  PREFERENCE_CHANNELS,
  categoryLabel,
  channelLabel,
} from '../admin/contentHub/notificationAdmin.shared.js';

function preferenceKey(category, channel) {
  return `${category}::${channel}`;
}

export function NotificationPreferencesPage() {
  const t = useTr();
  const { isArabic } = useLocale();
  const { user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const isStudentPortal = location.pathname.startsWith('/student');
  const PageHeader = isStudentPortal ? StudentPageHeader : AdminPageHeader;
  const notifPath = getNotificationsPathForUser(user);

  const [matrix, setMatrix] = useState({});
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const prefsQuery = useQuery({
    queryKey: notificationsKeys.preferences(),
    queryFn: fetchNotificationPreferences,
  });

  const saveMut = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.preferences() });
      setOkMsg(t('تم حفظ التفضيلات', 'Preferences saved'));
    },
  });

  const categories = prefsQuery.data?.categories?.length
    ? prefsQuery.data.categories
    : NOTIFICATION_CATEGORIES;
  const channels = PREFERENCE_CHANNELS;

  useEffect(() => {
    const data = prefsQuery.data;
    if (!data) return;
    const cats = data.categories?.length ? data.categories : NOTIFICATION_CATEGORIES;
    const rows = data.preferences || [];
    const next = {};
    for (const cat of cats) {
      for (const ch of PREFERENCE_CHANNELS) {
        const found = rows.find(
          (r) => r.notification_category === cat && String(r.channel).toUpperCase() === ch
        );
        next[preferenceKey(cat, ch)] = found ? Boolean(found.is_enabled) : true;
      }
    }
    setMatrix(next);
  }, [prefsQuery.data]);

  const isCriticalCategory = (cat) => CRITICAL_PREFERENCE_CATEGORIES.includes(String(cat).toUpperCase());

  const dirtyPayload = useMemo(() => {
    const preferences = [];
    for (const cat of categories) {
      for (const ch of channels) {
        preferences.push({
          notification_category: cat,
          channel: ch,
          is_enabled: Boolean(matrix[preferenceKey(cat, ch)]),
        });
      }
    }
    return { preferences };
  }, [matrix, categories, channels]);

  async function onSave(e) {
    e.preventDefault();
    setError('');
    setOkMsg('');
    try {
      await saveMut.mutateAsync(dirtyPayload);
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر حفظ التفضيلات', 'Could not save preferences')));
    }
  }

  function setEnabled(cat, ch, enabled) {
    if (isCriticalCategory(cat) && !enabled) return;
    setMatrix((m) => ({ ...m, [preferenceKey(cat, ch)]: enabled }));
  }

  return (
    <div className={cn('page page--dashboard', isStudentPortal ? 'page--student' : 'page--admin')}>
      <PageHeader
        title={t('تفضيلات الإشعارات', 'Notification preferences')}
        description={t(
          'تحكم في قنوات البريد والإشعارات الفورية لكل تصنيف',
          'Control email and push channels per notification category'
        )}
        actions={
          <Link className="btn btn--outline" to={notifPath}>
            <Bell size={16} aria-hidden /> {t('عرض الإشعارات', 'View notifications')}
          </Link>
        }
      />

      <p className="crud-muted" style={{ marginBottom: '1rem' }}>
        {t(
          'الإشعارات الحرجة (مثل الحساب والنظام) لا يمكن تعطيلها بالكامل لضمان وصول التنبيهات المهمة.',
          'Critical notifications (such as account and system) cannot be fully disabled so important alerts still reach you.'
        )}
      </p>

      {error ? <p className="form-error">{error}</p> : null}
      {okMsg ? <p className="crud-muted" role="status">{okMsg}</p> : null}

      {prefsQuery.isLoading ? (
        <LoadingSpinner />
      ) : prefsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(prefsQuery.error)}</p>
      ) : (
        <form onSubmit={onSave}>
          <SectionCard title={t('التصنيفات والقنوات', 'Categories & channels')}>
            <div className="notif-prefs-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('التصنيف', 'Category')}</th>
                    {channels.map((ch) => (
                      <th key={ch}>{channelLabel(ch, isArabic)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const locked = isCriticalCategory(cat);
                    return (
                      <tr key={cat}>
                        <td>
                          {categoryLabel(cat, isArabic)}
                          {locked ? (
                            <span className="notif-badge notif-badge--type" style={{ marginInlineStart: '0.5rem' }}>
                              {t('حرج', 'Critical')}
                            </span>
                          ) : null}
                        </td>
                        {channels.map((ch) => {
                          const key = preferenceKey(cat, ch);
                          return (
                            <td key={ch}>
                              <FormSwitch
                                id={`pref-${cat}-${ch}`}
                                label=""
                                checked={Boolean(matrix[key])}
                                disabled={locked}
                                onChange={(e) => setEnabled(cat, ch, e.target.checked)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Button type="submit" variant="primary" disabled={saveMut.isPending}>
              <Save size={16} aria-hidden /> {t('حفظ التفضيلات', 'Save preferences')}
            </Button>
            <Link className="btn btn--outline" to={notifPath}>
              <ArrowRight size={16} aria-hidden /> {t('رجوع', 'Back')}
            </Link>
          </div>
        </form>
      )}

      <p className="crud-muted" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Settings size={14} aria-hidden />
        {t(
          'إشعارات داخل التطبيق والجرس تبقى مفعّلة للإشعارات الحرجة.',
          'In-app and bell channels stay enabled for critical notifications.'
        )}
      </p>
    </div>
  );
}

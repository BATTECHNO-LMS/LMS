import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BarChart3,
  Bell,
  ListTree,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
  StatusBadge,
} from '../../../components/admin/index.js';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { FormInput, FormSelect, FormSwitch, FormTextarea } from '../../../components/forms/index.js';
import { useLocale, useTr } from '../../../features/locale/index.js';
import {
  activateAdminNotificationRule,
  archiveAdminNotificationRule,
  createAdminNotificationRule,
  createAdminNotificationTemplate,
  fetchAdminNotificationAnalytics,
  fetchAdminNotificationDeliveries,
  fetchAdminNotificationFailures,
  fetchAdminNotificationRules,
  fetchAdminNotificationTemplates,
  fetchNotificationCatalog,
  pauseAdminNotificationRule,
  previewAdminNotificationSend,
  retryAdminNotificationDelivery,
  sendAdminNotification,
  updateAdminNotificationRule,
  updateAdminNotificationTemplate,
} from '../../../features/notificationAdmin/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { ROLE_LABELS } from './contentHub.shared.js';
import {
  AGGREGATION_MODES,
  DELIVERY_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_ROLE_OPTIONS,
  NOTIFICATION_RULE_STATUSES,
  categoryLabel,
  channelLabel,
  deliveryStatusVariant,
  formatDate,
  priorityLabel,
  priorityVariant,
  ruleStatusVariant,
  statusLabel,
} from './notificationAdmin.shared.js';

const TABS = [
  { id: 'rules', path: '/admin/content-hub/notifications', icon: ListTree },
  { id: 'send', path: '/admin/content-hub/notifications/send', icon: Send },
  { id: 'deliveries', path: '/admin/content-hub/notifications/deliveries', icon: Bell },
  { id: 'analytics', path: '/admin/content-hub/notifications/analytics', icon: BarChart3 },
];

const emptyRuleForm = {
  name_ar: '',
  name_en: '',
  event_type: '',
  category: '',
  priority: 'NORMAL',
  target_roles: [],
  channels: ['IN_APP', 'NOTIFICATION_CENTER', 'BELL'],
  is_critical: false,
  requires_acknowledgement: false,
  is_immediate: true,
  aggregation_mode: 'NONE',
  user_can_disable: true,
  delay_seconds: 0,
  status: 'DRAFT',
};

const emptyTemplateForm = {
  id: null,
  rule_id: '',
  role_code: 'student',
  channel: 'IN_APP',
  title_template: '',
  body_template: '',
  action_label_template: '',
  action_url_template: '',
  locale: 'ar',
  status: 'ACTIVE',
};

const emptySendForm = {
  event_type: '',
  title: '',
  body: '',
  action_url: '',
  action_label: '',
  target_roles: [],
};

function tabFromPath(pathname) {
  if (pathname.endsWith('/send')) return 'send';
  if (pathname.endsWith('/deliveries')) return 'deliveries';
  if (pathname.endsWith('/analytics')) return 'analytics';
  return 'rules';
}

export function NotificationRulesPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeTab = tabFromPath(location.pathname);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [showTemplate, setShowTemplate] = useState(false);
  const [sendForm, setSendForm] = useState(emptySendForm);
  const [previewCount, setPreviewCount] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const catalogQuery = useQuery({
    queryKey: ['admin', 'notification-rules', 'catalog'],
    queryFn: fetchNotificationCatalog,
  });

  const rulesQuery = useQuery({
    queryKey: ['admin', 'notification-rules', status, category, q],
    queryFn: () =>
      fetchAdminNotificationRules({
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        page_size: 50,
      }),
    enabled: activeTab === 'rules',
  });

  const templatesQuery = useQuery({
    queryKey: ['admin', 'notification-templates', editing?.id],
    queryFn: () => fetchAdminNotificationTemplates({ rule_id: editing.id, page_size: 50 }),
    enabled: Boolean(editing?.id),
  });

  const deliveriesQuery = useQuery({
    queryKey: ['admin', 'notification-deliveries', deliveryStatus, failuresOnly],
    queryFn: () =>
      failuresOnly
        ? fetchAdminNotificationFailures({ page_size: 50 })
        : fetchAdminNotificationDeliveries({
            ...(deliveryStatus ? { status: deliveryStatus } : {}),
            page_size: 50,
          }),
    enabled: activeTab === 'deliveries',
  });

  const analyticsQuery = useQuery({
    queryKey: ['admin', 'notification-analytics'],
    queryFn: () => fetchAdminNotificationAnalytics(),
    enabled: activeTab === 'analytics',
  });

  const saveRuleMut = useMutation({
    mutationFn: (body) =>
      editing?.id ? updateAdminNotificationRule(editing.id, body) : createAdminNotificationRule(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'notification-rules'] });
      const rule = data?.rule || data;
      if (rule?.id) {
        setEditing(rule);
        setOkMsg(t('تم حفظ القاعدة', 'Rule saved'));
      } else {
        setEditing(null);
        setForm(emptyRuleForm);
      }
    },
  });

  const saveTemplateMut = useMutation({
    mutationFn: (body) =>
      templateForm.id
        ? updateAdminNotificationTemplate(templateForm.id, body)
        : createAdminNotificationTemplate(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notification-templates'] });
      qc.invalidateQueries({ queryKey: ['admin', 'notification-rules'] });
      setOkMsg(t('تم حفظ القالب', 'Template saved'));
    },
  });

  const activateMut = useMutation({
    mutationFn: activateAdminNotificationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-rules'] }),
  });
  const pauseMut = useMutation({
    mutationFn: pauseAdminNotificationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-rules'] }),
  });
  const archiveMut = useMutation({
    mutationFn: archiveAdminNotificationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-rules'] }),
  });
  const retryMut = useMutation({
    mutationFn: retryAdminNotificationDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-deliveries'] }),
  });
  const previewMut = useMutation({
    mutationFn: previewAdminNotificationSend,
    onSuccess: (data) => setPreviewCount(data?.recipient_count ?? 0),
  });
  const sendMut = useMutation({
    mutationFn: sendAdminNotification,
    onSuccess: (data) => {
      setOkMsg(
        t(
          `تم الإرسال إلى ${data?.recipient_count ?? 0} مستلم`,
          `Sent to ${data?.recipient_count ?? 0} recipients`
        )
      );
      setPreviewCount(null);
    },
  });

  const catalog = catalogQuery.data || {};
  const events = catalog.events || [];
  const categories = catalog.categories?.length ? catalog.categories : NOTIFICATION_CATEGORIES;
  const channels = catalog.channels?.length ? catalog.channels : NOTIFICATION_CHANNELS;
  const priorities = catalog.priorities?.length ? catalog.priorities : NOTIFICATION_PRIORITIES;
  const templateVars = catalog.allowed_template_vars || [];

  const rows = useMemo(() => rulesQuery.data?.rules ?? [], [rulesQuery.data]);
  const deliveries = useMemo(() => deliveriesQuery.data?.deliveries ?? [], [deliveriesQuery.data]);
  const templates = useMemo(() => templatesQuery.data?.templates ?? [], [templatesQuery.data]);
  const analytics = analyticsQuery.data?.analytics || analyticsQuery.data || {};

  useEffect(() => {
    setError('');
    setOkMsg('');
  }, [activeTab]);

  async function run(fn) {
    setError('');
    setOkMsg('');
    try {
      await fn();
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر إكمال العملية', 'Action failed')));
    }
  }

  function openCreate() {
    setEditing({ id: null });
    setForm({ ...emptyRuleForm, event_type: events[0] || '' });
    setShowTemplate(false);
    setError('');
    setOkMsg('');
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name_ar: row.name_ar || '',
      name_en: row.name_en || '',
      event_type: row.event_type || '',
      category: row.category || '',
      priority: row.priority || 'NORMAL',
      target_roles: row.target_roles || [],
      channels: row.channels || ['IN_APP', 'NOTIFICATION_CENTER', 'BELL'],
      is_critical: Boolean(row.is_critical),
      requires_acknowledgement: Boolean(row.requires_acknowledgement),
      is_immediate: row.is_immediate !== false,
      aggregation_mode: row.aggregation_mode || 'NONE',
      user_can_disable: row.user_can_disable !== false,
      delay_seconds: row.delay_seconds ?? 0,
      status: row.status || 'DRAFT',
    });
    setShowTemplate(false);
    setError('');
    setOkMsg('');
  }

  function toggleRole(code) {
    setForm((f) => {
      const set = new Set(f.target_roles || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, target_roles: [...set] };
    });
  }

  function toggleChannel(code) {
    setForm((f) => {
      const set = new Set(f.channels || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, channels: [...set] };
    });
  }

  function toggleSendRole(code) {
    setSendForm((f) => {
      const set = new Set(f.target_roles || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, target_roles: [...set] };
    });
  }

  async function onSaveRule(e) {
    e.preventDefault();
    const body = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en?.trim() || null,
      event_type: form.event_type,
      ...(form.category ? { category: form.category } : {}),
      priority: form.priority,
      target_roles: form.target_roles,
      channels: form.channels.length ? form.channels : ['IN_APP'],
      is_critical: Boolean(form.is_critical),
      requires_acknowledgement: Boolean(form.requires_acknowledgement),
      is_immediate: Boolean(form.is_immediate),
      aggregation_mode: form.aggregation_mode,
      user_can_disable: Boolean(form.user_can_disable),
      delay_seconds: Number(form.delay_seconds) || 0,
      status: form.status,
    };
    await run(() => saveRuleMut.mutateAsync(body));
  }

  function openNewTemplate() {
    if (!editing?.id) return;
    setTemplateForm({ ...emptyTemplateForm, rule_id: editing.id });
    setShowTemplate(true);
  }

  function openEditTemplate(tpl) {
    setTemplateForm({
      id: tpl.id,
      rule_id: tpl.rule_id,
      role_code: tpl.role_code,
      channel: tpl.channel,
      title_template: tpl.title_template || '',
      body_template: tpl.body_template || '',
      action_label_template: tpl.action_label_template || '',
      action_url_template: tpl.action_url_template || '',
      locale: tpl.locale || 'ar',
      status: tpl.status || 'ACTIVE',
    });
    setShowTemplate(true);
  }

  async function onSaveTemplate(e) {
    e.preventDefault();
    const body = {
      ...(templateForm.id ? {} : { rule_id: templateForm.rule_id || editing.id }),
      role_code: templateForm.role_code,
      channel: templateForm.channel,
      title_template: templateForm.title_template.trim(),
      body_template: templateForm.body_template.trim(),
      action_label_template: templateForm.action_label_template?.trim() || null,
      action_url_template: templateForm.action_url_template?.trim() || null,
      locale: templateForm.locale || 'ar',
      status: templateForm.status,
    };
    await run(() => saveTemplateMut.mutateAsync(body));
  }

  async function onPreviewSend() {
    const body = buildSendBody(sendForm);
    await run(() => previewMut.mutateAsync(body));
  }

  async function onSend(e) {
    e.preventDefault();
    const body = buildSendBody(sendForm);
    await run(() => sendMut.mutateAsync(body));
  }

  function buildSendBody(f) {
    return {
      event_type: f.event_type,
      title: f.title.trim(),
      body: f.body?.trim() || null,
      action_url: f.action_url?.trim() || null,
      action_label: f.action_label?.trim() || null,
      ...(f.target_roles?.length ? { target_roles: f.target_roles } : {}),
    };
  }

  const tabLabels = {
    rules: t('قواعد', 'Rules'),
    send: t('إرسال', 'Send'),
    deliveries: t('سجل', 'Deliveries'),
    analytics: t('إحصائيات', 'Analytics'),
  };

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={t('إدارة الإشعارات والقواعد', 'Notification rules')}
        description={t(
          'قواعد الأحداث والقوالب والإرسال اليدوي وسجل التسليم',
          'Event rules, templates, manual send, and delivery log'
        )}
      />

      <div className="notif-toolbar" role="tablist" aria-label={t('أقسام الإشعارات', 'Notification sections')}>
        <div className="notif-chips">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`notif-chip${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                <Icon size={14} aria-hidden /> {tabLabels[tab.id]}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {okMsg ? <p className="crud-muted" role="status">{okMsg}</p> : null}

      {activeTab === 'rules' ? (
        <>
          <AdminActionBar>
            <Button type="button" variant="primary" onClick={openCreate}>
              <Plus size={18} aria-hidden /> {t('قاعدة جديدة', 'New rule')}
            </Button>
            <Link className="btn btn--outline" to="/admin/content-hub/notifications/send">
              <Send size={16} aria-hidden /> {t('إرسال إشعار', 'Send notification')}
            </Link>
          </AdminActionBar>

          <AdminFilterBar>
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('بحث…', 'Search…')}
              aria-label={t('بحث', 'Search')}
            />
            <SelectField
              id="nr-status"
              label={t('الحالة', 'Status')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t('كل الحالات', 'All statuses')}</option>
              {NOTIFICATION_RULE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, isArabic)}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="nr-category"
              label={t('التصنيف', 'Category')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t('كل التصنيفات', 'All categories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, isArabic)}
                </option>
              ))}
            </SelectField>
          </AdminFilterBar>

          <SectionCard title={t('القواعد', 'Rules')}>
            {rulesQuery.isLoading ? (
              <LoadingSpinner />
            ) : (
              <DataTable
                emptyTitle={t('لا توجد قواعد', 'No rules')}
                emptyDescription={
                  rulesQuery.isError
                    ? getApiErrorMessage(rulesQuery.error)
                    : t('أنشئ قاعدة إشعار جديدة', 'Create a notification rule')
                }
                columns={[
                  {
                    key: 'name_ar',
                    label: t('الاسم', 'Name'),
                    render: (r) => (isArabic ? r.name_ar : r.name_en || r.name_ar),
                  },
                  { key: 'event_type', label: t('الحدث', 'Event') },
                  {
                    key: 'status',
                    label: t('الحالة', 'Status'),
                    render: (r) => (
                      <StatusBadge variant={ruleStatusVariant(r.status)}>
                        {statusLabel(r.status, isArabic)}
                      </StatusBadge>
                    ),
                  },
                  {
                    key: 'category',
                    label: t('التصنيف', 'Category'),
                    render: (r) => categoryLabel(r.category, isArabic),
                  },
                  {
                    key: 'priority',
                    label: t('الأولوية', 'Priority'),
                    render: (r) => (
                      <StatusBadge variant={priorityVariant(r.priority)}>
                        {priorityLabel(r.priority, isArabic)}
                      </StatusBadge>
                    ),
                  },
                  {
                    key: 'channels',
                    label: t('القنوات', 'Channels'),
                    render: (r) =>
                      (r.channels || []).map((c) => channelLabel(c, isArabic)).join(' · ') || '—',
                  },
                  {
                    key: 'is_critical',
                    label: t('حرج', 'Critical'),
                    render: (r) =>
                      r.is_critical ? t('نعم', 'Yes') : t('لا', 'No'),
                  },
                  {
                    key: 'actions',
                    label: t('الإجراءات', 'Actions'),
                    render: (r) => {
                      const st = String(r.status || '').toUpperCase();
                      return (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <Button type="button" variant="outline" onClick={() => openEdit(r)} title={t('تعديل', 'Edit')}>
                            <Pencil size={16} aria-hidden />
                          </Button>
                          {st !== 'ACTIVE' && st !== 'ARCHIVED' ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => run(() => activateMut.mutateAsync(r.id))}
                              title={t('تفعيل', 'Activate')}
                            >
                              <Play size={16} aria-hidden />
                            </Button>
                          ) : null}
                          {st === 'ACTIVE' ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => run(() => pauseMut.mutateAsync(r.id))}
                              title={t('إيقاف', 'Pause')}
                            >
                              <Pause size={16} aria-hidden />
                            </Button>
                          ) : null}
                          {st !== 'ARCHIVED' ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => run(() => archiveMut.mutateAsync(r.id))}
                              title={t('أرشفة', 'Archive')}
                            >
                              <Archive size={16} aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                      );
                    },
                  },
                ]}
                rows={rows}
              />
            )}
          </SectionCard>

          {editing ? (
            <SectionCard
              title={editing.id ? t('تعديل القاعدة', 'Edit rule') : t('قاعدة جديدة', 'New rule')}
            >
              <form className="form-grid" onSubmit={onSaveRule}>
                <FormInput
                  id="nr-name-ar"
                  label={t('الاسم (عربي)', 'Name (Arabic)')}
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  required
                />
                <FormInput
                  id="nr-name-en"
                  label={t('الاسم (إنجليزي)', 'Name (English)')}
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
                <FormSelect
                  id="nr-event"
                  label={t('نوع الحدث', 'Event type')}
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                  required
                >
                  <option value="">{t('اختر حدثاً', 'Select event')}</option>
                  {events.map((ev) => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="nr-cat"
                  label={t('التصنيف', 'Category')}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">{t('تلقائي من الحدث', 'From event')}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, isArabic)}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="nr-pri"
                  label={t('الأولوية', 'Priority')}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p, isArabic)}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="nr-st"
                  label={t('الحالة', 'Status')}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {NOTIFICATION_RULE_STATUSES.filter((s) => s !== 'ARCHIVED').map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, isArabic)}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="nr-agg"
                  label={t('التجميع', 'Aggregation')}
                  value={form.aggregation_mode}
                  onChange={(e) => setForm((f) => ({ ...f, aggregation_mode: e.target.value }))}
                >
                  {AGGREGATION_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  id="nr-delay"
                  type="number"
                  min={0}
                  label={t('تأخير (ثوانٍ)', 'Delay (seconds)')}
                  value={form.delay_seconds}
                  onChange={(e) => setForm((f) => ({ ...f, delay_seconds: e.target.value }))}
                />

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="form-field__label">{t('الأدوار المستهدفة', 'Target roles')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {NOTIFICATION_ROLE_OPTIONS.map((code) => (
                      <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={(form.target_roles || []).includes(code)}
                          onChange={() => toggleRole(code)}
                        />
                        {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code] || code}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="form-field__label">{t('القنوات', 'Channels')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {channels.map((code) => (
                      <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={(form.channels || []).includes(code)}
                          onChange={() => toggleChannel(code)}
                        />
                        {channelLabel(code, isArabic)}
                      </label>
                    ))}
                  </div>
                </div>

                <FormSwitch
                  id="nr-critical"
                  label={t('إشعار حرج', 'Critical notification')}
                  checked={form.is_critical}
                  onChange={(e) => setForm((f) => ({ ...f, is_critical: e.target.checked }))}
                />
                <FormSwitch
                  id="nr-ack"
                  label={t('يتطلب إقراراً', 'Requires acknowledgement')}
                  checked={form.requires_acknowledgement}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, requires_acknowledgement: e.target.checked }))
                  }
                />
                <FormSwitch
                  id="nr-imm"
                  label={t('فوري', 'Immediate')}
                  checked={form.is_immediate}
                  onChange={(e) => setForm((f) => ({ ...f, is_immediate: e.target.checked }))}
                />
                <FormSwitch
                  id="nr-disable"
                  label={t('يمكن للمستخدم تعطيله', 'User can disable')}
                  checked={form.user_can_disable}
                  onChange={(e) => setForm((f) => ({ ...f, user_can_disable: e.target.checked }))}
                />

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', gridColumn: '1 / -1' }}>
                  <Button type="submit" variant="primary" disabled={saveRuleMut.isPending}>
                    <Save size={16} aria-hidden /> {t('حفظ', 'Save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setForm(emptyRuleForm);
                      setShowTemplate(false);
                    }}
                  >
                    <X size={16} aria-hidden /> {t('إلغاء', 'Cancel')}
                  </Button>
                  {editing.id ? (
                    <Button type="button" variant="outline" onClick={openNewTemplate}>
                      <Plus size={16} aria-hidden /> {t('قالب للدور', 'Role template')}
                    </Button>
                  ) : null}
                </div>
              </form>

              {editing.id ? (
                <div style={{ marginTop: '1.25rem' }}>
                  <h3 className="section-card__subtitle" style={{ marginBottom: '0.75rem' }}>
                    {t('قوالب الأدوار', 'Role templates')}
                  </h3>
                  {templatesQuery.isFetching && !templates.length ? <LoadingSpinner /> : null}
                  <DataTable
                    emptyTitle={t('لا توجد قوالب', 'No templates')}
                    emptyDescription={t('أضف قالباً لكل دور', 'Add a template per role')}
                    columns={[
                      { key: 'role_code', label: t('الدور', 'Role') },
                      {
                        key: 'channel',
                        label: t('القناة', 'Channel'),
                        render: (r) => channelLabel(r.channel, isArabic),
                      },
                      { key: 'title_template', label: t('العنوان', 'Title') },
                      { key: 'status', label: t('الحالة', 'Status') },
                      {
                        key: 'actions',
                        label: t('الإجراءات', 'Actions'),
                        render: (r) => (
                          <Button type="button" variant="outline" onClick={() => openEditTemplate(r)}>
                            <Pencil size={16} aria-hidden />
                          </Button>
                        ),
                      },
                    ]}
                    rows={templates.length ? templates : editing.templates || []}
                  />
                </div>
              ) : null}

              {showTemplate && editing.id ? (
                <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={onSaveTemplate}>
                  <FormSelect
                    id="tpl-role"
                    label={t('الدور', 'Role')}
                    value={templateForm.role_code}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, role_code: e.target.value }))}
                  >
                    {NOTIFICATION_ROLE_OPTIONS.map((code) => (
                      <option key={code} value={code}>
                        {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code] || code}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    id="tpl-ch"
                    label={t('القناة', 'Channel')}
                    value={templateForm.channel}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, channel: e.target.value }))}
                  >
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {channelLabel(c, isArabic)}
                      </option>
                    ))}
                  </FormSelect>
                  <FormInput
                    id="tpl-title"
                    label={t('قالب العنوان', 'Title template')}
                    value={templateForm.title_template}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, title_template: e.target.value }))}
                    required
                    placeholder="{{student_name}}"
                  />
                  <FormTextarea
                    id="tpl-body"
                    label={t('قالب النص', 'Body template')}
                    value={templateForm.body_template}
                    onChange={(e) => setTemplateForm((f) => ({ ...f, body_template: e.target.value }))}
                    rows={4}
                    required
                  />
                  <FormInput
                    id="tpl-alabel"
                    label={t('قالب زر الإجراء', 'Action label template')}
                    value={templateForm.action_label_template}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, action_label_template: e.target.value }))
                    }
                  />
                  <FormInput
                    id="tpl-aurl"
                    label={t('قالب رابط الإجراء', 'Action URL template')}
                    value={templateForm.action_url_template}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, action_url_template: e.target.value }))
                    }
                  />
                  {templateVars.length ? (
                    <p className="crud-muted" style={{ gridColumn: '1 / -1' }}>
                      {t('متغيرات متاحة', 'Available vars')}:{' '}
                      {templateVars.map((v) => `{{${v}}}`).join(' · ')}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button type="submit" variant="primary" disabled={saveTemplateMut.isPending}>
                      <Save size={16} aria-hidden /> {t('حفظ القالب', 'Save template')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowTemplate(false)}>
                      <X size={16} aria-hidden /> {t('إغلاق', 'Close')}
                    </Button>
                  </div>
                </form>
              ) : null}
            </SectionCard>
          ) : null}
        </>
      ) : null}

      {activeTab === 'send' ? (
        <SectionCard title={t('إرسال إشعار يدوي', 'Manual notification send')}>
          <form className="form-grid" onSubmit={onSend}>
            <FormSelect
              id="send-event"
              label={t('نوع الحدث', 'Event type')}
              value={sendForm.event_type}
              onChange={(e) => {
                setSendForm((f) => ({ ...f, event_type: e.target.value }));
                setPreviewCount(null);
              }}
              required
            >
              <option value="">{t('اختر حدثاً', 'Select event')}</option>
              {events.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="send-title"
              label={t('العنوان', 'Title')}
              value={sendForm.title}
              onChange={(e) => setSendForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <FormTextarea
              id="send-body"
              label={t('النص', 'Body')}
              value={sendForm.body}
              onChange={(e) => setSendForm((f) => ({ ...f, body: e.target.value }))}
              rows={4}
            />
            <FormInput
              id="send-alabel"
              label={t('نص الإجراء', 'Action label')}
              value={sendForm.action_label}
              onChange={(e) => setSendForm((f) => ({ ...f, action_label: e.target.value }))}
            />
            <FormInput
              id="send-aurl"
              label={t('رابط الإجراء', 'Action URL')}
              value={sendForm.action_url}
              onChange={(e) => setSendForm((f) => ({ ...f, action_url: e.target.value }))}
            />
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span className="form-field__label">{t('تصفية الأدوار (اختياري)', 'Filter roles (optional)')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {NOTIFICATION_ROLE_OPTIONS.map((code) => (
                  <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={(sendForm.target_roles || []).includes(code)}
                      onChange={() => {
                        toggleSendRole(code);
                        setPreviewCount(null);
                      }}
                    />
                    {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code] || code}
                  </label>
                ))}
              </div>
            </div>
            {previewCount != null ? (
              <p className="crud-muted" style={{ gridColumn: '1 / -1' }}>
                {t(`عدد المستلمين المتوقع: ${previewCount}`, `Estimated recipients: ${previewCount}`)}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="outline"
                disabled={previewMut.isPending || !sendForm.event_type || !sendForm.title.trim()}
                onClick={onPreviewSend}
              >
                {t('معاينة العدد', 'Preview count')}
              </Button>
              <Button type="submit" variant="primary" disabled={sendMut.isPending}>
                <Send size={16} aria-hidden /> {t('إرسال', 'Send')}
              </Button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {activeTab === 'deliveries' ? (
        <>
          <AdminFilterBar>
            <SelectField
              id="del-status"
              label={t('الحالة', 'Status')}
              value={deliveryStatus}
              onChange={(e) => {
                setDeliveryStatus(e.target.value);
                setFailuresOnly(false);
              }}
              disabled={failuresOnly}
            >
              <option value="">{t('الكل', 'All')}</option>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={failuresOnly}
                onChange={(e) => setFailuresOnly(e.target.checked)}
              />
              {t('الإخفاقات فقط', 'Failures only')}
            </label>
          </AdminFilterBar>
          <SectionCard title={t('سجل التسليم', 'Delivery log')}>
            {deliveriesQuery.isLoading ? (
              <LoadingSpinner />
            ) : (
              <DataTable
                emptyTitle={t('لا توجد سجلات', 'No deliveries')}
                emptyDescription={
                  deliveriesQuery.isError
                    ? getApiErrorMessage(deliveriesQuery.error)
                    : t('لا توجد عمليات تسليم بعد', 'No delivery records yet')
                }
                columns={[
                  {
                    key: 'created_at',
                    label: t('الوقت', 'Time'),
                    render: (r) => formatDate(r.created_at, locale),
                  },
                  {
                    key: 'title',
                    label: t('العنوان', 'Title'),
                    render: (r) => r.notification?.title || '—',
                  },
                  {
                    key: 'event_type',
                    label: t('الحدث', 'Event'),
                    render: (r) => r.notification?.event_type || '—',
                  },
                  {
                    key: 'channel',
                    label: t('القناة', 'Channel'),
                    render: (r) => channelLabel(r.channel, isArabic),
                  },
                  {
                    key: 'status',
                    label: t('الحالة', 'Status'),
                    render: (r) => (
                      <StatusBadge variant={deliveryStatusVariant(r.status)}>{r.status}</StatusBadge>
                    ),
                  },
                  {
                    key: 'failure',
                    label: t('الخطأ', 'Error'),
                    render: (r) => r.failure_message_safe || r.failure_code || '—',
                  },
                  {
                    key: 'actions',
                    label: t('الإجراءات', 'Actions'),
                    render: (r) =>
                      ['FAILED', 'SKIPPED', 'PENDING'].includes(String(r.status).toUpperCase()) ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={retryMut.isPending}
                          onClick={() => run(() => retryMut.mutateAsync(r.id))}
                          title={t('إعادة المحاولة', 'Retry')}
                        >
                          <RefreshCw size={16} aria-hidden />
                        </Button>
                      ) : (
                        '—'
                      ),
                  },
                ]}
                rows={deliveries}
              />
            )}
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'analytics' ? (
        <>
          {analyticsQuery.isLoading ? (
            <LoadingSpinner />
          ) : analyticsQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(analyticsQuery.error)}</p>
          ) : (
            <>
              <AdminStatsGrid>
                <StatCard
                  label={t('إجمالي الإشعارات', 'Total notifications')}
                  value={String(analytics.total_notifications ?? 0)}
                  icon={Bell}
                />
                <StatCard
                  label={t('غير المقروءة', 'Unread')}
                  value={String(analytics.unread ?? 0)}
                  icon={Bell}
                />
                <StatCard
                  label={t('حرجة', 'Critical')}
                  value={String(analytics.critical ?? 0)}
                  icon={Bell}
                />
                <StatCard
                  label={t('تسليم ناجح', 'Successful deliveries')}
                  value={String(analytics.successful_deliveries ?? 0)}
                  icon={Send}
                />
                <StatCard
                  label={t('إخفاقات التسليم', 'Failed deliveries')}
                  value={String(analytics.failed_deliveries ?? 0)}
                  icon={Archive}
                />
              </AdminStatsGrid>
              <SectionCard title={t('حسب التصنيف', 'By category')}>
                <DataTable
                  emptyTitle={t('لا توجد بيانات', 'No data')}
                  emptyDescription=""
                  columns={[
                    {
                      key: 'category',
                      label: t('التصنيف', 'Category'),
                      render: (r) => categoryLabel(r.category, isArabic),
                    },
                    { key: 'count', label: t('العدد', 'Count') },
                  ]}
                  rows={analytics.by_category || []}
                />
              </SectionCard>
              <SectionCard title={t('حسب الأولوية', 'By priority')}>
                <DataTable
                  emptyTitle={t('لا توجد بيانات', 'No data')}
                  emptyDescription=""
                  columns={[
                    {
                      key: 'priority',
                      label: t('الأولوية', 'Priority'),
                      render: (r) => priorityLabel(r.priority, isArabic),
                    },
                    { key: 'count', label: t('العدد', 'Count') },
                  ]}
                  rows={analytics.by_priority || []}
                />
              </SectionCard>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export function NotificationSendPage() {
  return <NotificationRulesPage />;
}

export function NotificationDeliveriesPage() {
  return <NotificationRulesPage />;
}

export function NotificationAnalyticsPage() {
  return <NotificationRulesPage />;
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, Pause, Pencil, Plus, Save, Send, X } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  SectionCard,
  SearchInput,
  SelectField,
  StatusBadge,
} from '../../../components/admin/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { FormInput, FormSelect, FormSwitch, FormTextarea } from '../../../components/forms/index.js';
import { useLocale, useTr } from '../../../features/locale/index.js';
import {
  archiveAdminAnnouncement,
  createAdminAnnouncement,
  duplicateAdminAnnouncement,
  fetchAdminAnnouncements,
  pauseAdminAnnouncement,
  publishAdminAnnouncement,
  scheduleAdminAnnouncement,
  updateAdminAnnouncement,
} from '../../../features/announcements/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TYPES,
  CHANNEL_CODES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  contentStatusVariant,
  formatDate,
  statusLabel,
} from './contentHub.shared.js';

const STEPS = ['content', 'audience', 'channels', 'schedule', 'ack', 'preview'];

const emptyForm = {
  admin_name: '',
  title_ar: '',
  summary_ar: '',
  content_ar: '',
  announcement_type: 'INFORMATION',
  priority: 100,
  starts_at: '',
  ends_at: '',
  timezone: 'Asia/Amman',
  is_dismissible: true,
  requires_acknowledgement: false,
  blocks_usage: false,
  is_pinned: false,
  cta_label: '',
  cta_url: '',
  target_type: 'ALL_USERS',
  role_code: 'student',
  channels: ['DASHBOARD_CARD', 'NOTIFICATION_CENTER'],
};

function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function buildBody(form) {
  const target =
    form.target_type === 'ROLE'
      ? { target_type: 'ROLE', role_code: form.role_code }
      : { target_type: 'ALL_USERS' };
  return {
    admin_name: form.admin_name.trim(),
    title_ar: form.title_ar.trim(),
    summary_ar: form.summary_ar?.trim() || null,
    content_ar: form.content_ar,
    announcement_type: form.announcement_type,
    priority: Number(form.priority) || 100,
    starts_at: fromDatetimeLocal(form.starts_at),
    ends_at: fromDatetimeLocal(form.ends_at),
    timezone: form.timezone || 'Asia/Amman',
    is_dismissible: Boolean(form.is_dismissible),
    requires_acknowledgement: Boolean(form.requires_acknowledgement),
    blocks_usage: Boolean(form.blocks_usage),
    is_pinned: Boolean(form.is_pinned),
    cta_label: form.cta_label?.trim() || null,
    cta_url: form.cta_url?.trim() || null,
    targets: [target],
    channels: (form.channels || []).map((channel_code) => ({ channel_code, is_enabled: true })),
  };
}

export function AnnouncementsPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'announcements', status, q],
    queryFn: () =>
      fetchAdminAnnouncements({
        ...(status ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        page_size: 50,
      }),
  });

  const saveMut = useMutation({
    mutationFn: (body) => (editingId ? updateAdminAnnouncement(editingId, body) : createAdminAnnouncement(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      setWizardOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setStepIdx(0);
    },
  });

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  const stepLabels = {
    content: t('المحتوى', 'Content'),
    audience: t('الجمهور', 'Audience'),
    channels: t('القنوات', 'Channels'),
    schedule: t('الجدولة', 'Schedule'),
    ack: t('الإقرار', 'Acknowledgement'),
    preview: t('معاينة', 'Preview'),
  };

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setStepIdx(0);
    setWizardOpen(true);
    setError('');
  }

  function openEdit(row) {
    const firstTarget = (row.targets || [])[0];
    setEditingId(row.id);
    setForm({
      admin_name: row.admin_name || '',
      title_ar: row.title_ar || '',
      summary_ar: row.summary_ar || '',
      content_ar: row.content_ar || '',
      announcement_type: row.announcement_type || 'INFORMATION',
      priority: row.priority ?? 100,
      starts_at: toDatetimeLocal(row.starts_at),
      ends_at: toDatetimeLocal(row.ends_at),
      timezone: row.timezone || 'Asia/Amman',
      is_dismissible: row.is_dismissible !== false,
      requires_acknowledgement: Boolean(row.requires_acknowledgement),
      blocks_usage: Boolean(row.blocks_usage),
      is_pinned: Boolean(row.is_pinned),
      cta_label: row.cta_label || '',
      cta_url: row.cta_url || '',
      target_type: firstTarget?.target_type || 'ALL_USERS',
      role_code: firstTarget?.role_code || 'student',
      channels: (row.channels || []).filter((c) => c.is_enabled !== false).map((c) => c.channel_code),
      version: row.version,
      updated_at: row.updated_at,
    });
    setStepIdx(0);
    setWizardOpen(true);
    setError('');
  }

  function toggleChannel(code) {
    setForm((f) => {
      const set = new Set(f.channels || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, channels: [...set] };
    });
  }

  async function run(fn) {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر إكمال العملية', 'Action failed')));
    }
  }

  async function onSave() {
    const body = buildBody(form);
    if (editingId) {
      if (form.version != null) body.version = form.version;
      if (form.updated_at) body.updated_at = form.updated_at;
    }
    await run(() => saveMut.mutateAsync(body));
  }

  const currentStep = STEPS[stepIdx];

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={t('الإعلانات والتنبيهات', 'Announcements & alerts')}
        description={t('إنشاء وإدارة الإعلانات عبر معالج متعدد الخطوات', 'Create and manage announcements with a multi-step wizard')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus size={18} aria-hidden /> {t('إعلان جديد', 'New announcement')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('بحث…', 'Search…')} aria-label={t('بحث', 'Search')} />
        <SelectField id="ann-status" label={t('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('كل الحالات', 'All statuses')}</option>
          {ANNOUNCEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, isArabic)}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      {error ? <p className="form-error">{error}</p> : null}

      <SectionCard title={t('الإعلانات', 'Announcements')}>
        {listQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد إعلانات', 'No announcements')}
            emptyDescription={listQuery.isError ? getApiErrorMessage(listQuery.error) : t('أنشئ إعلاناً جديداً', 'Create an announcement')}
            columns={[
              { key: 'admin_name', label: t('الاسم الإداري', 'Admin name') },
              { key: 'title_ar', label: t('العنوان', 'Title') },
              { key: 'announcement_type', label: t('النوع', 'Type') },
              {
                key: 'status',
                label: t('الحالة', 'Status'),
                render: (r) => (
                  <StatusBadge variant={contentStatusVariant(r.status)}>{statusLabel(r.status, isArabic)}</StatusBadge>
                ),
              },
              {
                key: 'starts_at',
                label: t('البداية', 'Starts'),
                render: (r) => formatDate(r.starts_at, locale),
              },
              {
                key: 'actions',
                label: t('الإجراءات', 'Actions'),
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button type="button" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await publishAdminAnnouncement(r.id, { version: r.version, updated_at: r.updated_at });
                          qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
                        })
                      }
                    >
                      <Send size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await pauseAdminAnnouncement(r.id, { version: r.version, updated_at: r.updated_at });
                          qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
                        })
                      }
                    >
                      <Pause size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await duplicateAdminAnnouncement(r.id);
                          qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
                        })
                      }
                    >
                      <Copy size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await archiveAdminAnnouncement(r.id, { version: r.version, updated_at: r.updated_at });
                          qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
                        })
                      }
                    >
                      <Archive size={16} aria-hidden />
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>

      {wizardOpen ? (
        <SectionCard title={editingId ? t('تعديل إعلان', 'Edit announcement') : t('إعلان جديد', 'New announcement')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {STEPS.map((s, i) => (
              <Button
                key={s}
                type="button"
                variant={i === stepIdx ? 'primary' : 'outline'}
                onClick={() => setStepIdx(i)}
              >
                {i + 1}. {stepLabels[s]}
              </Button>
            ))}
          </div>

          {currentStep === 'content' ? (
            <div className="form-grid">
              <FormInput id="an-admin" label={t('الاسم الإداري', 'Admin name')} value={form.admin_name} onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))} required />
              <FormInput id="an-title" label={t('العنوان', 'Title')} value={form.title_ar} onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))} required />
              <FormTextarea id="an-summary" label={t('الملخص', 'Summary')} value={form.summary_ar} onChange={(e) => setForm((f) => ({ ...f, summary_ar: e.target.value }))} rows={2} />
              <FormTextarea id="an-content" label={t('المحتوى', 'Content')} value={form.content_ar} onChange={(e) => setForm((f) => ({ ...f, content_ar: e.target.value }))} rows={8} required />
              <FormSelect id="an-type" label={t('النوع', 'Type')} value={form.announcement_type} onChange={(e) => setForm((f) => ({ ...f, announcement_type: e.target.value }))}>
                {ANNOUNCEMENT_TYPES.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </FormSelect>
              <FormInput id="an-cta-l" label={t('نص الزر', 'CTA label')} value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} />
              <FormInput id="an-cta-u" label={t('رابط الزر', 'CTA URL')} value={form.cta_url} onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))} />
            </div>
          ) : null}

          {currentStep === 'audience' ? (
            <div className="form-grid">
              <FormSelect id="an-target" label={t('نوع الجمهور', 'Audience type')} value={form.target_type} onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value }))}>
                <option value="ALL_USERS">{t('كل المستخدمين', 'All users')}</option>
                <option value="ROLE">{t('حسب الدور', 'By role')}</option>
              </FormSelect>
              {form.target_type === 'ROLE' ? (
                <FormSelect id="an-role" label={t('الدور', 'Role')} value={form.role_code} onChange={(e) => setForm((f) => ({ ...f, role_code: e.target.value }))}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[r]}</option>
                  ))}
                </FormSelect>
              ) : null}
            </div>
          ) : null}

          {currentStep === 'channels' ? (
            <div className="form-field">
              <span className="form-field__label">{t('قنوات العرض', 'Display channels')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {CHANNEL_CODES.map((code) => (
                  <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={(form.channels || []).includes(code)} onChange={() => toggleChannel(code)} />
                    {code}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {currentStep === 'schedule' ? (
            <div className="form-grid">
              <FormInput id="an-start" type="datetime-local" label={t('يبدأ في', 'Starts at')} value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              <FormInput id="an-end" type="datetime-local" label={t('ينتهي في', 'Ends at')} value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
              <FormInput id="an-tz" label={t('المنطقة الزمنية', 'Timezone')} value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
              <FormInput id="an-pri" type="number" label={t('الأولوية', 'Priority')} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
              {editingId && form.starts_at ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    run(async () => {
                      await scheduleAdminAnnouncement(editingId, {
                        starts_at: fromDatetimeLocal(form.starts_at),
                        ends_at: fromDatetimeLocal(form.ends_at),
                        timezone: form.timezone,
                        version: form.version,
                        updated_at: form.updated_at,
                      });
                      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
                    })
                  }
                >
                  {t('تطبيق الجدولة الآن', 'Apply schedule now')}
                </Button>
              ) : null}
            </div>
          ) : null}

          {currentStep === 'ack' ? (
            <div className="form-grid">
              <FormSwitch id="an-dismiss" label={t('قابل للإغلاق', 'Dismissible')} checked={form.is_dismissible} onChange={(e) => setForm((f) => ({ ...f, is_dismissible: e.target.checked }))} />
              <FormSwitch id="an-ack" label={t('يتطلب إقراراً', 'Requires acknowledgement')} checked={form.requires_acknowledgement} onChange={(e) => setForm((f) => ({ ...f, requires_acknowledgement: e.target.checked }))} />
              <FormSwitch id="an-block" label={t('يحظر الاستخدام حتى الإقرار', 'Blocks usage until acknowledged')} checked={form.blocks_usage} onChange={(e) => setForm((f) => ({ ...f, blocks_usage: e.target.checked }))} />
              <FormSwitch id="an-pin" label={t('مثبّت', 'Pinned')} checked={form.is_pinned} onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))} />
            </div>
          ) : null}

          {currentStep === 'preview' ? (
            <div className="ug-section">
              <h3>{form.title_ar || t('(بدون عنوان)', '(No title)')}</h3>
              <p>{form.summary_ar || '—'}</p>
              <div style={{ whiteSpace: 'pre-wrap' }}>{form.content_ar || '—'}</div>
              <ul style={{ marginTop: '1rem' }}>
                <li>{t('النوع', 'Type')}: {form.announcement_type}</li>
                <li>
                  {t('الجمهور', 'Audience')}:{' '}
                  {form.target_type === 'ROLE'
                    ? (isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[form.role_code]
                    : t('كل المستخدمين', 'All users')}
                </li>
                <li>{t('القنوات', 'Channels')}: {(form.channels || []).join(', ') || '—'}</li>
                <li>{t('الإقرار', 'Ack')}: {form.requires_acknowledgement ? t('مطلوب', 'Required') : t('غير مطلوب', 'Not required')}</li>
              </ul>
            </div>
          ) : null}

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <Button type="button" variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
              {t('السابق', 'Previous')}
            </Button>
            {stepIdx < STEPS.length - 1 ? (
              <Button type="button" variant="primary" onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}>
                {t('التالي', 'Next')}
              </Button>
            ) : (
              <Button type="button" variant="primary" disabled={saveMut.isPending} onClick={onSave}>
                <Save size={18} aria-hidden /> {t('حفظ', 'Save')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setWizardOpen(false)}>
              <X size={18} aria-hidden /> {t('إلغاء', 'Cancel')}
            </Button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

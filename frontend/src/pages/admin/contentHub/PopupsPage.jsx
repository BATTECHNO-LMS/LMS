import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pause, Pencil, Plus, Save, Send, X } from 'lucide-react';
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
  archiveAdminPopup,
  createAdminPopup,
  fetchAdminPopups,
  pauseAdminPopup,
  publishAdminPopup,
  updateAdminPopup,
} from '../../../features/popups/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  DISPLAY_RULES,
  POPUP_STATUSES,
  POPUP_TYPES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  contentStatusVariant,
  formatDate,
  statusLabel,
} from './contentHub.shared.js';

const emptyForm = {
  admin_name: '',
  title_ar: '',
  body_ar: '',
  popup_type: 'INFO',
  display_rule: 'ONCE',
  cta_label: '',
  cta_url: '',
  image_url: '',
  is_dismissible: true,
  requires_acknowledgement: false,
  target_roles: [],
  target_pages: '',
  starts_at: '',
  ends_at: '',
  priority: 100,
  trigger_event: '',
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

export function PopupsPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [popupType, setPopupType] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'popups', status, popupType, q],
    queryFn: () =>
      fetchAdminPopups({
        ...(status ? { status } : {}),
        ...(popupType ? { popup_type: popupType } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      }),
  });

  const saveMut = useMutation({
    mutationFn: (body) => (editing?.id ? updateAdminPopup(editing.id, body) : createAdminPopup(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'popups'] });
      setEditing(null);
      setForm(emptyForm);
    },
  });
  const publishMut = useMutation({
    mutationFn: publishAdminPopup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'popups'] }),
  });
  const pauseMut = useMutation({
    mutationFn: pauseAdminPopup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'popups'] }),
  });
  const archiveMut = useMutation({
    mutationFn: archiveAdminPopup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'popups'] }),
  });

  const rows = listQuery.data?.popups ?? [];

  function openCreate() {
    setEditing({ id: null });
    setForm(emptyForm);
    setError('');
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      admin_name: row.admin_name || '',
      title_ar: row.title_ar || '',
      body_ar: row.body_ar || '',
      popup_type: row.popup_type || 'INFO',
      display_rule: row.display_rule || 'ONCE',
      cta_label: row.cta_label || '',
      cta_url: row.cta_url || '',
      image_url: row.image_url || '',
      is_dismissible: row.is_dismissible !== false,
      requires_acknowledgement: Boolean(row.requires_acknowledgement),
      target_roles: row.target_roles || [],
      target_pages: Array.isArray(row.target_pages) ? row.target_pages.join(', ') : '',
      starts_at: toDatetimeLocal(row.starts_at),
      ends_at: toDatetimeLocal(row.ends_at),
      priority: row.priority ?? 100,
      trigger_event: row.trigger_event || '',
    });
    setError('');
  }

  function toggleRole(code) {
    setForm((f) => {
      const set = new Set(f.target_roles || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, target_roles: [...set] };
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

  async function onSubmit(e) {
    e.preventDefault();
    const body = {
      admin_name: form.admin_name.trim(),
      title_ar: form.title_ar.trim(),
      body_ar: form.body_ar,
      popup_type: form.popup_type,
      display_rule: form.display_rule,
      cta_label: form.cta_label?.trim() || null,
      cta_url: form.cta_url?.trim() || null,
      image_url: form.image_url?.trim() || null,
      is_dismissible: Boolean(form.is_dismissible),
      requires_acknowledgement: Boolean(form.requires_acknowledgement),
      target_roles: form.target_roles,
      target_pages: String(form.target_pages || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      starts_at: fromDatetimeLocal(form.starts_at),
      ends_at: fromDatetimeLocal(form.ends_at),
      priority: Number(form.priority) || 100,
      trigger_event: form.trigger_event?.trim() || null,
    };
    await run(() => saveMut.mutateAsync(body));
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('البوب أب', 'Pop-ups')} description={t('إدارة النوافذ المنبثقة للمستخدمين', 'Manage user pop-ups')} />
      <AdminActionBar>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus size={18} aria-hidden /> {t('نافذة جديدة', 'New pop-up')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('بحث…', 'Search…')} aria-label={t('بحث', 'Search')} />
        <SelectField id="popup-status" label={t('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('كل الحالات', 'All statuses')}</option>
          {POPUP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, isArabic)}
            </option>
          ))}
        </SelectField>
        <SelectField id="popup-type" label={t('النوع', 'Type')} value={popupType} onChange={(e) => setPopupType(e.target.value)}>
          <option value="">{t('كل الأنواع', 'All types')}</option>
          {POPUP_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      {error ? <p className="form-error">{error}</p> : null}

      <SectionCard title={t('النوافذ', 'Pop-ups')}>
        {listQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد نوافذ', 'No pop-ups')}
            emptyDescription={listQuery.isError ? getApiErrorMessage(listQuery.error) : t('أنشئ نافذة جديدة', 'Create a pop-up')}
            columns={[
              { key: 'admin_name', label: t('الاسم الإداري', 'Admin name') },
              { key: 'title_ar', label: t('العنوان', 'Title') },
              { key: 'popup_type', label: t('النوع', 'Type') },
              {
                key: 'status',
                label: t('الحالة', 'Status'),
                render: (r) => (
                  <StatusBadge variant={contentStatusVariant(r.status)}>{statusLabel(r.status, isArabic)}</StatusBadge>
                ),
              },
              { key: 'priority', label: t('الأولوية', 'Priority') },
              {
                key: 'updated_at',
                label: t('آخر تحديث', 'Updated'),
                render: (r) => formatDate(r.updated_at, locale),
              },
              {
                key: 'actions',
                label: t('الإجراءات', 'Actions'),
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button type="button" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil size={16} aria-hidden />
                    </Button>
                    {String(r.status).toUpperCase() !== 'PUBLISHED' ? (
                      <Button type="button" variant="outline" onClick={() => run(() => publishMut.mutateAsync(r.id))}>
                        <Send size={16} aria-hidden />
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => run(() => pauseMut.mutateAsync(r.id))}>
                        <Pause size={16} aria-hidden />
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => run(() => archiveMut.mutateAsync(r.id))}>
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

      {editing ? (
        <SectionCard title={editing.id ? t('تعديل النافذة', 'Edit pop-up') : t('نافذة جديدة', 'New pop-up')}>
          <form className="form-grid" onSubmit={onSubmit}>
            <FormInput
              id="pp-admin"
              label={t('الاسم الإداري', 'Admin name')}
              value={form.admin_name}
              onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
              required
            />
            <FormInput
              id="pp-title"
              label={t('العنوان', 'Title')}
              value={form.title_ar}
              onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
              required
            />
            <FormTextarea
              id="pp-body"
              label={t('المحتوى', 'Body')}
              value={form.body_ar}
              onChange={(e) => setForm((f) => ({ ...f, body_ar: e.target.value }))}
              rows={6}
              required
            />
            <FormSelect
              id="pp-type"
              label={t('النوع', 'Type')}
              value={form.popup_type}
              onChange={(e) => setForm((f) => ({ ...f, popup_type: e.target.value }))}
            >
              {POPUP_TYPES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="pp-rule"
              label={t('قاعدة العرض', 'Display rule')}
              value={form.display_rule}
              onChange={(e) => setForm((f) => ({ ...f, display_rule: e.target.value }))}
            >
              {DISPLAY_RULES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="pp-cta-label"
              label={t('نص الزر', 'CTA label')}
              value={form.cta_label}
              onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
            />
            <FormInput
              id="pp-cta-url"
              label={t('رابط الزر', 'CTA URL')}
              value={form.cta_url}
              onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
            />
            <FormInput
              id="pp-image"
              label={t('رابط الصورة', 'Image URL')}
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
            <FormInput
              id="pp-pages"
              label={t('الصفحات المستهدفة (مفصولة بفاصلة)', 'Target pages (comma-separated)')}
              value={form.target_pages}
              onChange={(e) => setForm((f) => ({ ...f, target_pages: e.target.value }))}
            />
            <FormInput
              id="pp-start"
              type="datetime-local"
              label={t('يبدأ في', 'Starts at')}
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            />
            <FormInput
              id="pp-end"
              type="datetime-local"
              label={t('ينتهي في', 'Ends at')}
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
            />
            <FormInput
              id="pp-priority"
              type="number"
              label={t('الأولوية', 'Priority')}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            />
            <FormInput
              id="pp-trigger"
              label={t('حدث التشغيل', 'Trigger event')}
              value={form.trigger_event}
              onChange={(e) => setForm((f) => ({ ...f, trigger_event: e.target.value }))}
            />
            <div className="form-field">
              <span className="form-field__label">{t('الأدوار المستهدفة', 'Target roles')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ROLE_OPTIONS.map((code) => (
                  <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={(form.target_roles || []).includes(code)} onChange={() => toggleRole(code)} />
                    {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code]}
                  </label>
                ))}
              </div>
            </div>
            <FormSwitch
              id="pp-dismiss"
              label={t('قابل للإغلاق', 'Dismissible')}
              checked={form.is_dismissible}
              onChange={(e) => setForm((f) => ({ ...f, is_dismissible: e.target.checked }))}
            />
            <FormSwitch
              id="pp-ack"
              label={t('يتطلب إقراراً', 'Requires acknowledgement')}
              checked={form.requires_acknowledgement}
              onChange={(e) => setForm((f) => ({ ...f, requires_acknowledgement: e.target.checked }))}
            />
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={saveMut.isPending}>
                <Save size={18} aria-hidden /> {t('حفظ', 'Save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                <X size={18} aria-hidden /> {t('إلغاء', 'Cancel')}
              </Button>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}

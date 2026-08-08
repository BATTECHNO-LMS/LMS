import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
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
  archiveAdminUserGuide,
  createAdminUserGuide,
  createAdminUserGuideStep,
  deleteAdminUserGuideStep,
  fetchAdminUserGuide,
  fetchAdminUserGuides,
  publishAdminUserGuide,
  reorderAdminUserGuideSteps,
  updateAdminUserGuide,
  updateAdminUserGuideStep,
} from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  CONTENT_STATUSES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  contentStatusVariant,
  formatDate,
  statusLabel,
} from './contentHub.shared.js';

const emptyGuide = {
  name_ar: '',
  guide_key: '',
  guide_version: '1.0.0',
  target_role: 'student',
  status: 'DRAFT',
  auto_show: true,
  can_skip: true,
  reshow_on_new_version: false,
};

const emptyStep = {
  title_ar: '',
  body_ar: '',
  icon: '',
  tour_target: '',
  related_route: '',
  is_required: true,
  can_skip: true,
};

export function ToursPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [guideForm, setGuideForm] = useState(emptyGuide);
  const [stepForm, setStepForm] = useState(emptyStep);
  const [editingStepId, setEditingStepId] = useState(null);
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'user-guides'],
    queryFn: fetchAdminUserGuides,
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'user-guides', selectedId],
    queryFn: () => fetchAdminUserGuide(selectedId),
    enabled: Boolean(selectedId),
  });

  const guide = detailQuery.data?.guide || null;
  const steps = useMemo(() => [...(guide?.steps || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [guide]);

  useEffect(() => {
    if (!guide) return;
    setGuideForm({
      name_ar: guide.name_ar || '',
      guide_key: guide.guide_key || '',
      guide_version: guide.guide_version || '1.0.0',
      target_role: guide.target_role || 'student',
      status: guide.status || 'DRAFT',
      auto_show: guide.auto_show !== false,
      can_skip: guide.can_skip !== false,
      reshow_on_new_version: Boolean(guide.reshow_on_new_version),
      expected_version: guide.version,
      expected_updated_at: guide.updated_at,
    });
  }, [guide]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'user-guides'] });

  const createGuideMut = useMutation({
    mutationFn: createAdminUserGuide,
    onSuccess: (data) => {
      invalidate();
      setShowGuideForm(false);
      setSelectedId(data?.guide?.id || null);
    },
  });
  const updateGuideMut = useMutation({
    mutationFn: (body) => updateAdminUserGuide(selectedId, body),
    onSuccess: invalidate,
  });
  const publishMut = useMutation({
    mutationFn: () => publishAdminUserGuide(selectedId, { expected_version: guide?.version }),
    onSuccess: invalidate,
  });
  const archiveMut = useMutation({
    mutationFn: (id) => archiveAdminUserGuide(id),
    onSuccess: () => {
      invalidate();
      if (selectedId) setSelectedId(null);
    },
  });
  const stepMut = useMutation({
    mutationFn: async () => {
      if (editingStepId) {
        return updateAdminUserGuideStep(selectedId, editingStepId, stepForm);
      }
      return createAdminUserGuideStep(selectedId, {
        ...stepForm,
        sort_order: steps.length,
      });
    },
    onSuccess: () => {
      invalidate();
      setStepForm(emptyStep);
      setEditingStepId(null);
    },
  });
  const deleteStepMut = useMutation({
    mutationFn: (stepId) => deleteAdminUserGuideStep(selectedId, stepId),
    onSuccess: invalidate,
  });
  const reorderMut = useMutation({
    mutationFn: (items) => reorderAdminUserGuideSteps(selectedId, items),
    onSuccess: invalidate,
  });

  const rows = useMemo(() => {
    let list = listQuery.data?.guides ?? [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (g) =>
          String(g.name_ar || '').toLowerCase().includes(term) ||
          String(g.guide_key || '').toLowerCase().includes(term)
      );
    }
    if (status) list = list.filter((g) => String(g.status || '').toUpperCase() === status);
    return list;
  }, [listQuery.data, q, status]);

  async function run(fn) {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر إكمال العملية', 'Action failed')));
    }
  }

  async function moveStep(index, dir) {
    const next = [...steps];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const items = next.map((s, i) => ({ id: s.id, sort_order: i }));
    await run(() => reorderMut.mutateAsync(items));
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={t('الجولات التعريفية', 'Onboarding tours')}
        description={t('إدارة الجولات والخطوات مع إعادة الترتيب والنشر', 'Manage tours, reorder steps, and publish')}
      />
      <AdminActionBar>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setShowGuideForm(true);
            setSelectedId(null);
            setGuideForm(emptyGuide);
          }}
        >
          <Plus size={18} aria-hidden /> {t('جولة جديدة', 'New tour')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('بحث…', 'Search…')} aria-label={t('بحث', 'Search')} />
        <SelectField id="tour-status" label={t('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('كل الحالات', 'All statuses')}</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, isArabic)}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      {error ? <p className="form-error">{error}</p> : null}

      <SectionCard title={t('الجولات', 'Tours')}>
        {listQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد جولات', 'No tours')}
            emptyDescription={listQuery.isError ? getApiErrorMessage(listQuery.error) : t('أنشئ جولة جديدة للبدء', 'Create a tour to get started')}
            columns={[
              { key: 'name_ar', label: t('الاسم', 'Name') },
              { key: 'guide_key', label: t('المفتاح', 'Key') },
              {
                key: 'target_role',
                label: t('الدور', 'Role'),
                render: (r) => (isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[r.target_role] || r.target_role,
              },
              {
                key: 'status',
                label: t('الحالة', 'Status'),
                render: (r) => (
                  <StatusBadge variant={contentStatusVariant(r.status)}>{statusLabel(r.status, isArabic)}</StatusBadge>
                ),
              },
              { key: 'steps_count', label: t('الخطوات', 'Steps'), render: (r) => r.steps_count ?? '—' },
              {
                key: 'updated_at',
                label: t('آخر تحديث', 'Updated'),
                render: (r) => formatDate(r.updated_at, locale),
              },
              {
                key: 'actions',
                label: t('الإجراءات', 'Actions'),
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(r.id);
                        setShowGuideForm(true);
                      }}
                    >
                      <Pencil size={16} aria-hidden />
                    </Button>
                    {String(r.status).toUpperCase() !== 'PUBLISHED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          run(async () => {
                            setSelectedId(r.id);
                            await publishAdminUserGuide(r.id);
                            invalidate();
                          })
                        }
                      >
                        <Send size={16} aria-hidden />
                      </Button>
                    ) : null}
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

      {showGuideForm ? (
        <SectionCard title={selectedId ? t('تعديل الجولة', 'Edit tour') : t('جولة جديدة', 'New tour')}>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const body = {
                name_ar: guideForm.name_ar.trim(),
                guide_key: guideForm.guide_key.trim(),
                guide_version: guideForm.guide_version.trim(),
                target_role: guideForm.target_role,
                status: guideForm.status,
                auto_show: Boolean(guideForm.auto_show),
                can_skip: Boolean(guideForm.can_skip),
                reshow_on_new_version: Boolean(guideForm.reshow_on_new_version),
              };
              if (selectedId) {
                if (guideForm.expected_version != null) body.expected_version = guideForm.expected_version;
                if (guideForm.expected_updated_at) body.expected_updated_at = guideForm.expected_updated_at;
                run(() => updateGuideMut.mutateAsync(body));
              } else {
                run(() => createGuideMut.mutateAsync(body));
              }
            }}
          >
            <FormInput
              id="tg-name"
              label={t('الاسم', 'Name')}
              value={guideForm.name_ar}
              onChange={(e) => setGuideForm((f) => ({ ...f, name_ar: e.target.value }))}
              required
            />
            <FormInput
              id="tg-key"
              label={t('المفتاح (guide_key)', 'Guide key')}
              value={guideForm.guide_key}
              onChange={(e) => setGuideForm((f) => ({ ...f, guide_key: e.target.value }))}
              required
              disabled={Boolean(selectedId)}
            />
            <FormInput
              id="tg-ver"
              label={t('إصدار الجولة', 'Guide version')}
              value={guideForm.guide_version}
              onChange={(e) => setGuideForm((f) => ({ ...f, guide_version: e.target.value }))}
              required
            />
            <FormSelect
              id="tg-role"
              label={t('الدور المستهدف', 'Target role')}
              value={guideForm.target_role}
              onChange={(e) => setGuideForm((f) => ({ ...f, target_role: e.target.value }))}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[r]}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="tg-status"
              label={t('الحالة', 'Status')}
              value={guideForm.status}
              onChange={(e) => setGuideForm((f) => ({ ...f, status: e.target.value }))}
            >
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, isArabic)}
                </option>
              ))}
            </FormSelect>
            <FormSwitch
              id="tg-auto"
              label={t('عرض تلقائي', 'Auto show')}
              checked={guideForm.auto_show}
              onChange={(e) => setGuideForm((f) => ({ ...f, auto_show: e.target.checked }))}
            />
            <FormSwitch
              id="tg-skip"
              label={t('يمكن التخطي', 'Can skip')}
              checked={guideForm.can_skip}
              onChange={(e) => setGuideForm((f) => ({ ...f, can_skip: e.target.checked }))}
            />
            <FormSwitch
              id="tg-reshow"
              label={t('إعادة العرض عند إصدار جديد', 'Reshow on new version')}
              checked={guideForm.reshow_on_new_version}
              onChange={(e) => setGuideForm((f) => ({ ...f, reshow_on_new_version: e.target.checked }))}
            />
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={createGuideMut.isPending || updateGuideMut.isPending}>
                <Save size={18} aria-hidden /> {t('حفظ', 'Save')}
              </Button>
              {selectedId ? (
                <Button type="button" variant="outline" disabled={publishMut.isPending} onClick={() => run(() => publishMut.mutateAsync())}>
                  <Send size={18} aria-hidden /> {t('نشر', 'Publish')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setShowGuideForm(false)}>
                <X size={18} aria-hidden /> {t('إغلاق', 'Close')}
              </Button>
            </div>
          </form>

          {selectedId ? (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>{t('الخطوات', 'Steps')}</h3>
              {detailQuery.isLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <ul className="ug-article-list">
                    {steps.map((s, idx) => (
                      <li key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <strong>
                            {idx + 1}. {s.title_ar}
                          </strong>
                          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>{s.body_ar}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <Button type="button" variant="outline" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>
                            <ArrowUp size={14} aria-hidden />
                          </Button>
                          <Button type="button" variant="outline" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}>
                            <ArrowDown size={14} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingStepId(s.id);
                              setStepForm({
                                title_ar: s.title_ar || '',
                                body_ar: s.body_ar || '',
                                icon: s.icon || '',
                                tour_target: s.tour_target || '',
                                related_route: s.related_route || '',
                                is_required: s.is_required !== false,
                                can_skip: s.can_skip !== false,
                              });
                            }}
                          >
                            <Pencil size={14} aria-hidden />
                          </Button>
                          <Button type="button" variant="outline" onClick={() => run(() => deleteStepMut.mutateAsync(s.id))}>
                            <Trash2 size={14} aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <form
                    className="form-grid"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => stepMut.mutateAsync());
                    }}
                  >
                    <FormInput
                      id="st-title"
                      label={editingStepId ? t('تعديل الخطوة', 'Edit step') : t('عنوان الخطوة', 'Step title')}
                      value={stepForm.title_ar}
                      onChange={(e) => setStepForm((f) => ({ ...f, title_ar: e.target.value }))}
                      required
                    />
                    <FormTextarea
                      id="st-body"
                      label={t('نص الخطوة', 'Step body')}
                      value={stepForm.body_ar}
                      onChange={(e) => setStepForm((f) => ({ ...f, body_ar: e.target.value }))}
                      rows={3}
                      required
                    />
                    <FormInput
                      id="st-target"
                      label={t('هدف الجولة (CSS/data)', 'Tour target')}
                      value={stepForm.tour_target}
                      onChange={(e) => setStepForm((f) => ({ ...f, tour_target: e.target.value }))}
                    />
                    <FormInput
                      id="st-route"
                      label={t('المسار المرتبط', 'Related route')}
                      value={stepForm.related_route}
                      onChange={(e) => setStepForm((f) => ({ ...f, related_route: e.target.value }))}
                    />
                    <div className="form-actions">
                      <Button type="submit" variant="primary" disabled={stepMut.isPending}>
                        <Save size={16} aria-hidden /> {editingStepId ? t('تحديث الخطوة', 'Update step') : t('إضافة خطوة', 'Add step')}
                      </Button>
                      {editingStepId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingStepId(null);
                            setStepForm(emptyStep);
                          }}
                        >
                          {t('إلغاء التعديل', 'Cancel edit')}
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </>
              )}
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}

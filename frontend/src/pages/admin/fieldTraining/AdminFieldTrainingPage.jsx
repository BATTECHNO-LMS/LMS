import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ListChecks, Pencil, Plus, Send, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import {
  TRAINING_MODES,
  OPPORTUNITY_STATUSES,
  useAdminFieldTrainingList,
  useArchiveFieldTraining,
  useCreateFieldTraining,
  usePublishFieldTraining,
  useUpdateFieldTraining,
  fetchAdminFieldTraining,
  opportunityStatusVariant,
  formatFtDate,
} from '../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const emptyForm = {
  title: '',
  organization_name: '',
  location: '',
  training_mode: 'onsite',
  short_description: '',
  description: '',
  requirements: '',
  benefits: '',
  seats_limit: '',
  start_date: '',
  end_date: '',
  application_deadline: '',
};

function computeAdminKpis(rows) {
  const list = rows ?? [];
  let published = 0;
  let draft = 0;
  let totalApps = 0;
  list.forEach((r) => {
    if (r.status === 'published') published += 1;
    if (r.status === 'draft') draft += 1;
    totalApps += Number(r.applications_count ?? 0);
  });
  return { total: list.length, published, draft, totalApps };
}

export function AdminFieldTrainingPage() {
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [trainingMode, setTrainingMode] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [publishError, setPublishError] = useState('');

  const listParams = useMemo(() => {
    const p = { page: 1, page_size: 50 };
    if (status) p.status = status;
    if (trainingMode) p.training_mode = trainingMode;
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q, status, trainingMode]);

  const { data, isLoading, isError, error, refetch } = useAdminFieldTrainingList(listParams);
  const createMut = useCreateFieldTraining();
  const updateMut = useUpdateFieldTraining();
  const publishMut = usePublishFieldTraining();
  const archiveMut = useArchiveFieldTraining();
  const rows = data?.opportunities ?? [];
  const kpis = useMemo(() => computeAdminKpis(rows), [rows]);
  const saving = createMut.isPending || updateMut.isPending;

  const modeLabel = (m) => {
    const key = TRAINING_MODES.find((x) => x.value === m)?.labelKey;
    return key ? t(key) : m;
  };

  function formFromRow(r) {
    return {
      title: r.title ?? '',
      organization_name: r.organization_name ?? '',
      location: r.location ?? '',
      training_mode: r.training_mode ?? 'onsite',
      short_description: r.short_description ?? '',
      description: r.description ?? '',
      requirements: r.requirements ?? '',
      benefits: r.benefits ?? '',
      seats_limit: r.seats_limit != null ? String(r.seats_limit) : '',
      start_date: r.start_date ?? '',
      end_date: r.end_date ?? '',
      application_deadline: r.application_deadline ?? '',
    };
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  async function openEdit(row) {
    setEditingId(row.id);
    setFormError('');
    setModalOpen(true);
    setForm(formFromRow(row));
    try {
      const detail = await fetchAdminFieldTraining(row.id);
      if (detail?.opportunity) setForm(formFromRow(detail.opportunity));
    } catch {
      /* keep list row */
    }
  }

  function buildBody() {
    return {
      title: form.title.trim(),
      organization_name: form.organization_name.trim(),
      location: form.location.trim(),
      training_mode: form.training_mode,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      requirements: form.requirements.trim() || null,
      benefits: form.benefits.trim() || null,
      seats_limit: form.seats_limit ? Number(form.seats_limit) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      application_deadline: form.application_deadline || null,
    };
  }

  async function saveForm(e) {
    e.preventDefault();
    setFormError('');
    try {
      const body = buildBody();
      if (editingId) await updateMut.mutateAsync({ id: editingId, body });
      else await createMut.mutateAsync(body);
      setModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handlePublish(id) {
    setPublishError('');
    try {
      await publishMut.mutateAsync(id);
      refetch();
    } catch (err) {
      const msg = getApiErrorMessage(err, t('publishFailed'));
      const missing = err?.response?.data?.details?.missing;
      setPublishError(Array.isArray(missing) && missing.length ? `${msg}\n${missing.join('\n')}` : msg);
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page ft-page">
      <header className="ft-admin-header">
        <div>
          <h1 className="page__title">{t('title')}</h1>
          <p className="page__description">{t('adminHeroDescription')}</p>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus size={18} aria-hidden /> {t('addOpportunity')}
        </Button>
      </header>

      <div className="ft-kpi-grid">
        <div className="ft-kpi-card">
          <span className="ft-kpi-card__value">{kpis.total}</span>
          <span className="ft-kpi-card__label">{t('adminKpi.total')}</span>
        </div>
        <div className="ft-kpi-card ft-kpi-card--success">
          <span className="ft-kpi-card__value">{kpis.published}</span>
          <span className="ft-kpi-card__label">{t('adminKpi.published')}</span>
        </div>
        <div className="ft-kpi-card ft-kpi-card--gold">
          <span className="ft-kpi-card__value">{kpis.draft}</span>
          <span className="ft-kpi-card__label">{t('adminKpi.draft')}</span>
        </div>
        <div className="ft-kpi-card ft-kpi-card--warning">
          <span className="ft-kpi-card__value">{kpis.totalApps}</span>
          <span className="ft-kpi-card__label">{t('adminKpi.totalApplications')}</span>
        </div>
      </div>

      <section className="ft-filters-card" aria-label={t('adminFiltersLabel')}>
        <div className="ft-filters-card__grid">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={tCommon('actions.search')}
          />
          <SelectField id="ft-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{tCommon('status.allStatuses')}</option>
            {OPPORTUNITY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </SelectField>
          <SelectField id="ft-mode" label={t('form.mode')} value={trainingMode} onChange={(e) => setTrainingMode(e.target.value)}>
            <option value="">{t('student.allModes')}</option>
            {TRAINING_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {t(m.labelKey)}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {publishError ? (
        <p className="form-field__error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          {publishError}
        </p>
      ) : null}

      {isLoading ? (
        <LoadingSpinner />
      ) : !rows.length && !isError ? (
        <div className="ft-empty">
          <h3>{t('adminEmptyTitle')}</h3>
          <p>{t('adminEmptyDesc')}</p>
          <Button type="button" variant="primary" onClick={openCreate}>
            <Plus size={16} aria-hidden /> {t('adminEmptyCta')}
          </Button>
        </div>
      ) : (
        <div className="ft-admin-table-wrap section-card" style={{ padding: '1rem' }}>
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : t('listTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : ''}
            columns={[
              {
                key: 'title',
                label: t('table.title'),
                render: (r) => (
                  <div>
                    <div className="ft-opp-cell__title">{r.title}</div>
                    <div className="ft-opp-cell__sub">{r.organization_name}</div>
                  </div>
                ),
              },
              { key: 'mode', label: t('table.mode'), render: (r) => modeLabel(r.training_mode) },
              { key: 'location', label: t('table.location'), render: (r) => r.location },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={opportunityStatusVariant(r.status)}>{t(`status.${r.status}`)}</StatusBadge>
                ),
              },
              { key: 'apps', label: t('table.applications'), render: (r) => String(r.applications_count ?? 0) },
              {
                key: 'seats',
                label: t('table.seats'),
                render: (r) => (r.seats_limit != null ? String(r.seats_limit) : '—'),
              },
              {
                key: 'updated',
                label: t('table.updated'),
                render: (r) => formatFtDate(r.updated_at) ?? '—',
              },
              {
                key: 'actions',
                label: t('table.actions'),
                render: (r) => (
                  <div className="ft-row-actions">
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(r)}>
                      <Pencil size={14} aria-hidden /> {t('edit')}
                    </button>
                    <Link className="btn btn--sm btn--outline" to={`/admin/field-training/${r.id}/applications`}>
                      <Users size={14} aria-hidden /> {t('viewApplications')}
                    </Link>
                    <Link className="btn btn--sm btn--outline" to={`/admin/field-training/${r.id}/tasks`}>
                      <ListChecks size={14} aria-hidden /> {t('tasks.manageTasks')}
                    </Link>
                    {r.status !== 'published' ? (
                      <button type="button" className="btn btn--sm btn--primary" onClick={() => handlePublish(r.id)}>
                        <Send size={14} aria-hidden /> {t('publish')}
                      </button>
                    ) : null}
                    {r.status !== 'archived' ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => archiveMut.mutate(r.id, { onSuccess: () => refetch() })}
                      >
                        <Archive size={14} aria-hidden /> {t('archive')}
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={rows}
          />
        </div>
      )}

      {modalOpen ? (
        <div className="ft-modal-backdrop" onClick={() => setModalOpen(false)} role="presentation">
          <div
            className="ft-modal ft-modal--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="ft-modal__title">{editingId ? t('edit') : t('addOpportunity')}</h2>
            <form onSubmit={saveForm} noValidate className="ft-form-sections">
              {formError ? (
                <p className="form-field__error" role="alert">
                  {formError}
                </p>
              ) : null}

              <fieldset className="ft-form-section">
                <legend className="ft-form-section__title">{t('form.sectionBasic')}</legend>
                <div className="ft-form-section__grid">
                  <FormInput
                    id="ft-title"
                    label={t('form.title')}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <FormInput
                    id="ft-org"
                    label={t('form.organization')}
                    value={form.organization_name}
                    onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
                  />
                  <FormInput
                    id="ft-loc"
                    label={t('form.location')}
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                  <SelectField
                    id="ft-mode-f"
                    label={t('form.mode')}
                    value={form.training_mode}
                    onChange={(e) => setForm((f) => ({ ...f, training_mode: e.target.value }))}
                  >
                    {TRAINING_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </fieldset>

              <fieldset className="ft-form-section">
                <legend className="ft-form-section__title">{t('form.sectionDescription')}</legend>
                <div className="ft-form-section__grid ft-form-section__grid--full">
                  <FormTextarea
                    id="ft-short"
                    label={t('form.shortDescription')}
                    value={form.short_description}
                    onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                    rows={2}
                  />
                  <FormTextarea
                    id="ft-desc"
                    label={t('form.description')}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                  />
                  <FormTextarea
                    id="ft-req"
                    label={t('form.requirements')}
                    value={form.requirements}
                    onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
                    rows={3}
                  />
                  <FormTextarea
                    id="ft-ben"
                    label={t('form.benefits')}
                    value={form.benefits}
                    onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
                    rows={3}
                  />
                </div>
              </fieldset>

              <fieldset className="ft-form-section">
                <legend className="ft-form-section__title">{t('form.sectionSchedule')}</legend>
                <div className="ft-form-section__grid">
                  <FormInput
                    id="ft-seats"
                    label={t('form.seatsLimit')}
                    type="number"
                    min={1}
                    value={form.seats_limit}
                    onChange={(e) => setForm((f) => ({ ...f, seats_limit: e.target.value }))}
                  />
                  <FormInput
                    id="ft-start"
                    label={t('form.startDate')}
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                  <FormInput
                    id="ft-end"
                    label={t('form.endDate')}
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                  <FormInput
                    id="ft-deadline"
                    label={t('form.applicationDeadline')}
                    type="date"
                    value={form.application_deadline}
                    onChange={(e) => setForm((f) => ({ ...f, application_deadline: e.target.value }))}
                  />
                </div>
              </fieldset>

              <div className="ft-modal__actions">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}


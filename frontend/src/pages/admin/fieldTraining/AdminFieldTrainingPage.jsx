import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Briefcase,
  Calendar,
  ChevronDown,
  ClipboardList,
  Filter,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Tag,
  Users,
  X,
  FileText,
  Info,
  GraduationCap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { cn } from '../../../utils/helpers.js';
import {
  TRAINING_MODES,
  OPPORTUNITY_STATUSES,
  useAdminFieldTrainingList,
  useAdminFieldTrainingStats,
  useArchiveFieldTraining,
  useCreateFieldTraining,
  usePublishFieldTraining,
  useUpdateFieldTraining,
  fetchAdminFieldTraining,
  fetchFieldTrainingInstructors,
  fetchFieldTrainingEligibilityCatalog,
  opportunityStatusVariant,
  formatFtDate,
  getOpportunitySpecialtyLabel,
} from '../../../features/fieldTraining/index.js';
import { FieldTrainingEligibilityPicker } from './components/FieldTrainingEligibilityPicker.jsx';
import { useQuery } from '@tanstack/react-query';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { useSpecialties, getSpecialtyLabel } from '../../../features/specialties/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const SEARCH_DEBOUNCE_MS = 350;

const emptyForm = {
  title: '',
  specialty_id: '',
  assigned_instructor_id: '',
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
  requires_pre_assessment: true,
  requires_post_assessment: true,
  requires_final_task: true,
  minimum_attendance_percentage: '80',
  minimum_post_assessment_score: '60',
  eligibility: [],
};

export function AdminFieldTrainingPage() {
  const { t, i18n } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('');
  const [trainingMode, setTrainingMode] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [publishError, setPublishError] = useState('');
  const [editingNeedsEligibility, setEditingNeedsEligibility] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const listParams = useMemo(() => {
    const p = { page: 1, page_size: 50 };
    if (status) p.status = status;
    if (trainingMode) p.training_mode = trainingMode;
    if (specialtyFilter) p.specialty_id = specialtyFilter;
    if (debouncedQ) p.search = debouncedQ;
    return p;
  }, [debouncedQ, status, trainingMode, specialtyFilter]);

  const statsParams = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (trainingMode) p.training_mode = trainingMode;
    if (specialtyFilter) p.specialty_id = specialtyFilter;
    if (debouncedQ) p.search = debouncedQ;
    return p;
  }, [debouncedQ, status, trainingMode, specialtyFilter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminFieldTrainingList(listParams);
  const { data: statsData, isLoading: statsLoading } = useAdminFieldTrainingStats(statsParams);
  const {
    data: specialtyRows = [],
    isLoading: specialtiesLoading,
    isError: specialtiesError,
  } = useSpecialties();

  const { data: instructorsData } = useQuery({
    queryKey: fieldTrainingKeys.instructors(),
    queryFn: fetchFieldTrainingInstructors,
    staleTime: 60_000,
  });
  const instructorOptions = instructorsData?.instructors ?? [];

  const createMut = useCreateFieldTraining();
  const updateMut = useUpdateFieldTraining();
  const publishMut = usePublishFieldTraining();
  const archiveMut = useArchiveFieldTraining();

  const rows = data?.opportunities ?? [];
  const listTotal = data?.meta?.total ?? rows.length;
  const kpis = useMemo(() => {
    const s = statsData?.stats;
    if (!s) return { total: 0, published: 0, draft: 0, totalApps: 0 };
    return {
      total: s.totalOpportunities ?? 0,
      published: s.publishedOpportunities ?? 0,
      draft: s.draftOpportunities ?? 0,
      totalApps: s.totalApplications ?? 0,
    };
  }, [statsData]);

  const isSubmitting = createMut.isPending || updateMut.isPending;
  const hasActiveFilters = Boolean(status || trainingMode || specialtyFilter);
  const isFilteredView = hasActiveFilters || Boolean(debouncedQ);
  const canSubmitOpportunity = Boolean(form.specialty_id) && !specialtiesLoading && !specialtiesError;

  const {
    data: eligibilityCatalog = [],
    isLoading: eligibilityCatalogLoading,
    isError: eligibilityCatalogError,
  } = useQuery({
    queryKey: ['fieldTraining', 'eligibilityCatalog'],
    queryFn: async () => {
      const payload = await fetchFieldTrainingEligibilityCatalog();
      return payload?.universities ?? [];
    },
    enabled: modalOpen,
    staleTime: 5 * 60 * 1000,
  });

  const specialtyOptions = useMemo(
    () =>
      specialtyRows.map((row) => ({
        id: row.id,
        label: getSpecialtyLabel(row, i18n.language),
      })),
    [specialtyRows, i18n.language]
  );

  const modeLabel = (m) => {
    const key = TRAINING_MODES.find((x) => x.value === m)?.labelKey;
    return key ? t(key) : m;
  };

  function formFromRow(r) {
    return {
      title: r.title ?? '',
      specialty_id: r.specialty_id ?? r.specialty?.id ?? '',
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
      assigned_instructor_id: r.assigned_instructor_id ?? '',
      requires_pre_assessment: r.requires_pre_assessment ?? true,
      requires_post_assessment: r.requires_post_assessment ?? true,
      requires_final_task: r.requires_final_task ?? true,
      minimum_attendance_percentage:
        r.minimum_attendance_percentage != null ? String(r.minimum_attendance_percentage) : '',
      minimum_post_assessment_score:
        r.minimum_post_assessment_score != null ? String(r.minimum_post_assessment_score) : '',
      eligibility: Array.isArray(r.eligibility)
        ? r.eligibility.map((item) => ({
            university_id: item.university_id,
            university_specialty_id: item.university_specialty_id,
          }))
        : [],
    };
  }

  function openCreate() {
    setEditingId(null);
    setEditingNeedsEligibility(false);
    setForm({ ...emptyForm });
    setFormError('');
    setFormErrors({});
    setModalOpen(true);
  }

  async function openEdit(row) {
    setEditingId(row.id);
    setEditingNeedsEligibility(Boolean(row.needs_eligibility_setup));
    setFormError('');
    setFormErrors({});
    setModalOpen(true);
    setForm(formFromRow(row));
    try {
      const detail = await fetchAdminFieldTraining(row.id);
      if (detail?.opportunity) {
        setForm(formFromRow(detail.opportunity));
        setEditingNeedsEligibility(Boolean(detail.opportunity.needs_eligibility_setup));
      }
    } catch {
      /* keep list row */
    }
  }

  function buildBody() {
    return {
      title: form.title.trim(),
      specialty_id: form.specialty_id,
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
      assigned_instructor_id: form.assigned_instructor_id || null,
      requires_pre_assessment: Boolean(form.requires_pre_assessment),
      requires_post_assessment: Boolean(form.requires_post_assessment),
      requires_final_task: Boolean(form.requires_final_task),
      minimum_attendance_percentage: form.minimum_attendance_percentage
        ? Number(form.minimum_attendance_percentage)
        : null,
      minimum_post_assessment_score: form.minimum_post_assessment_score
        ? Number(form.minimum_post_assessment_score)
        : null,
      eligibility: form.eligibility,
    };
  }

  async function saveForm(e) {
    e.preventDefault();
    setFormError('');
    const errors = {};

    if (!form.title.trim()) {
      errors.title = t('form.titleRequired');
    }
    if (!form.specialty_id) {
      errors.specialty = t('form.trainingTrackRequired');
    }

    const uniqueUniversities = new Set(form.eligibility.map((row) => row.university_id));
    if (!uniqueUniversities.size) {
      errors.eligibility = t('form.universityEligibilityRequired');
    } else if (!form.eligibility.length) {
      errors.eligibility = t('form.eligibilitySpecialtyRequired');
    }

    if (form.minimum_attendance_percentage !== '') {
      const attendance = Number(form.minimum_attendance_percentage);
      if (Number.isNaN(attendance) || attendance < 0 || attendance > 100) {
        errors.attendance = t('form.attendanceRange');
      }
    }

    if (form.minimum_post_assessment_score !== '') {
      const postScore = Number(form.minimum_post_assessment_score);
      if (Number.isNaN(postScore) || postScore < 0 || postScore > 100) {
        errors.postScore = t('form.postScoreRange');
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setFormError(errors[Object.keys(errors)[0]]);
      return;
    }

    try {
      const body = buildBody();
      if (editingId) await updateMut.mutateAsync({ id: editingId, body });
      else await createMut.mutateAsync(body);
      setEditingNeedsEligibility(false);
      setFormErrors({});
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

  function clearAllFilters() {
    setStatus('');
    setTrainingMode('');
    setSpecialtyFilter('');
  }

  const listCounter = t('listCounter', { shown: rows.length, total: listTotal });

  return (
    <div className="page page--dashboard page--admin crud-page ft-page">
      <AdminPageHeader
        title={t('title')}
        description={t('adminHeroDescription')}
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            <Plus size={18} aria-hidden /> {t('addOpportunity')}
          </Button>
        }
      />

      <AdminStatsGrid>
        <StatCard
          label={t('adminKpi.total')}
          value={statsLoading ? '—' : kpis.total}
          hint={t('adminKpi.totalHint')}
          meta={t('adminKpi.liveData')}
          icon={Briefcase}
        />
        <StatCard
          label={t('adminKpi.published')}
          value={statsLoading ? '—' : kpis.published}
          hint={t('adminKpi.publishedHint')}
          meta={t('adminKpi.liveData')}
          icon={ClipboardList}
        />
        <StatCard
          label={t('adminKpi.draft')}
          value={statsLoading ? '—' : kpis.draft}
          hint={t('adminKpi.draftHint')}
          meta={t('adminKpi.liveData')}
          icon={Pencil}
        />
        <StatCard
          label={t('adminKpi.totalApplications')}
          value={statsLoading ? '—' : kpis.totalApps}
          hint={t('adminKpi.totalApplicationsHint')}
          meta={t('adminKpi.liveData')}
          icon={Users}
        />
      </AdminStatsGrid>

      <section className="ft-admin-toolbar" aria-label={t('toolbarTitle')}>
        <header className="ft-admin-toolbar__head">
          <div className="ft-admin-toolbar__head-text">
            <span className="ft-admin-toolbar__head-icon" aria-hidden>
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="ft-admin-toolbar__title">{t('toolbarTitle')}</h2>
              <p className="ft-admin-toolbar__subtitle">{t('toolbarSubtitle')}</p>
            </div>
          </div>
          <span className="ft-admin-toolbar__count">{listCounter}</span>
        </header>

        <div className="ft-admin-toolbar__body">
          <div className="ft-admin-toolbar__field ft-admin-toolbar__field--search">
            <span className="ft-admin-toolbar__label" id="ft-search-label">
              {tCommon('actions.search')}
            </span>
            <div className="ft-admin-search">
              <Search className="ft-admin-search__icon" size={18} aria-hidden />
              <input
                type="search"
                className="ft-admin-search__input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-labelledby="ft-search-label"
              />
              {q ? (
                <button
                  type="button"
                  className="ft-admin-search__clear"
                  onClick={() => setQ('')}
                  aria-label={t('clearSearch')}
                >
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="ft-admin-toolbar__field">
            <span className="ft-admin-toolbar__label" id="ft-status-label">
              {tCommon('status.label')}
            </span>
            <div className="ft-admin-select">
              <Filter className="ft-admin-select__icon" size={16} aria-hidden />
              <select
                className="ft-admin-select__control"
                aria-labelledby="ft-status-label"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{tCommon('status.allStatuses')}</option>
                {OPPORTUNITY_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown className="ft-admin-select__chevron" size={16} aria-hidden />
            </div>
          </div>

          <div className="ft-admin-toolbar__field">
            <span className="ft-admin-toolbar__label" id="ft-mode-label">
              {t('form.mode')}
            </span>
            <div className="ft-admin-select">
              <Tag className="ft-admin-select__icon" size={16} aria-hidden />
              <select
                className="ft-admin-select__control"
                aria-labelledby="ft-mode-label"
                value={trainingMode}
                onChange={(e) => setTrainingMode(e.target.value)}
              >
                <option value="">{t('student.allModes')}</option>
                {TRAINING_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown className="ft-admin-select__chevron" size={16} aria-hidden />
            </div>
          </div>
          <div className="ft-admin-toolbar__field">
            <span className="ft-admin-toolbar__label" id="ft-specialty-filter-label">
              {t('form.specialty')}
            </span>
            <div className="ft-admin-select">
              <GraduationCap className="ft-admin-select__icon" size={16} aria-hidden />
              <select
                className="ft-admin-select__control"
                aria-labelledby="ft-specialty-filter-label"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                disabled={specialtiesLoading}
              >
                <option value="">{t('filterAllSpecialties')}</option>
                {specialtyOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="ft-admin-select__chevron" size={16} aria-hidden />
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="ft-admin-toolbar__chips">
            {status ? (
              <button
                type="button"
                className="ft-filter-chip"
                onClick={() => setStatus('')}
                aria-label={t('removeFilter')}
              >
                <span className="ft-filter-chip__label">
                  {tCommon('status.label')}: {t(`status.${status}`)}
                </span>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            {trainingMode ? (
              <button
                type="button"
                className="ft-filter-chip"
                onClick={() => setTrainingMode('')}
                aria-label={t('removeFilter')}
              >
                <span className="ft-filter-chip__label">
                  {t('form.mode')}: {modeLabel(trainingMode)}
                </span>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            {specialtyFilter ? (
              <button
                type="button"
                className="ft-filter-chip"
                onClick={() => setSpecialtyFilter('')}
                aria-label={t('removeFilter')}
              >
                <span className="ft-filter-chip__label">
                  {t('form.specialty')}:{' '}
                  {specialtyOptions.find((item) => item.id === specialtyFilter)?.label ?? specialtyFilter}
                </span>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            <button type="button" className="ft-filter-chip ft-filter-chip--clear" onClick={clearAllFilters}>
              {t('clearFilters')}
            </button>
          </div>
        ) : null}
      </section>

      {publishError ? (
        <p className="ft-admin-alert" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          {publishError}
        </p>
      ) : null}

      {isLoading ? (
        <div className="ft-admin-skeleton-grid" aria-busy="true" aria-label={tCommon('loading')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ft-admin-skeleton-card" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Briefcase}
          title={t('loadErrorTitle')}
          description={String(error?.message ?? tCommon('errors.generic'))}
          action={
            <Button type="button" variant="primary" onClick={() => refetch()}>
              {t('retryLoad')}
            </Button>
          }
        />
      ) : !rows.length ? (
        <EmptyState
          icon={Briefcase}
          title={isFilteredView ? t('adminFilteredEmptyTitle') : t('adminEmptyTitle')}
          description={isFilteredView ? t('adminFilteredEmptyDesc') : t('adminEmptyDesc')}
          action={
            <Button type="button" variant="primary" onClick={openCreate}>
              <Plus size={16} aria-hidden /> {t('addOpportunity')}
            </Button>
          }
        />
      ) : (
        <div className={cn('ft-admin-opp-grid', isFetching && 'ft-admin-opp-grid--fetching')}>
          {rows.map((r) => (
            <article key={r.id} className="ft-admin-opp-card">
              <div className="ft-admin-opp-card__head">
                <span className="ft-admin-opp-card__icon" aria-hidden>
                  <GraduationCap size={22} strokeWidth={1.6} />
                </span>
                <StatusBadge variant={opportunityStatusVariant(r.status)} className="ft-admin-opp-card__status">
                  {t(`status.${r.status}`)}
                </StatusBadge>
                <span className="ft-admin-opp-card__mode-chip">{modeLabel(r.training_mode)}</span>
              </div>

              <div className="ft-admin-opp-card__body">
                <h3 className="ft-admin-opp-card__title">
                  <button type="button" className="ft-admin-opp-card__title-btn" onClick={() => openEdit(r)}>
                    {r.title}
                  </button>
                </h3>
                <p className="ft-admin-opp-card__org">
                  <GraduationCap size={14} aria-hidden />{' '}
                  {t('form.trainingTrack')}:{' '}
                  {getOpportunitySpecialtyLabel(r, i18n.language, t('form.specialtyUnspecified'))}
                </p>
                <p className="ft-admin-opp-card__org">
                  {t('detail.beneficiaryUniversitiesCount', {
                    count: r.beneficiary_university_count ?? 0,
                  })}
                  {' · '}
                  {t('detail.eligibleProgramsCount', {
                    count: r.eligible_specialty_count ?? 0,
                  })}
                </p>
                {r.assigned_instructor?.full_name ? (
                  <p className="ft-admin-opp-card__org">
                    {t('form.assignedInstructor')}: {r.assigned_instructor.full_name}
                  </p>
                ) : null}
                {r.short_description ? (
                  <p className="ft-admin-opp-card__desc">{r.short_description}</p>
                ) : null}
                {r.needs_eligibility_setup ? (
                  <p className="ft-admin-opp-card__eligibility-warning" role="status">
                    {r.eligibility_setup_message || t('form.eligibilitySetupRequired')}
                  </p>
                ) : null}

                <div className="ft-admin-opp-card__info">
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <MapPin size={14} />
                    </span>
                    <span>{r.location}</span>
                  </div>
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <Users size={14} />
                    </span>
                    <span>{t('table.applications')}: {r.applications_count ?? 0}</span>
                  </div>
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <ClipboardList size={14} />
                    </span>
                    <span>
                      {t('table.seats')}: {r.seats_limit != null ? r.seats_limit : '—'}
                    </span>
                  </div>
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <Calendar size={14} />
                    </span>
                    <span>
                      {t('form.startDate')}: {formatFtDate(r.start_date) ?? '—'}
                      {' · '}
                      {t('form.endDate')}: {formatFtDate(r.end_date) ?? '—'}
                    </span>
                  </div>
                  {r.applications_by_university?.length ? (
                    <div className="ft-admin-opp-card__info-item ft-admin-opp-card__info-item--full">
                      <span className="ft-admin-opp-card__info-icon" aria-hidden>
                        <Users size={14} />
                      </span>
                      <span>
                        {r.applications_by_university
                          .map((row) => `${row.name ?? '—'}: ${row.count}`)
                          .join(' · ')}
                      </span>
                    </div>
                  ) : null}
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <Calendar size={14} />
                    </span>
                    <span>
                      {t('form.applicationDeadline')}: {formatFtDate(r.application_deadline) ?? '—'}
                    </span>
                  </div>
                  <div className="ft-admin-opp-card__info-item">
                    <span className="ft-admin-opp-card__info-icon" aria-hidden>
                      <Calendar size={14} />
                    </span>
                    <span>
                      {t('table.updated')}: {formatFtDate(r.updated_at) ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ft-admin-opp-card__actions">
                <div className="ft-admin-opp-card__actions-main">
                  <Link className="btn btn--sm btn--outline" to={`/admin/field-training/${r.id}/manage`}>
                    {t('manageTraining.link')}
                  </Link>
                  <Link className="btn btn--sm btn--primary" to={`/admin/field-training/${r.id}/tasks`}>
                    <ListChecks size={14} aria-hidden /> {t('tasks.manageTasks')}
                  </Link>
                  <Link className="btn btn--sm btn--outline" to={`/admin/field-training/${r.id}/applications`}>
                    <Users size={14} aria-hidden /> {t('viewApplications')}
                  </Link>
                  <button type="button" className="btn btn--sm btn--outline" onClick={() => openEdit(r)}>
                    <Pencil size={14} aria-hidden /> {t('edit')}
                  </button>
                </div>
                <div className="ft-admin-opp-card__actions-end">
                  {r.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn btn--sm ft-admin-opp-card__publish"
                      disabled={publishMut.isPending}
                      onClick={() => handlePublish(r.id)}
                    >
                      <Send size={14} aria-hidden /> {t('publish')}
                    </button>
                  ) : null}
                  {r.status !== 'archived' ? (
                    <button
                      type="button"
                      className="btn btn--icon btn--sm ft-admin-opp-card__archive"
                      title={t('archive')}
                      aria-label={t('archive')}
                      disabled={archiveMut.isPending}
                      onClick={() => archiveMut.mutate(r.id, { onSuccess: () => refetch() })}
                    >
                      <Archive size={14} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="ft-modal-backdrop" onClick={() => setModalOpen(false)} role="presentation">
          <div
            className="ft-modal ft-modal--composer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ft-modal-title"
          >
            <header className="ft-modal__header">
              <div className="ft-modal__header-text">
                <h2 id="ft-modal-title" className="ft-modal__title">
                  {editingId ? t('edit') : t('addOpportunity')}
                </h2>
                <p className="ft-modal__subtitle">{t('form.modalSubtitle')}</p>
              </div>
              <button
                type="button"
                className="ft-modal__close"
                onClick={() => setModalOpen(false)}
                aria-label={t('cancel')}
              >
                <X size={20} aria-hidden />
              </button>
            </header>

            <form onSubmit={saveForm} noValidate className="ft-modal__form">
              <div className="ft-modal__body">
                {editingNeedsEligibility ? (
                  <p className="ft-modal__eligibility-warning" role="status">
                    {t('form.eligibilitySetupRequired')}
                  </p>
                ) : null}
                {formError ? (
                  <p className="ft-modal__error" role="alert">
                    {formError}
                  </p>
                ) : null}

                <fieldset className="ft-composer-section">
                  <legend className="ft-composer-section__legend">
                    <span className="ft-composer-section__icon" aria-hidden>
                      <Info size={18} />
                    </span>
                    <span className="ft-composer-section__title">{t('form.sectionBasic')}</span>
                  </legend>
                  <p className="ft-composer-section__help">{t('form.sectionBasicHelp')}</p>
                  {formErrors.title ? (
                    <p className="ft-composer-section__error" role="alert">{formErrors.title}</p>
                  ) : null}
                  <div className="ft-composer-section__grid ft-composer-section__grid--2">
                    <FormInput
                      id="ft-title"
                      label={t('form.title')}
                      value={form.title}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, title: e.target.value }));
                        if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: undefined }));
                      }}
                      aria-invalid={Boolean(formErrors.title)}
                    />
                    <div className="form-field">
                      <label className="form-field__label" htmlFor="ft-specialty">
                        {t('form.trainingTrack')}
                      </label>
                      <p className="ft-composer-section__field-help">{t('form.trainingTrackHelp')}</p>
                      <div className="ft-modal-select">
                        <GraduationCap className="ft-modal-select__icon" size={16} aria-hidden />
                        <select
                          id="ft-specialty"
                          className="ft-modal-select__control"
                          value={form.specialty_id}
                          onChange={(e) => {
                            setForm((f) => ({ ...f, specialty_id: e.target.value }));
                            if (formErrors.specialty) setFormErrors((prev) => ({ ...prev, specialty: undefined }));
                          }}
                          disabled={
                            specialtiesLoading
                            || specialtiesError
                            || !specialtyOptions.length
                          }
                          aria-invalid={Boolean(formErrors.specialty)}
                        >
                          <option value="">
                            {specialtiesLoading
                              ? t('form.specialtiesLoading')
                              : t('form.specialtyPlaceholder')}
                          </option>
                          {specialtyOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="ft-modal-select__chevron" size={16} aria-hidden />
                      </div>
                      {formErrors.specialty ? (
                        <p className="form-field__error" role="alert">{formErrors.specialty}</p>
                      ) : null}
                      {specialtiesError ? (
                        <p className="form-field__error" role="alert">
                          {t('form.specialtiesLoadError')}
                        </p>
                      ) : null}
                      {!specialtiesLoading && !specialtiesError && !specialtyOptions.length ? (
                        <p className="form-field__error" role="status">
                          {t('form.noSpecialties')}
                        </p>
                      ) : null}
                    </div>
                    <FormInput
                      id="ft-loc"
                      label={t('form.location')}
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    />
                    <div className="form-field">
                      <label className="form-field__label" htmlFor="ft-mode-f">
                        {t('form.mode')}
                      </label>
                      <div className="ft-modal-select">
                        <Tag className="ft-modal-select__icon" size={16} aria-hidden />
                        <select
                          id="ft-mode-f"
                          className="ft-modal-select__control"
                          value={form.training_mode}
                          onChange={(e) => setForm((f) => ({ ...f, training_mode: e.target.value }))}
                        >
                          {TRAINING_MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {t(m.labelKey)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="ft-modal-select__chevron" size={16} aria-hidden />
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-field__label" htmlFor="ft-instructor">
                        {t('form.assignedInstructor')}
                      </label>
                      <div className="ft-modal-select">
                        <Users className="ft-modal-select__icon" size={16} aria-hidden />
                        <select
                          id="ft-instructor"
                          className="ft-modal-select__control"
                          value={form.assigned_instructor_id}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, assigned_instructor_id: e.target.value }))
                          }
                          disabled={isSubmitting}
                        >
                          <option value="">{t('form.instructorPlaceholder')}</option>
                          {instructorOptions.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.full_name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="ft-modal-select__chevron" size={16} aria-hidden />
                      </div>
                      {!instructorsData?.instructors?.length ? (
                        <p className="form-field__hint form-field__hint--warn">{t('form.noInstructors')}</p>
                      ) : null}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="ft-composer-section">
                  <legend className="ft-composer-section__legend">
                    <span className="ft-composer-section__icon" aria-hidden>
                      <GraduationCap size={18} />
                    </span>
                    <span className="ft-composer-section__title">{t('form.eligibilitySection')}</span>
                  </legend>
                  <p className="ft-composer-section__help">{t('form.eligibilityHelp')}</p>
                  {formErrors.eligibility ? (
                    <p className="ft-composer-section__error" role="alert">{formErrors.eligibility}</p>
                  ) : null}
                  <FieldTrainingEligibilityPicker
                    catalog={eligibilityCatalog}
                    value={form.eligibility}
                    onChange={(eligibility) => {
                      setForm((f) => ({ ...f, eligibility }));
                      if (formErrors.eligibility) setFormErrors((prev) => ({ ...prev, eligibility: undefined }));
                    }}
                    loading={eligibilityCatalogLoading}
                    error={eligibilityCatalogError}
                    disabled={isSubmitting}
                  />
                </fieldset>

                <fieldset className="ft-composer-section ft-composer-section--workflow">
                  <legend className="ft-composer-section__legend">
                    <span className="ft-composer-section__icon" aria-hidden>
                      <SlidersHorizontal size={18} />
                    </span>
                    <span className="ft-composer-section__title">{t('form.sectionWorkflow')}</span>
                  </legend>
                  <p className="ft-composer-section__help">{t('form.sectionWorkflowHelp')}</p>
                  <div className="ft-workflow-grid">
                    <div className="ft-workflow-toggles">
                      <label className="ft-workflow-toggle">
                        <input
                          type="checkbox"
                          checked={form.requires_pre_assessment}
                          disabled={isSubmitting}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, requires_pre_assessment: e.target.checked }))
                          }
                        />
                        <span>{t('form.requiresPreAssessment')}</span>
                      </label>
                      <label className="ft-workflow-toggle">
                        <input
                          type="checkbox"
                          checked={form.requires_post_assessment}
                          disabled={isSubmitting}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, requires_post_assessment: e.target.checked }))
                          }
                        />
                        <span>{t('form.requiresPostAssessment')}</span>
                      </label>
                      <label className="ft-workflow-toggle">
                        <input
                          type="checkbox"
                          checked={form.requires_final_task}
                          disabled={isSubmitting}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, requires_final_task: e.target.checked }))
                          }
                        />
                        <span>{t('form.requiresFinalTask')}</span>
                      </label>
                    </div>
                    <div className="ft-workflow-numbers">
                      <FormInput
                        id="ft-min-att"
                        type="number"
                        min={0}
                        max={100}
                        label={t('form.minAttendance')}
                        value={form.minimum_attendance_percentage}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, minimum_attendance_percentage: e.target.value }));
                          if (formErrors.attendance) setFormErrors((prev) => ({ ...prev, attendance: undefined }));
                        }}
                        error={formErrors.attendance}
                        aria-invalid={Boolean(formErrors.attendance)}
                      />
                      <FormInput
                        id="ft-min-post"
                        type="number"
                        min={0}
                        max={100}
                        label={t('form.minPostScore')}
                        value={form.minimum_post_assessment_score}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, minimum_post_assessment_score: e.target.value }));
                          if (formErrors.postScore) setFormErrors((prev) => ({ ...prev, postScore: undefined }));
                        }}
                        error={formErrors.postScore}
                        aria-invalid={Boolean(formErrors.postScore)}
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="ft-composer-section">
                  <legend className="ft-composer-section__legend">
                    <span className="ft-composer-section__icon" aria-hidden>
                      <Calendar size={18} />
                    </span>
                    <span className="ft-composer-section__title">{t('form.sectionSchedule')}</span>
                  </legend>
                  <p className="ft-composer-section__help">{t('form.sectionScheduleHelp')}</p>
                  <div className="ft-composer-section__grid ft-composer-section__grid--2">
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

                <fieldset className="ft-composer-section">
                  <legend className="ft-composer-section__legend">
                    <span className="ft-composer-section__icon" aria-hidden>
                      <FileText size={18} />
                    </span>
                    <span className="ft-composer-section__title">{t('form.sectionDescription')}</span>
                  </legend>
                  <p className="ft-composer-section__help">{t('form.sectionDescriptionHelp')}</p>
                  <div className="ft-composer-section__grid ft-composer-section__grid--full">
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
              </div>

              <footer className="ft-modal__footer">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !canSubmitOpportunity}
                  className="ft-modal__submit"
                >
                  {isSubmitting ? t('saving') : t('save')}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

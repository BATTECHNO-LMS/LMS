import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  BookOpen,
  Tag,
  Clock,
  Users,
  ListChecks,
  Search,
  X,
  ChevronDown,
  SlidersHorizontal,
  Filter,
  GraduationCap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { cn } from '../../../utils/helpers.js';
import { resolveUploadUrl } from '../../../utils/uploadUrl.js';
import {
  buildCourseBody,
  EMPTY_COURSE_FORM,
  COURSE_LEVELS,
  COURSE_STATUSES,
  courseRowToForm,
  useAdminCourses,
  useArchiveCourse,
  useCreateCourse,
  usePublishCourse,
  useUpdateCourse,
  fetchAdminCourse,
} from '../../../features/courses/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { AdminCourseComposer } from './components/AdminCourseComposer.jsx';
import { AdminCoursesLessonsPopup } from './components/AdminCoursesLessonsPopup.jsx';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 320;

export function AdminCoursesPage() {
  const { t } = useTranslation('courses');
  const { t: tCommon } = useTranslation('common');

  const [composerOpen, setComposerOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_COURSE_FORM);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [bannerError, setBannerError] = useState('');
  const [lessonsPopupOpen, setLessonsPopupOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, debouncedSearch]
  );

  const { data, isLoading, isError, error, refetch } = useAdminCourses(listParams);
  const createMut = useCreateCourse();
  const updateMut = useUpdateCourse();
  const publishMut = usePublishCourse();
  const archiveMut = useArchiveCourse();

  const rows = data?.courses ?? [];
  const meta = data?.meta ?? {};
  const total = meta.total ?? rows.length;
  const totalPages = meta.total_pages ?? 1;

  /** Category options derived from the loaded page (no extra API call). */
  const categoryOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const c = (r.category || '').trim();
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows]);

  /** Client-side status/category narrowing; search stays server-side. */
  const visibleRows = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter && r.status !== statusFilter) return false;
        if (categoryFilter && (r.category || '').trim() !== categoryFilter) return false;
        return true;
      }),
    [rows, statusFilter, categoryFilter]
  );

  const hasActiveFilters = Boolean(statusFilter || categoryFilter);
  const clearAllFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
  };

  const saving = createMut.isPending || updateMut.isPending || publishMut.isPending;

  const scrollToComposer = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById('admin-course-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const startNewCourse = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_COURSE_FORM });
    setBannerError('');
    setComposerOpen(true);
    scrollToComposer();
  }, [scrollToComposer]);

  function handleToggleComposer() {
    if (composerOpen && !editingId) {
      setComposerOpen(false);
      return;
    }
    startNewCourse();
  }

  async function openEdit(row) {
    setEditingId(row.id);
    setForm(courseRowToForm(row));
    setBannerError('');
    setComposerOpen(true);
    scrollToComposer();
    try {
      const detail = await fetchAdminCourse(row.id);
      if (detail?.course) setForm(courseRowToForm(detail.course));
    } catch {
      /* keep list row */
    }
  }

  async function ensureCourseId(body) {
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, body });
      return editingId;
    }
    const created = await createMut.mutateAsync(body);
    const id = created?.course?.id;
    if (!id) throw new Error('missing course id');
    setEditingId(id);
    if (created.course) setForm(courseRowToForm(created.course));
    return id;
  }

  async function handleSaveDraft(body) {
    setBannerError('');
    try {
      await ensureCourseId(body);
      refetch();
    } catch (err) {
      setBannerError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleSaveChanges(body) {
    setBannerError('');
    if (!editingId) return;
    try {
      await updateMut.mutateAsync({ id: editingId, body });
      refetch();
    } catch (err) {
      setBannerError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handlePublishNew(body) {
    setBannerError('');
    try {
      const id = await ensureCourseId(body);
      await publishMut.mutateAsync(id);
      refetch();
      startNewCourse();
    } catch (err) {
      const msg = getApiErrorMessage(err, t('publishFailed'));
      const missing = err?.response?.data?.details?.missing;
      setBannerError(
        Array.isArray(missing) && missing.length
          ? `${msg}\n${missing.join('\n')}\n\n${t('publishHint')}`
          : `${msg}\n\n${t('publishHint')}`
      );
    }
  }

  async function handleAddLessons() {
    setBannerError('');
    if (!form.title.trim()) {
      setBannerError(t('composer.validation.titleRequired'));
      return;
    }
    try {
      const body = buildCourseBody(form);
      const id = editingId ?? (await ensureCourseId(body));
      if (!editingId) setEditingId(id);
      setLessonsPopupOpen(true);
      refetch();
    } catch (err) {
      setBannerError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  function handleArchive(row) {
    if (!window.confirm(t('composer.confirmArchive', { title: row.title }))) return;
    archiveMut.mutate(row.id, { onSuccess: () => refetch() });
  }

  function openLessonsFor(row) {
    setEditingId(row.id);
    setForm(courseRowToForm(row));
    setBannerError('');
    setLessonsPopupOpen(true);
  }

  async function publishRow(row) {
    setBannerError('');
    try {
      await publishMut.mutateAsync(row.id);
      refetch();
    } catch (err) {
      const msg = getApiErrorMessage(err, t('publishFailed'));
      const missing = err?.response?.data?.details?.missing;
      setBannerError(
        Array.isArray(missing) && missing.length
          ? `${msg}\n${missing.join('\n')}\n\n${t('publishHint')}`
          : `${msg}\n\n${t('publishHint')}`
      );
    }
  }

  const statusVariant = (s) => (s === 'published' ? 'success' : s === 'archived' ? 'muted' : 'warning');

  const levelLabel = (lvl) => {
    const found = COURSE_LEVELS.find((l) => l.value === lvl);
    return found ? t(found.labelKey) : lvl;
  };

  const cohortsLabel = (r) => {
    const list = r.cohorts ?? [];
    if (!list.length) return t('table.cohortsAll');
    if (list.length <= 2) return list.map((c) => c.title).join('، ');
    return t('table.cohortsCount', { count: list.length });
  };

  const toggleLabel =
    composerOpen && !editingId ? t('composer.hideAdd') : t('addCourse');

  const listCounter = t('composer.listCounter', {
    from: rows.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: (page - 1) * PAGE_SIZE + rows.length,
    total,
  });

  return (
    <div className="page page--dashboard page--admin admin-courses-page">
      <AdminPageHeader
        title={<>{t('title')}</>}
        description={<>{t('description')}</>}
        actions={
          <Button type="button" variant="primary" onClick={handleToggleComposer}>
            <Plus size={18} aria-hidden />
            {toggleLabel}
          </Button>
        }
      />

      {bannerError ? (
        <p className="admin-courses-page__alert crud-muted" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          {bannerError}
        </p>
      ) : null}

      <AdminCourseComposer
        open={composerOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => {
          if (editingId) {
            setComposerOpen(false);
            setEditingId(null);
            setForm({ ...EMPTY_COURSE_FORM });
          } else {
            setComposerOpen(false);
          }
        }}
        onSaveDraft={handleSaveDraft}
        onAddLessons={handleAddLessons}
        onPublish={editingId ? handleSaveChanges : handlePublishNew}
      />

      <section className="courses-toolbar" aria-label={t('toolbarTitle')}>
        <header className="courses-toolbar__head">
          <div className="courses-toolbar__head-text">
            <span className="courses-toolbar__head-icon" aria-hidden>
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="courses-toolbar__title">{t('toolbarTitle')}</h2>
              <p className="courses-toolbar__subtitle">{t('toolbarSubtitle')}</p>
            </div>
          </div>
          <span className="courses-toolbar__count">{listCounter}</span>
        </header>

        <div className="courses-toolbar__body">
          <div className="courses-toolbar__field courses-toolbar__field--search">
            <span className="courses-toolbar__label" id="courses-search-label">
              {tCommon('actions.search')}
            </span>
            <div className="courses-search">
              <Search className="courses-search__icon" size={18} aria-hidden />
              <input
                type="search"
                className="courses-search__input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('composer.searchPlaceholder')}
                aria-labelledby="courses-search-label"
              />
              {searchInput ? (
                <button
                  type="button"
                  className="courses-search__clear"
                  onClick={() => setSearchInput('')}
                  aria-label={t('clearSearch')}
                >
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="courses-toolbar__field">
            <span className="courses-toolbar__label" id="courses-status-label">
              {t('filterStatus')}
            </span>
            <div className="courses-select">
              <Filter className="courses-select__icon" size={16} aria-hidden />
              <select
                className="courses-select__control"
                aria-labelledby="courses-status-label"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t('filterAllStatuses')}</option>
                {COURSE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
              <ChevronDown className="courses-select__chevron" size={16} aria-hidden />
            </div>
          </div>

          <div className="courses-toolbar__field">
            <span className="courses-toolbar__label" id="courses-category-label">
              {t('filterCategory')}
            </span>
            <div className="courses-select">
              <Tag className="courses-select__icon" size={16} aria-hidden />
              <select
                className="courses-select__control"
                aria-labelledby="courses-category-label"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">{t('filterAllCategories')}</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="courses-select__chevron" size={16} aria-hidden />
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="courses-toolbar__chips">
            {statusFilter ? (
              <button
                type="button"
                className="filter-chip"
                onClick={() => setStatusFilter('')}
                aria-label={t('removeFilter')}
              >
                <span className="filter-chip__label">
                  {t('filterStatus')}: {t(`status.${statusFilter}`)}
                </span>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            {categoryFilter ? (
              <button
                type="button"
                className="filter-chip"
                onClick={() => setCategoryFilter('')}
                aria-label={t('removeFilter')}
              >
                <span className="filter-chip__label">
                  {t('filterCategory')}: {categoryFilter}
                </span>
                <X size={14} aria-hidden />
              </button>
            ) : null}
            <button type="button" className="filter-chip filter-chip--clear" onClick={clearAllFilters}>
              {t('clearFilters')}
            </button>
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <LoadingSpinner />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={isError ? tCommon('errors.generic') : t('composer.emptyList')}
          description={isError ? String(error?.message ?? '') : t('description')}
          action={
            !isError ? (
              <Button type="button" variant="primary" onClick={startNewCourse}>
                <Plus size={18} aria-hidden />
                {t('composer.addCourse')}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="course-cards-grid">
            {visibleRows.map((r) => {
              const cover = r.cover_image_url ? resolveUploadUrl(r.cover_image_url) : null;
              const lessonsCount = r.lessons_count ?? null;
              const isActive = r.id === editingId && composerOpen;
              return (
                <article key={r.id} className={cn('course-card', isActive && 'is-active')}>
                  <div className={cn('course-card__cover', !cover && 'course-card__cover--placeholder')}>
                    {cover ? (
                      <img src={cover} alt="" className="course-card__cover-img" loading="lazy" />
                    ) : (
                      <div className="course-card__cover-fallback" aria-hidden>
                        <BookOpen size={36} strokeWidth={1.5} />
                      </div>
                    )}
                    <span className="course-card__cover-scrim" aria-hidden />
                    <StatusBadge variant={statusVariant(r.status)} className="course-card__status">
                      {t(`status.${r.status}`)}
                    </StatusBadge>
                    <span className="course-card__cover-chip">
                      <GraduationCap size={13} aria-hidden /> {levelLabel(r.level)}
                    </span>
                  </div>

                  <div className="course-card__body">
                    <h3 className="course-card__title">
                      <button type="button" className="admin-courses-row__title-btn" onClick={() => openEdit(r)}>
                        {r.title}
                      </button>
                    </h3>
                    <p className={cn('course-card__desc', !r.short_description && 'course-card__desc--empty')}>
                      {r.short_description || t('cardNoDescription')}
                    </p>

                    <div className="course-card__info">
                      {r.estimated_duration_minutes ? (
                        <div className="course-card__info-item">
                          <span className="course-card__info-icon" aria-hidden>
                            <Clock size={15} />
                          </span>
                          <span className="course-card__info-text">
                            {t('cardMinutes', { count: r.estimated_duration_minutes })}
                          </span>
                        </div>
                      ) : null}
                      {lessonsCount != null ? (
                        <div className="course-card__info-item">
                          <span className="course-card__info-icon" aria-hidden>
                            <ListChecks size={15} />
                          </span>
                          <span className="course-card__info-text">
                            {t('cardLessons', { count: lessonsCount })}
                          </span>
                        </div>
                      ) : null}
                      <div className="course-card__info-item">
                        <span className="course-card__info-icon" aria-hidden>
                          <Tag size={15} />
                        </span>
                        <span className="course-card__info-text">
                          {r.category?.trim() || t('cardNoCategory')}
                        </span>
                      </div>
                    </div>

                    <div className="course-card__cohorts">
                      <Users size={14} aria-hidden />
                      <span>{cohortsLabel(r)}</span>
                    </div>
                  </div>

                  <div className="course-card__actions">
                    <div className="course-card__actions-main">
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => openLessonsFor(r)}
                      >
                        <ListChecks size={15} aria-hidden /> {t('manageLessons')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--outline"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil size={15} aria-hidden /> {t('edit')}
                      </button>
                    </div>
                    <div className="course-card__actions-end">
                      {r.status === 'draft' ? (
                        <button
                          type="button"
                          className="btn btn--sm course-card__publish"
                          disabled={publishMut.isPending}
                          onClick={() => publishRow(r)}
                        >
                          {t('publish')}
                        </button>
                      ) : null}
                      {r.status !== 'archived' ? (
                        <button
                          type="button"
                          className="btn btn--icon btn--sm course-card__archive"
                          title={t('archive')}
                          aria-label={t('archive')}
                          onClick={() => handleArchive(r)}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="admin-courses-pagination">
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('composer.prevPage')}
              </Button>
              <span className="crud-muted">{t('composer.pageOf', { page, total: totalPages })}</span>
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('composer.nextPage')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <AdminCoursesLessonsPopup
        open={lessonsPopupOpen}
        courseId={editingId}
        courseTitle={form.title}
        onClose={() => setLessonsPopupOpen(false)}
        onLessonsChange={() => refetch()}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, SearchInput, SectionCard } from '../../../components/admin/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import {
  buildCourseBody,
  EMPTY_COURSE_FORM,
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

  const statusVariant = (s) => (s === 'published' ? 'success' : s === 'archived' ? 'muted' : 'warning');

  const toggleLabel =
    composerOpen && !editingId ? t('composer.hideAdd') : t('addCourse');

  const listCounter = t('composer.listCounter', {
    from: rows.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: (page - 1) * PAGE_SIZE + rows.length,
    total,
  });

  return (
    <div className="page page--dashboard page--admin admin-courses-page">
      <header className="admin-courses-page__top">
        <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
        <Button type="button" variant="primary" onClick={handleToggleComposer}>
          <Plus size={18} aria-hidden />
          {toggleLabel}
        </Button>
      </header>

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

      <SectionCard
        title={<>{t('listTitle')}</>}
        className="admin-courses-table-card"
        actions={
          <div className="admin-courses-table-card__tools">
            <span className="admin-courses-table-card__count">{listCounter}</span>
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('composer.searchPlaceholder')}
              aria-label={tCommon('actions.search')}
              className="admin-courses-table-card__search"
            />
          </div>
        }
      >
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            className="admin-courses-data-table"
            emptyTitle={isError ? tCommon('errors.generic') : t('composer.emptyList')}
            emptyDescription={isError ? String(error?.message ?? '') : ''}
            getRowClassName={(row) =>
              row.id === editingId && composerOpen ? 'admin-courses-row--active' : undefined
            }
            columns={[
              {
                key: 'title',
                label: t('table.title'),
                mobileTitle: true,
                render: (r) => (
                  <button type="button" className="admin-courses-row__title-btn" onClick={() => openEdit(r)}>
                    {r.title}
                  </button>
                ),
              },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={statusVariant(r.status)}>{t(`status.${r.status}`)}</StatusBadge>
                ),
              },
              {
                key: 'category',
                label: t('table.category'),
                render: (r) => r.category?.trim() || '—',
              },
              {
                key: 'cohorts',
                label: t('table.cohorts'),
                render: (r) => {
                  const list = r.cohorts ?? [];
                  if (!list.length) return t('table.cohortsAll');
                  if (list.length <= 2) return list.map((c) => c.title).join('، ');
                  return t('table.cohortsCount', { count: list.length });
                },
              },
              {
                key: 'actions',
                label: t('table.actions'),
                render: (r) => (
                  <div className="table-row-actions">
                    <button
                      type="button"
                      className="btn btn--icon btn--ghost"
                      title={t('edit')}
                      onClick={() => openEdit(r)}
                    >
                      <Pencil size={18} />
                    </button>
                    {r.status === 'draft' ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={publishMut.isPending}
                        onClick={async () => {
                          setBannerError('');
                          try {
                            await publishMut.mutateAsync(r.id);
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
                        }}
                      >
                        {t('publish')}
                      </button>
                    ) : null}
                    {r.status !== 'archived' ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost admin-courses-row__archive"
                        onClick={() => handleArchive(r)}
                      >
                        <Trash2 size={16} aria-hidden /> {t('archive')}
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={rows}
            footer={
              totalPages > 1 ? (
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
                  <span className="crud-muted">
                    {t('composer.pageOf', { page, total: totalPages })}
                  </span>
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
              ) : null
            }
          />
        )}
      </SectionCard>

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

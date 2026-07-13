import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Youtube } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import {
  lessonVideoId,
  previewYoutubePlaylist,
  useCourseStructure,
  useCourseStructureMutations,
} from '../../../../features/courses/index.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { AdminLessonRow } from './AdminLessonRow.jsx';
import { CourseLessonFormModal } from './CourseLessonFormModal.jsx';

function sortedLessons(lessons = []) {
  return [...lessons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function AdminCourseLessonsPanel({ courseId, onLessonsChange, onDone }) {
  const { t } = useTranslation('courses');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, refetch } = useCourseStructure(courseId);
  const mut = useCourseStructureMutations(courseId);

  const [playlistUrl, setPlaylistUrl] = useState('');
  const [singleVideoUrl, setSingleVideoUrl] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [expandedLessonId, setExpandedLessonId] = useState(null);
  const [dragLessonId, setDragLessonId] = useState(null);
  const [dragSectionId, setDragSectionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lessonModal, setLessonModal] = useState({
    open: false,
    mode: 'create',
    sectionId: null,
    lesson: null,
  });
  const sectionInit = useRef(false);
  const draftSync = useRef(false);
  const titleDebounce = useRef(null);

  const courseStatus = data?.course?.status ?? null;
  const lessonDefaultStatus = courseStatus === 'published' ? 'published' : 'draft';

  const sections = useMemo(() => {
    const list = [...(data?.sections ?? [])];
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return list;
  }, [data?.sections]);

  const primarySection = sections[0] ?? null;
  const sectionId = primarySection?.id ?? null;

  const totalLessons = useMemo(
    () => sections.reduce((n, s) => n + (s.lessons?.length ?? 0), 0),
    [sections]
  );

  const allLessons = useMemo(
    () =>
      sections.flatMap((s) =>
        sortedLessons(s.lessons).map((l) => ({ ...l, section_id: l.section_id || s.id }))
      ),
    [sections]
  );

  const draftCount = useMemo(
    () => allLessons.filter((l) => l.status !== 'published').length,
    [allLessons]
  );

  const existingVideoIds = useMemo(
    () => new Set(allLessons.map((l) => lessonVideoId(l)).filter(Boolean)),
    [allLessons]
  );

  const ensureDefaultSection = useCallback(async () => {
    if (!courseId || sectionInit.current || sections.length > 0) return;
    sectionInit.current = true;
    try {
      await mut.createSection.mutateAsync({ title: t('lessonsPanel.defaultSectionTitle') });
      await refetch();
    } catch {
      sectionInit.current = false;
    }
  }, [courseId, sections.length, mut.createSection, refetch, t]);

  useEffect(() => {
    if (courseId && !isLoading && !isError && sections.length === 0) {
      ensureDefaultSection();
    }
  }, [courseId, isLoading, isError, sections.length, ensureDefaultSection]);

  // Published courses hide draft lessons from students — publish drafts so content is visible
  useEffect(() => {
    if (draftSync.current || isLoading || isError || !courseId) return;
    if (courseStatus !== 'published' || draftCount === 0) return;
    draftSync.current = true;
    (async () => {
      try {
        await mut.publishDraftLessons.mutateAsync();
        await refetch();
        onLessonsChange?.();
      } catch {
        draftSync.current = false;
      }
    })();
  }, [
    courseId,
    courseStatus,
    draftCount,
    isLoading,
    isError,
    mut.publishDraftLessons,
    refetch,
    onLessonsChange,
  ]);

  useEffect(() => {
    if (primarySection?.title) setSectionTitle(primarySection.title);
  }, [primarySection?.id, primarySection?.title]);

  useEffect(() => {
    return () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current);
    };
  }, []);

  function handleSectionTitleChange(value) {
    setSectionTitle(value);
    if (!sectionId) return;
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(async () => {
      const title = value.trim();
      if (title.length < 2) return;
      try {
        await mut.updateSection.mutateAsync({ sectionId, body: { title } });
        onLessonsChange?.();
      } catch {
        /* ignore */
      }
    }, 500);
  }

  async function addVideosFromPreview(url) {
    setError('');
    setBusy(true);
    try {
      const preview = await previewYoutubePlaylist(courseId, url);
      const videos = preview?.videos ?? [];
      const seen = new Set(existingVideoIds);
      let added = 0;
      const baseOrder = sortedLessons(primarySection?.lessons).length;
      for (let i = 0; i < videos.length; i += 1) {
        const v = videos[i];
        if (seen.has(v.video_id)) continue;
        await mut.createLesson.mutateAsync({
          sectionId,
          body: {
            title: v.title,
            type: 'video',
            video_url: v.watch_url,
            status: lessonDefaultStatus,
            sort_order: baseOrder + added,
            is_preview: false,
            is_required: true,
          },
        });
        seen.add(v.video_id);
        added += 1;
      }
      if (!added && videos.length) {
        setError(t('lessonsPanel.allVideosExist'));
      }
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  async function handleFetchPlaylist() {
    if (!playlistUrl.trim()) return;
    if (!sectionId) {
      setError(t('lessonsPanel.waitSection'));
      return;
    }
    await addVideosFromPreview(playlistUrl.trim());
    setPlaylistUrl('');
  }

  async function handleAddSingle() {
    if (!singleVideoUrl.trim()) return;
    if (!sectionId) {
      setError(t('lessonsPanel.waitSection'));
      return;
    }
    await addVideosFromPreview(singleVideoUrl.trim());
    setSingleVideoUrl('');
  }

  function openAddLesson(targetSectionId) {
    setLessonModal({
      open: true,
      mode: 'create',
      sectionId: targetSectionId || sectionId,
      lesson: null,
    });
  }

  async function handleDeleteLesson(lesson) {
    if (!window.confirm(t('structure.confirmDeleteLesson', { title: lesson.title ?? '' }))) return;
    setBusy(true);
    try {
      await mut.deleteLesson.mutateAsync(lesson.id);
      if (expandedLessonId === lesson.id) setExpandedLessonId(null);
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLesson(lessonId, body) {
    setBusy(true);
    try {
      await mut.updateLesson.mutateAsync({ lessonId, body });
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  async function handleLessonModalSubmit(body) {
    try {
      if (lessonModal.mode === 'edit' && lessonModal.lesson) {
        await mut.updateLesson.mutateAsync({ lessonId: lessonModal.lesson.id, body });
      } else if (lessonModal.sectionId) {
        await mut.createLesson.mutateAsync({ sectionId: lessonModal.sectionId, body });
      }
      setLessonModal({ open: false, mode: 'create', sectionId: null, lesson: null });
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleReorder(targetLessonId, targetSectionId) {
    if (!dragLessonId || dragLessonId === targetLessonId) return;
    if (!dragSectionId || dragSectionId !== targetSectionId) {
      setDragLessonId(null);
      setDragSectionId(null);
      return;
    }
    const section = sections.find((s) => s.id === targetSectionId);
    if (!section) return;
    const ordered = sortedLessons(section.lessons);
    const from = ordered.findIndex((l) => l.id === dragLessonId);
    const to = ordered.findIndex((l) => l.id === targetLessonId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const items = ordered.map((l, i) => ({
      lesson_id: l.id,
      section_id: targetSectionId,
      sort_order: i,
    }));
    setBusy(true);
    try {
      await mut.reorderLessons.mutateAsync(items);
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    } finally {
      setBusy(false);
      setDragLessonId(null);
      setDragSectionId(null);
    }
  }

  async function handlePublishDrafts() {
    setError('');
    setBusy(true);
    try {
      await mut.publishDraftLessons.mutateAsync();
      await refetch();
      onLessonsChange?.();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    } finally {
      setBusy(false);
    }
  }

  const subtitle =
    totalLessons === 0
      ? t('lessonsPanel.noLessonsYet')
      : t('lessonsPanel.lessonsCount', { count: totalLessons });

  if (!courseId) {
    return <p className="crud-muted">{t('composer.saveDraftBeforeLessons')}</p>;
  }

  if (isLoading || (!sectionId && !isError)) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <div className="admin-course-lessons-panel__error-state">
        <p className="crud-muted" role="alert">
          {t('structure.loadFailed')}
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          {t('structure.retry')}
        </Button>
      </div>
    );
  }

  let globalIndex = 0;

  return (
    <div className="admin-course-lessons-panel">
      <p className="admin-course-lessons-panel__subtitle">{subtitle}</p>

      {error ? (
        <p className="admin-course-lessons-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      {draftCount > 0 ? (
        <div className="admin-course-lessons-panel__draft-banner" role="status">
          <p>{t('lessonsPanel.draftsHiddenHint', { count: draftCount })}</p>
          <Button
            type="button"
            variant="primary"
            className="btn--sm"
            disabled={busy || mut.publishDraftLessons.isPending}
            onClick={handlePublishDrafts}
          >
            {t('lessonsPanel.publishDrafts')}
          </Button>
        </div>
      ) : null}

      <div className="admin-course-lessons-panel__import">
        <label className="admin-course-lessons-panel__label" htmlFor="yt-playlist-url">
          {t('lessonsPanel.playlistLabel')}
        </label>
        <div className="admin-course-lessons-panel__row">
          <input
            id="yt-playlist-url"
            type="url"
            className="admin-course-lessons-panel__input"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=..."
            dir="ltr"
          />
          <Button
            type="button"
            variant="primary"
            className="admin-course-lessons-panel__fetch-btn"
            disabled={busy}
            onClick={handleFetchPlaylist}
          >
            <Youtube size={18} aria-hidden />
            {t('lessonsPanel.fetchLessons')}
          </Button>
        </div>
      </div>

      <div className="admin-course-lessons-panel__import">
        <label className="admin-course-lessons-panel__label" htmlFor="yt-single-url">
          {t('lessonsPanel.singleVideoLabel')}
        </label>
        <div className="admin-course-lessons-panel__row">
          <input
            id="yt-single-url"
            type="url"
            className="admin-course-lessons-panel__input"
            value={singleVideoUrl}
            onChange={(e) => setSingleVideoUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            dir="ltr"
          />
          <Button
            type="button"
            variant="outline"
            className="admin-course-lessons-panel__add-btn"
            disabled={busy}
            onClick={handleAddSingle}
          >
            <Plus size={18} aria-hidden />
            {t('lessonsPanel.add')}
          </Button>
        </div>
      </div>

      <div className="admin-course-lessons-panel__section-title">
        <label className="admin-course-lessons-panel__label" htmlFor="section-title-input">
          {t('lessonsPanel.sectionTitleLabel')}
        </label>
        <div className="admin-course-lessons-panel__row">
          <input
            id="section-title-input"
            type="text"
            className="admin-course-lessons-panel__input"
            value={sectionTitle}
            onChange={(e) => handleSectionTitleChange(e.target.value)}
          />
          <Button
            type="button"
            variant="primary"
            className="admin-course-lessons-panel__add-btn"
            disabled={busy || !sectionId}
            onClick={() => openAddLesson(sectionId)}
          >
            <Plus size={18} aria-hidden />
            {t('lessonsPanel.addLesson')}
          </Button>
        </div>
      </div>

      <div className="admin-course-lessons-panel__list-wrap">
        {totalLessons === 0 ? (
          <div className="admin-course-lessons-panel__empty">
            <p>{t('lessonsPanel.emptyNoLessons')}</p>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !sectionId}
              onClick={() => openAddLesson(sectionId)}
            >
              <Plus size={18} aria-hidden />
              {t('lessonsPanel.addLesson')}
            </Button>
          </div>
        ) : (
          <div className="admin-course-lessons-panel__list">
            {sections.map((section) => {
              const lessons = sortedLessons(section.lessons);
              if (!lessons.length && sections.length > 1) {
                return (
                  <div key={section.id} className="admin-course-lessons-panel__section-block">
                    <h3 className="admin-course-lessons-panel__section-heading">{section.title}</h3>
                    <p className="crud-muted">{t('structure.noLessonsInSection')}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => openAddLesson(section.id)}
                    >
                      <Plus size={16} aria-hidden />
                      {t('lessonsPanel.addLesson')}
                    </Button>
                  </div>
                );
              }
              return (
                <div key={section.id} className="admin-course-lessons-panel__section-block">
                  {sections.length > 1 ? (
                    <h3 className="admin-course-lessons-panel__section-heading">{section.title}</h3>
                  ) : null}
                  {lessons.map((lesson) => {
                    const index = globalIndex;
                    globalIndex += 1;
                    return (
                      <AdminLessonRow
                        key={lesson.id}
                        courseId={courseId}
                        index={index}
                        lesson={lesson}
                        expanded={expandedLessonId === lesson.id}
                        saving={busy}
                        draggable
                        onToggleExpand={() =>
                          setExpandedLessonId((id) => (id === lesson.id ? null : lesson.id))
                        }
                        onDelete={() => handleDeleteLesson(lesson)}
                        onSave={(body) => handleSaveLesson(lesson.id, body)}
                        onDragStart={() => {
                          setDragLessonId(lesson.id);
                          setDragSectionId(section.id);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleReorder(lesson.id, section.id);
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="admin-course-lessons-panel__footer">
        <Button type="button" variant="primary" className="admin-course-lessons-panel__done" onClick={onDone}>
          {t('lessonsPanel.done', { count: totalLessons })}
        </Button>
      </footer>

      <CourseLessonFormModal
        open={lessonModal.open}
        mode={lessonModal.mode}
        initialLesson={lessonModal.lesson}
        saving={mut.createLesson.isPending || mut.updateLesson.isPending}
        onClose={() => setLessonModal({ open: false, mode: 'create', sectionId: null, lesson: null })}
        onSubmit={handleLessonModalSubmit}
      />
    </div>
  );
}

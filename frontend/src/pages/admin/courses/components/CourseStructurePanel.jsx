import { useMemo, useState } from 'react';
import { BookOpen, Layers, Plus, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminStatsGrid } from '../../../../components/admin/index.js';
import { Button } from '../../../../components/common/Button.jsx';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { ConfirmDeleteModal } from '../../../../components/modals/ConfirmDeleteModal.jsx';
import {
  computeStructureStats,
  useCourseStructure,
  useCourseStructureMutations,
} from '../../../../features/courses/index.js';
import { CourseSectionCard } from './CourseSectionCard.jsx';
import { CourseSectionFormModal } from './CourseSectionFormModal.jsx';
import { CourseLessonFormModal } from './CourseLessonFormModal.jsx';

export function CourseStructurePanel({ courseId, compact = false, onLessonsChange }) {
  const { t } = useTranslation('courses');
  const { data, isLoading, isError, refetch, isFetching } = useCourseStructure(courseId);
  const mut = useCourseStructureMutations(courseId);

  const [sectionModal, setSectionModal] = useState({ open: false, mode: 'create', section: null });
  const [lessonModal, setLessonModal] = useState({
    open: false,
    mode: 'create',
    sectionId: null,
    lesson: null,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const structure = data;
  const sections = structure?.sections ?? [];
  const stats = useMemo(() => computeStructureStats(sections), [sections]);

  const savingSection = mut.createSection.isPending || mut.updateSection.isPending;
  const savingLesson = mut.createLesson.isPending || mut.updateLesson.isPending;
  const reordering = mut.reorderLessons.isPending;

  async function afterMutation() {
    await refetch();
    onLessonsChange?.();
  }

  function openAddSection() {
    setSectionModal({ open: true, mode: 'create', section: null });
  }

  function openEditSection(section) {
    setSectionModal({ open: true, mode: 'edit', section });
  }

  async function handleSectionSubmit(title) {
    try {
      if (sectionModal.mode === 'edit' && sectionModal.section) {
        await mut.updateSection.mutateAsync({
          sectionId: sectionModal.section.id,
          body: { title },
        });
      } else {
        await mut.createSection.mutateAsync({ title });
      }
      setSectionModal({ open: false, mode: 'create', section: null });
      await afterMutation();
    } catch {
      /* keep modal */
    }
  }

  function openAddLesson(sectionId) {
    setLessonModal({ open: true, mode: 'create', sectionId, lesson: null });
  }

  function openEditLesson(sectionId, lesson) {
    setLessonModal({ open: true, mode: 'edit', sectionId, lesson });
  }

  async function handleLessonSubmit(body) {
    try {
      if (lessonModal.mode === 'edit' && lessonModal.lesson) {
        await mut.updateLesson.mutateAsync({
          lessonId: lessonModal.lesson.id,
          body,
        });
      } else if (lessonModal.sectionId) {
        await mut.createLesson.mutateAsync({
          sectionId: lessonModal.sectionId,
          body,
        });
      }
      setLessonModal({ open: false, mode: 'create', sectionId: null, lesson: null });
      await afterMutation();
    } catch {
      /* keep modal */
    }
  }

  async function handleMoveLesson(section, lessonId, direction) {
    const lessons = [...(section.lessons ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= lessons.length) return;
    [lessons[idx], lessons[target]] = [lessons[target], lessons[idx]];
    const items = lessons.map((l, i) => ({
      lesson_id: l.id,
      section_id: section.id,
      sort_order: i,
    }));
    await mut.reorderLessons.mutateAsync(items);
    await afterMutation();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'section') {
        await mut.deleteSection.mutateAsync(deleteTarget.id);
      } else {
        await mut.deleteLesson.mutateAsync(deleteTarget.id);
      }
      setDeleteTarget(null);
      await afterMutation();
    } catch {
      setDeleteTarget(null);
    }
  }

  if (!courseId) {
    return <p className="crud-muted">{t('composer.saveDraftBeforeLessons')}</p>;
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError || !structure?.course) {
    return (
      <div>
        <p className="crud-muted" role="alert">{t('structure.loadFailed')}</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>{t('structure.retry')}</Button>
      </div>
    );
  }

  return (
    <div className="course-structure-panel">
      <div className="course-structure-toolbar">
        <div className="course-structure-toolbar__actions">
          <Button type="button" variant="outline" className="btn--sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={16} aria-hidden /> {t('structure.refresh')}
          </Button>
          <Button type="button" variant="primary" className="btn--sm" onClick={openAddSection}>
            <Plus size={16} aria-hidden /> {t('structure.addSection')}
          </Button>
        </div>
      </div>

      {!compact ? (
        <AdminStatsGrid>
          <StatCard label={t('structure.statsSections')} value={String(stats.sectionsCount)} icon={Layers} />
          <StatCard label={t('structure.statsLessons')} value={String(stats.lessonsCount)} icon={BookOpen} />
          <StatCard label={t('structure.statsPublished')} value={String(stats.publishedLessons)} icon={Send} />
          <StatCard label={t('structure.statsDraft')} value={String(stats.draftLessons)} icon={BookOpen} />
        </AdminStatsGrid>
      ) : null}

      {sections.length === 0 ? (
        <div className="course-structure-empty course-structure-empty--page">
          <p>{t('structure.emptySections')}</p>
          <Button type="button" variant="primary" onClick={openAddSection}>
            <Plus size={16} aria-hidden /> {t('structure.addSection')}
          </Button>
        </div>
      ) : (
        <div className="course-structure-sections">
          {sections.map((sec) => (
            <CourseSectionCard
              key={sec.id}
              section={sec}
              reordering={reordering}
              onEditSection={openEditSection}
              onDeleteSection={(section) =>
                setDeleteTarget({ type: 'section', id: section.id, title: section.title })
              }
              onAddLesson={openAddLesson}
              onEditLesson={openEditLesson}
              onDeleteLesson={(lesson) =>
                setDeleteTarget({ type: 'lesson', id: lesson.id, title: lesson.title })
              }
              onMoveLesson={handleMoveLesson}
            />
          ))}
        </div>
      )}

      <CourseSectionFormModal
        open={sectionModal.open}
        mode={sectionModal.mode}
        initialTitle={sectionModal.section?.title ?? ''}
        saving={savingSection}
        onClose={() => setSectionModal({ open: false, mode: 'create', section: null })}
        onSubmit={handleSectionSubmit}
      />

      <CourseLessonFormModal
        open={lessonModal.open}
        mode={lessonModal.mode}
        initialLesson={lessonModal.lesson}
        saving={savingLesson}
        onClose={() => setLessonModal({ open: false, mode: 'create', sectionId: null, lesson: null })}
        onSubmit={handleLessonSubmit}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'section' ? t('structure.deleteSection') : t('structure.deleteLesson')}
        message={
          deleteTarget?.type === 'section'
            ? t('structure.confirmDeleteSection', { title: deleteTarget?.title ?? '' })
            : t('structure.confirmDeleteLesson', { title: deleteTarget?.title ?? '' })
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

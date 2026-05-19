import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';

function sortedLessons(lessons = []) {
  return [...lessons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function lessonStatusVariant(status) {
  return status === 'published' ? 'success' : 'warning';
}

export function CourseSectionCard({
  section,
  reordering,
  onEditSection,
  onDeleteSection,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
}) {
  const { t } = useTranslation('courses');
  const lessons = sortedLessons(section.lessons);

  return (
    <article className="course-structure-section">
      <header className="course-structure-section__head">
        <div>
          <h3 className="course-structure-section__title">{section.title}</h3>
          <p className="crud-muted course-structure-section__meta">
            {t('structure.lessonsInSection', { count: lessons.length })}
          </p>
        </div>
        <div className="course-structure-section__actions">
          <Button type="button" variant="outline" className="btn--sm" onClick={() => onAddLesson(section.id)}>
            <Plus size={14} aria-hidden /> {t('structure.addLessonInSection')}
          </Button>
          <button type="button" className="btn btn--icon btn--ghost" onClick={() => onEditSection(section)} title={t('structure.editSection')}>
            <Pencil size={16} />
          </button>
          <button type="button" className="btn btn--icon btn--ghost" onClick={() => onDeleteSection(section)} title={t('structure.deleteSection')}>
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {lessons.length === 0 ? (
        <p className="course-structure-empty">{t('structure.noLessonsInSection')}</p>
      ) : (
        <ul className="course-structure-lessons">
          {lessons.map((lesson, index) => (
            <li key={lesson.id} className="course-structure-lesson">
              <div className="course-structure-lesson__main">
                <p className="course-structure-lesson__title">{lesson.title}</p>
                <div className="course-structure-lesson__badges">
                  <StatusBadge variant="muted">{t(`lessonTypes.${lesson.type}`)}</StatusBadge>
                  <StatusBadge variant={lessonStatusVariant(lesson.status)}>
                    {t(`status.${lesson.status}`)}
                  </StatusBadge>
                  {lesson.duration_minutes != null ? (
                    <span className="crud-muted course-structure-lesson__dur">
                      {lesson.duration_minutes} {t('student.minutes')}
                    </span>
                  ) : null}
                </div>
                {lesson.description ? (
                  <p className="crud-muted course-structure-lesson__desc">{lesson.description}</p>
                ) : null}
              </div>
              <div className="course-structure-lesson__actions">
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  disabled={index === 0 || reordering}
                  onClick={() => onMoveLesson(section, lesson.id, 'up')}
                  title={t('structure.moveUp')}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  disabled={index === lessons.length - 1 || reordering}
                  onClick={() => onMoveLesson(section, lesson.id, 'down')}
                  title={t('structure.moveDown')}
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  onClick={() => onEditLesson(section.id, lesson)}
                  title={t('structure.editLesson')}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  onClick={() => onDeleteLesson(lesson)}
                  title={t('structure.deleteLesson')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormSwitch } from '../../../../components/forms/FormSwitch.jsx';
import { lessonFormToBody, lessonToForm, validateLessonForm } from '../../../../features/courses/courseStructureValidation.js';
import { lessonVideoId, youtubeThumbnail } from '../../../../features/courses/youtubeUtils.js';
import { AdminLessonTrainingSection } from './AdminLessonTrainingSection.jsx';

export function AdminLessonRow({
  courseId,
  index,
  lesson,
  expanded,
  onToggleExpand,
  onDelete,
  onSave,
  saving,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const { t } = useTranslation('courses');
  const [form, setForm] = useState(() => lessonToForm(lesson));
  const videoId = lessonVideoId(lesson);
  const thumb = videoId ? youtubeThumbnail(videoId) : null;

  useEffect(() => {
    setForm(lessonToForm(lesson));
  }, [lesson]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCollapse() {
    if (expanded) {
      const errors = validateLessonForm(form, t);
      if (Object.keys(errors).length) return;
      onSave(lessonFormToBody(form));
    }
    onToggleExpand();
  }

  if (!expanded) {
    return (
      <div
        className="admin-lesson-row"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="admin-lesson-row__drag"
          aria-label={t('lessonsPanel.dragHandle')}
          draggable={draggable}
          onDragStart={onDragStart}
        >
          <GripVertical size={18} />
        </button>
        {thumb ? (
          <img src={thumb} alt="" className="admin-lesson-row__thumb" />
        ) : (
          <div className="admin-lesson-row__thumb admin-lesson-row__thumb--placeholder">
            <Video size={22} />
          </div>
        )}
        <button type="button" className="admin-lesson-row__main" onClick={onToggleExpand}>
          <span className="admin-lesson-row__title">
            {index + 1}. {lesson.title}
          </span>
          <span className="admin-lesson-row__type">{t('lessonsPanel.normalLesson')}</span>
        </button>
        <div className="admin-lesson-row__actions">
          <button
            type="button"
            className="btn btn--icon btn--ghost admin-lesson-row__delete"
            onClick={onDelete}
            aria-label={t('structure.deleteLesson')}
          >
            <Trash2 size={18} />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="admin-lesson-row admin-lesson-row--expanded"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="admin-lesson-row__expanded-head">
        <button
          type="button"
          className="btn btn--icon btn--ghost admin-lesson-row__delete"
          onClick={onDelete}
        >
          <Trash2 size={18} />
        </button>
        <button type="button" className="btn btn--icon btn--ghost" onClick={handleCollapse}>
          <ChevronUp size={18} />
        </button>
        <div className="admin-lesson-row__expanded-summary">
          {thumb ? (
            <img src={thumb} alt="" className="admin-lesson-row__thumb" />
          ) : (
            <div className="admin-lesson-row__thumb admin-lesson-row__thumb--placeholder">
              <Video size={22} />
            </div>
          )}
          <div>
            <p className="admin-lesson-row__title">
              {index + 1}. {form.title || lesson.title}
            </p>
            <p className="admin-lesson-row__type">{t('lessonsPanel.normalLesson')}</p>
          </div>
        </div>
      </div>

      <div className="admin-lesson-row__form">
        <label className="admin-lesson-row__label" htmlFor={`lesson-title-${lesson.id}`}>
          {t('structure.lessonTitle')}
        </label>
        <input
          id={`lesson-title-${lesson.id}`}
          type="text"
          className="admin-lesson-row__input"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
        />

        <label className="admin-lesson-row__label" htmlFor={`lesson-desc-${lesson.id}`}>
          {t('structure.lessonDescription')}
        </label>
        <textarea
          id={`lesson-desc-${lesson.id}`}
          className="admin-lesson-row__textarea"
          rows={4}
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
        />

        <p className="admin-lesson-row__label">{t('lessonsPanel.attachments')}</p>
        <div className="admin-lesson-row__dropzone">
          <Upload size={28} aria-hidden />
          <p>{t('lessonsPanel.dropzoneHint')}</p>
          <span className="admin-lesson-row__dropzone-meta">{t('lessonsPanel.dropzoneMeta')}</span>
        </div>

        <FormSwitch
          id={`lesson-preview-${lesson.id}`}
          label={t('lessonsPanel.freePreview')}
          checked={form.is_preview}
          onChange={(e) => setField('is_preview', e.target.checked)}
        />

        {courseId ? <AdminLessonTrainingSection courseId={courseId} lessonId={lesson.id} /> : null}

        <div className="admin-lesson-row__form-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={saving}
            onClick={() => {
              const errors = validateLessonForm(form, t);
              if (Object.keys(errors).length) return;
              onSave(lessonFormToBody(form));
              onToggleExpand();
            }}
          >
            {saving ? t('structure.saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

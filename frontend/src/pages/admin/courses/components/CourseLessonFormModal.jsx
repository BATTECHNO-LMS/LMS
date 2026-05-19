import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { FormInput } from '../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../components/forms/FormTextarea.jsx';
import { FormSwitch } from '../../../../components/forms/FormSwitch.jsx';
import { SelectField } from '../../../../components/admin/SelectField.jsx';
import { LESSON_TYPES } from '../../../../features/courses/courseConstants.js';
import {
  emptyLessonForm,
  lessonFormToBody,
  lessonToForm,
  validateLessonForm,
} from '../../../../features/courses/courseStructureValidation.js';

export function CourseLessonFormModal({
  open,
  mode,
  initialLesson,
  saving,
  onClose,
  onSubmit,
}) {
  const { t } = useTranslation('courses');
  const [form, setForm] = useState(emptyLessonForm());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' && initialLesson ? lessonToForm(initialLesson) : emptyLessonForm());
      setErrors({});
    }
  }, [open, mode, initialLesson]);

  if (!open) return null;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validateLessonForm(form, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit(lessonFormToBody(form));
  }

  return (
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 210, padding: '2rem', overflow: 'auto' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="section-card admin-form-modal"
        style={{ maxWidth: 480, margin: '0 auto', padding: '1rem' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="section-card__title" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          {mode === 'edit' ? t('structure.editLesson') : t('structure.addLesson')}
        </h2>
        <form noValidate onSubmit={handleSubmit} className="admin-settings-grid admin-form-modal">
          <FormInput
            id="lesson-modal-title"
            label={t('structure.lessonTitle')}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            error={errors.title}
          />
          <FormTextarea
            id="lesson-modal-desc"
            label={t('structure.lessonDescription')}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
          />
          <SelectField
            id="lesson-modal-type"
            label={t('structure.lessonType')}
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
          >
            {LESSON_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value}>{t(lt.labelKey)}</option>
            ))}
          </SelectField>
          <SelectField
            id="lesson-modal-status"
            label={t('structure.lessonStatus')}
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
          >
            <option value="draft">{t('status.draft')}</option>
            <option value="published">{t('status.published')}</option>
          </SelectField>
          {form.type === 'video' ? (
            <FormInput
              id="lesson-modal-video"
              label={t('structure.videoUrl')}
              value={form.video_url}
              onChange={(e) => setField('video_url', e.target.value)}
              error={errors.video_url}
            />
          ) : null}
          {form.type === 'text' ? (
            <FormTextarea
              id="lesson-modal-content"
              label={t('structure.content')}
              value={form.content}
              onChange={(e) => setField('content', e.target.value)}
              rows={4}
              error={errors.content}
            />
          ) : null}
          {form.type === 'link' || form.type === 'file' ? (
            <FormInput
              id="lesson-modal-res"
              label={t('structure.resourceUrl')}
              value={form.resource_url}
              onChange={(e) => setField('resource_url', e.target.value)}
              error={errors.resource_url}
            />
          ) : null}
          <FormInput
            id="lesson-modal-dur"
            label={t('structure.duration')}
            type="number"
            min={0}
            value={form.duration_minutes}
            onChange={(e) => setField('duration_minutes', e.target.value)}
            error={errors.duration_minutes}
          />
          <FormSwitch
            id="lesson-modal-preview"
            label={t('structure.isPreview')}
            checked={form.is_preview}
            onChange={(e) => setField('is_preview', e.target.checked)}
          />
          <FormSwitch
            id="lesson-modal-required"
            label={t('structure.isRequired')}
            checked={form.is_required}
            onChange={(e) => setField('is_required', e.target.checked)}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('structure.saving') : t('save')}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

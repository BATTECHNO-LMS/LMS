import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SelectField } from '../../../../components/admin/SelectField.jsx';
import { Button } from '../../../../components/common/Button.jsx';
import { FormInput } from '../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../components/forms/FormTextarea.jsx';
import {
  COURSE_LEVELS,
  EMPTY_COURSE_FORM,
  buildCourseBody,
  validateCourseMetadataForPublish,
} from '../../../../features/courses/index.js';
import { CourseCoverField } from './CourseCoverField.jsx';
import { CourseCohortsField } from './CourseCohortsField.jsx';

export function AdminCourseComposer({
  open,
  editingId,
  form,
  setForm,
  saving,
  onClose,
  onSaveDraft,
  onAddLessons,
  onPublish,
}) {
  const { t } = useTranslation('courses');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) setErrors({});
  }, [open, editingId]);

  if (!open) return null;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSaveDraft(e) {
    e.preventDefault();
    setErrors({});
    if (!form.title.trim()) {
      setErrors({ title: t('composer.validation.titleRequired') });
      return;
    }
    onSaveDraft(buildCourseBody(form));
  }

  function handlePublish(e) {
    e.preventDefault();
    const { errors: nextErrors, missing } = validateCourseMetadataForPublish(form, t);
    setErrors(nextErrors);
    if (missing.length) return;
    onPublish(buildCourseBody(form));
  }

  const isEdit = Boolean(editingId);

  return (
    <section id="admin-course-composer" className="admin-course-composer section-card">
      <header className="admin-course-composer__head">
        <h2 className="admin-course-composer__title">
          {isEdit ? t('composer.editCourse') : t('composer.addCourse')}
        </h2>
        <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label={t('composer.hide')}>
          <X size={18} />
        </button>
      </header>

      <form noValidate className="admin-course-composer__form admin-form-modal">
        <fieldset className="composer-section">
          <legend className="composer-section__title">{t('composer.sectionInfo')}</legend>
          <p className="composer-section__help">{t('composer.sectionInfoHelp')}</p>
          <div className="composer-section__grid composer-section__grid--4">
            <FormInput
              id="composer-title"
              label={t('form.title')}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              error={errors.title}
            />
            <FormInput
              id="composer-category"
              label={t('form.category')}
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            />
            <SelectField
              id="composer-level"
              label={t('form.level')}
              value={form.level}
              onChange={(e) => setField('level', e.target.value)}
            >
              {COURSE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{t(l.labelKey)}</option>
              ))}
            </SelectField>
            <FormInput
              id="composer-min"
              label={t('form.estimatedMinutes')}
              type="number"
              min={0}
              value={form.estimated_duration_minutes}
              onChange={(e) => setField('estimated_duration_minutes', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="composer-section">
          <legend className="composer-section__title">{t('composer.sectionDescription')}</legend>
          <p className="composer-section__help">{t('composer.sectionDescriptionHelp')}</p>
          <div className="composer-section__grid composer-section__grid--2">
            <FormTextarea
              id="composer-short"
              label={t('form.shortDescription')}
              value={form.short_description}
              onChange={(e) => setField('short_description', e.target.value)}
              rows={3}
            />
            <FormTextarea
              id="composer-desc"
              label={t('form.description')}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              error={errors.description}
            />
          </div>
        </fieldset>

        <div className="composer-section__row">
          <fieldset className="composer-section">
            <legend className="composer-section__title">{t('composer.sectionCover')}</legend>
            <p className="composer-section__help">{t('composer.sectionCoverHelp')}</p>
            <CourseCoverField value={form.cover_image_url} onChange={(v) => setField('cover_image_url', v)} />
          </fieldset>

          <fieldset className="composer-section">
            <legend className="composer-section__title">{t('composer.sectionPublishing')}</legend>
            <p className="composer-section__help">{t('composer.sectionPublishingHelp')}</p>
            <CourseCohortsField
              cohortIds={form.cohort_ids ?? []}
              allStudents={form.all_students !== false}
              onChange={({ cohortIds, allStudents }) => {
                setForm((f) => ({
                  ...f,
                  cohort_ids: cohortIds,
                  all_students: allStudents,
                }));
              }}
            />
          </fieldset>
        </div>

        <div className="admin-course-composer__actions">
          <Button type="button" variant="outline" onClick={onAddLessons} disabled={saving}>
            {t('composer.addLessons')}
          </Button>
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving}>
            {saving ? t('structure.saving') : t('composer.saveDraft')}
          </Button>
          <Button type="button" variant="primary" onClick={handlePublish} disabled={saving}>
            {saving
              ? t('structure.saving')
              : isEdit
                ? t('composer.saveChanges')
                : t('composer.publishCourse')}
          </Button>
        </div>
      </form>
    </section>
  );
}

export { EMPTY_COURSE_FORM };

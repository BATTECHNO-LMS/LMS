import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { FormInput } from '../../../../components/forms/FormInput.jsx';
import { validateSectionForm } from '../../../../features/courses/courseStructureValidation.js';

export function CourseSectionFormModal({ open, mode, initialTitle = '', saving, onClose, onSubmit }) {
  const { t } = useTranslation('courses');
  const [title, setTitle] = useState(initialTitle);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setErrors({});
    }
  }, [open, initialTitle]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = validateSectionForm({ title }, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit(title.trim());
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
        style={{ maxWidth: 400, margin: '0 auto', padding: '1rem' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="section-card__title" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          {mode === 'edit' ? t('structure.editSection') : t('structure.addSection')}
        </h2>
        <form noValidate onSubmit={handleSubmit} className="admin-settings-grid admin-form-modal">
          <FormInput
            id="sec-modal-title"
            label={t('structure.sectionTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
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

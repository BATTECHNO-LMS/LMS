import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminCourseLessonsPanel } from './AdminCourseLessonsPanel.jsx';

export function AdminCoursesLessonsPopup({ open, courseId, courseTitle, onClose, onLessonsChange }) {
  const { t } = useTranslation('courses');

  if (!open) return null;

  return (
    <div className="modal-backdrop admin-lessons-popup" role="presentation" onClick={onClose}>
      <div
        className="admin-lessons-popup__panel section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lessons-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-lessons-popup__head">
          <div>
            <h2 id="lessons-popup-title" className="admin-lessons-popup__title">
              {t('lessonsPanel.title')}
            </h2>
          </div>
          <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label={t('cancel')}>
            <X size={20} />
          </button>
        </header>
        <div className="admin-lessons-popup__body">
          <AdminCourseLessonsPanel
            courseId={courseId}
            onLessonsChange={onLessonsChange}
            onDone={() => {
              onLessonsChange?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

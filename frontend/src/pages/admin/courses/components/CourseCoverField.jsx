import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { FileUploader } from '../../../../components/forms/FileUploader.jsx';
import { resolveUploadUrl, storedValueFromFileRecord } from '../../../../utils/uploadUrl.js';

const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function CourseCoverField({ value, onChange, error }) {
  const { t } = useTranslation('courses');
  const [uploadError, setUploadError] = useState(null);

  const previewUrl = value ? resolveUploadUrl(value) : null;
  const displayError = error || uploadError;

  function handleUploaded(record) {
    setUploadError(null);
    onChange(storedValueFromFileRecord(record));
  }

  function clearCover(e) {
    e.stopPropagation();
    setUploadError(null);
    onChange('');
  }

  return (
    <div className="course-cover-field">
      <span className="form-field__label">{t('form.coverImage')}</span>

      {previewUrl ? (
        <div className="course-cover-field__preview-wrap">
          <img src={previewUrl} alt="" className="course-cover-field__preview" />
          <button
            type="button"
            className="course-cover-field__remove"
            onClick={clearCover}
            aria-label={t('form.coverRemove')}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}

      <FileUploader
        folder="logos"
        visibility="public"
        accept={COVER_ACCEPT}
        hint={previewUrl ? t('form.coverReplaceHint') : t('form.coverDropHint')}
        meta={t('form.coverDropMeta')}
        onUploaded={handleUploaded}
        onError={() => setUploadError(t('form.coverUploadError'))}
      />
      {displayError ? <p className="form-field__error">{displayError}</p> : null}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { FileDropzone } from '../../../../components/forms/FileDropzone.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { uploadCourseCoverImage } from '../../../../features/courses/courses.service.js';
import { resolveUploadUrl } from '../../../../utils/uploadUrl.js';

const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function CourseCoverField({ value, onChange, error }) {
  const { t } = useTranslation('courses');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const previewUrl = value ? resolveUploadUrl(value) : null;
  const displayError = error || uploadError;

  async function handleFile(file) {
    if (!file || uploading) return;
    setUploadError(null);
    setUploading(true);
    try {
      const data = await uploadCourseCoverImage(file);
      onChange(data?.url ?? '');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        t('form.coverUploadError');
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
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
            disabled={uploading}
            aria-label={t('form.coverRemove')}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}

      <FileDropzone
        accept={COVER_ACCEPT}
        disabled={uploading}
        hint={previewUrl ? t('form.coverReplaceHint') : t('form.coverDropHint')}
        meta={t('form.coverDropMeta')}
        onFile={handleFile}
      />

      {uploading ? (
        <div className="course-cover-field__uploading">
          <LoadingSpinner />
          <span>{t('form.coverUploading')}</span>
        </div>
      ) : null}

      {displayError ? <p className="form-field__error">{displayError}</p> : null}
    </div>
  );
}

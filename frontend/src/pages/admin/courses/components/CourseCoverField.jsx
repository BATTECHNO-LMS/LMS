import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { uploadCourseCoverImage } from '../../../../features/courses/courses.service.js';
import { getFileUrl } from '../../../../utils/uploadUrl.js';

const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const COVER_MAX_BYTES = 4 * 1024 * 1024;

export function CourseCoverField({ value, onChange, error }) {
  const { t } = useTranslation('courses');
  const inputRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);

  const previewUrl = value ? getFileUrl(value) : null;
  const displayError = error || uploadError;
  const showPreview = Boolean(previewUrl) && !previewFailed;

  async function handleFile(file) {
    if (!file || uploading) return;
    setUploadError(null);
    setPreviewFailed(false);

    if (!file.type?.startsWith('image/')) {
      setUploadError(t('form.coverUploadError'));
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      setUploadError(t('form.coverUploadError'));
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadCourseCoverImage(file, { onProgress: setProgress });
      const stored = result.cover_image_url || result.path || result.url || '';
      if (!stored) throw new Error('missing cover url');
      onChange(stored);
    } catch {
      setUploadError(t('form.coverUploadError'));
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function clearCover(e) {
    e.stopPropagation();
    setUploadError(null);
    setPreviewFailed(false);
    onChange('');
  }

  return (
    <div className="course-cover-field">
      <span className="form-field__label">{t('form.coverImage')}</span>

      {showPreview ? (
        <div className="course-cover-field__preview-wrap">
          <img
            src={previewUrl}
            alt=""
            className="course-cover-field__preview"
            onError={() => setPreviewFailed(true)}
          />
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

      <div
        className={`file-dropzone${uploading ? ' file-dropzone--disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-dropzone__input"
          accept={COVER_ACCEPT}
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Upload size={28} aria-hidden />
        <p>{showPreview ? t('form.coverReplaceHint') : t('form.coverDropHint')}</p>
        <span className="file-dropzone__meta">{t('form.coverDropMeta')}</span>
      </div>

      {uploading ? (
        <div className="course-cover-field__uploading file-uploader__progress">
          <LoadingSpinner />
          <span>{t('form.coverUploading')} {progress}%</span>
          <div className="file-uploader__bar" aria-hidden>
            <div className="file-uploader__bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {displayError ? <p className="form-field__error">{displayError}</p> : null}
    </div>
  );
}

import { useRef, useState } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { uploadFileToStorage, mapUploadError } from '../../features/uploads/uploadFileToStorage.js';
import { validateFileForUpload, formatMaxSize } from '../../features/uploads/uploadRules.js';

/**
 * Reusable file uploader with presigned R2 flow and progress.
 */
export function FileUploader({
  onUploaded,
  onError,
  folder = 'general',
  visibility = 'private',
  accept,
  maxBytes,
  disabled = false,
  hint,
  meta,
  currentFileName,
  relatedEntityType,
  relatedEntityId,
}) {
  const { t } = useTranslation('uploads');
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successName, setSuccessName] = useState(null);
  const [error, setError] = useState(null);

  const acceptList = accept
    ? accept.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  async function handleFile(file) {
    if (!file || disabled || uploading) return;
    setError(null);
    setSuccessName(null);

    const validation = validateFileForUpload(file, { accept: acceptList, maxBytes });
    if (!validation.valid) {
      const msg =
        validation.code === 'INVALID_TYPE'
          ? t('errors.invalidType')
          : t('errors.tooLarge', { max: formatMaxSize(validation.maxBytes || maxBytes || 0) });
      setError(msg);
      onError?.(validation.code);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const record = await uploadFileToStorage(file, {
        folder,
        visibility,
        accept: acceptList,
        maxBytes,
        relatedEntityType,
        relatedEntityId,
        onProgress: setProgress,
      });
      setSuccessName(record.originalName || file.name);
      onUploaded?.(record, file);
    } catch (err) {
      const code = err?.code || mapUploadError(err);
      const msgKey = {
        CORS: 'errors.cors',
        TOO_LARGE: 'errors.tooLarge',
        INVALID_TYPE: 'errors.invalidType',
        RATE_LIMIT: 'errors.rateLimit',
        STORAGE: 'errors.storage',
        CONFIRM_FAILED: 'errors.confirmFailed',
        EXPIRED_URL: 'errors.expiredUrl',
        UNAUTHORIZED: 'errors.unauthorized',
      }[code];
      const msg = msgKey ? t(msgKey) : t('errors.uploadFailed');
      setError(msg);
      onError?.(code, err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="file-uploader">
      <div
        className={`file-dropzone${dragOver ? ' file-dropzone--active' : ''}${disabled || uploading ? ' file-dropzone--disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
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
          accept={accept}
          disabled={disabled || uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Upload size={28} aria-hidden />
        <p>{hint ?? t('dropzoneHint')}</p>
        {meta ? <span className="file-dropzone__meta">{meta}</span> : null}
        {currentFileName ? (
          <span className="file-dropzone__current">{currentFileName}</span>
        ) : null}
      </div>

      {uploading ? (
        <div className="file-uploader__progress">
          <LoadingSpinner />
          <span>{t('uploading', { percent: progress })}</span>
          <div className="file-uploader__bar" aria-hidden>
            <div className="file-uploader__bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {successName && !uploading ? (
        <p className="file-uploader__success">
          <CheckCircle2 size={16} aria-hidden />
          {t('success', { name: successName })}
        </p>
      ) : null}

      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}

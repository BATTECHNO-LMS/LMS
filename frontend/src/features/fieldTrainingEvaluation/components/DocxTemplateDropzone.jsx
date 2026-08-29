import { useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';

function isDocxFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  return (
    name.endsWith('.docx') ||
    type.includes('officedocument.wordprocessingml.document')
  );
}

export function formatDocxFileSize(bytes, locale = 'ar') {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ar = String(locale || 'ar').startsWith('ar');
  if (n < 1024) return ar ? `${n} بايت` : `${n} B`;
  if (n < 1024 * 1024) {
    const kb = (n / 1024).toFixed(1);
    return ar ? `${kb} ك.ب` : `${kb} KB`;
  }
  const mb = (n / (1024 * 1024)).toFixed(1);
  return ar ? `${mb} م.ب` : `${mb} MB`;
}

/**
 * Styled DOCX picker that hides the native file input.
 */
export function DocxTemplateDropzone({
  file,
  onFile,
  disabled = false,
  uploading = false,
  progress = null,
  error = '',
}) {
  const { t, i18n } = useTranslation('fieldTrainingEvaluation');
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function accept(next) {
    if (!next || disabled || uploading) return;
    if (!isDocxFile(next)) {
      onFile(null, t('manage.invalidType'));
      return;
    }
    onFile(next, '');
  }

  return (
    <div className="ft-eval-dropzone-wrap">
      <div
        className={`file-dropzone ft-eval-dropzone${dragOver ? ' file-dropzone--active' : ''}${disabled || uploading ? ' file-dropzone--disabled' : ''}`}
        onClick={() => {
          if (!disabled && !uploading) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-dropzone__input"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={disabled || uploading}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Upload size={28} aria-hidden />
        <p>{t('manage.dropHint')}</p>
        <span className="file-dropzone__meta">{t('manage.dropHelper')}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ft-eval-dropzone__browse"
          disabled={disabled || uploading}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {t('manage.chooseFile')}
        </Button>
      </div>

      {file ? (
        <div className="ft-eval-file-chip">
          <FileText size={18} aria-hidden />
          <div className="ft-eval-file-chip__body">
            <strong dir="auto">{file.name}</strong>
            <span>{formatDocxFileSize(file.size, i18n.language)}</span>
          </div>
          <button
            type="button"
            className="ft-eval-file-chip__change"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {t('manage.changeFile')}
          </button>
          <button
            type="button"
            className="ft-eval-file-chip__remove"
            disabled={disabled || uploading}
            onClick={() => onFile(null, '')}
            aria-label={t('manage.removeFile')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}

      {uploading ? (
        <div className="file-uploader__progress" role="status">
          <span>{t('manage.uploading')}</span>
          <div className="file-uploader__bar" aria-hidden>
            <div
              className="file-uploader__bar-fill ft-eval-upload-fill"
              style={{
                '--upload-progress': `${Math.min(100, Math.max(8, Number(progress) || 15))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="ft-eval-dropzone__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

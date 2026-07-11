import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { uploadFileToStorage } from '../../../../features/uploads/uploadFileToStorage.js';

const INSTRUCTION_ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const INSTRUCTION_UPLOAD_ERROR_AR =
  'تعذر رفع ملف التعليمات. يرجى التأكد من نوع الملف وحجمه.';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{
 *   opportunityId?: string | null,
 *   taskId?: string | null,
 *   existing?: { name?: string | null, size?: number | null } | null,
 *   disabled?: boolean,
 *   onUploaded: (fileId: string, meta?: { name: string, size: number, mimeType: string }) => void,
 *   onRemove?: () => void,
 *   onDownloadExisting?: () => void,
 *   onUploadingChange?: (uploading: boolean) => void,
 * }} props
 */
export function TaskInstructionFileField({
  opportunityId,
  taskId,
  existing,
  disabled,
  onUploaded,
  onRemove,
  onDownloadExisting,
  onUploadingChange,
}) {
  const { t } = useTranslation('fieldTraining');
  const inputRef = useRef(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingSize, setPendingSize] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const showExisting = Boolean(existing?.name) && !pendingName;
  const showPending = Boolean(pendingName);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || disabled || uploading) return;
    setError('');
    setUploading(true);
    try {
      const relatedEntityId = taskId || opportunityId || undefined;
      const record = await uploadFileToStorage(file, {
        folder: 'training',
        visibility: 'private',
        accept: INSTRUCTION_ACCEPT,
        // purpose = task_instruction — stored via relatedEntityType (supported metadata)
        relatedEntityType: 'task_instruction',
        relatedEntityId,
      });
      setPendingName(file.name);
      setPendingSize(file.size);
      onUploaded(record.id, {
        name: file.name,
        size: file.size,
        mimeType: file.type || record.mimeType || '',
      });
    } catch {
      setError(t('tasks.instructionUploadError', { defaultValue: INSTRUCTION_UPLOAD_ERROR_AR }));
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    if (disabled || uploading) return;
    setPendingName('');
    setPendingSize(null);
    setError('');
    onRemove?.();
  }

  return (
    <div className="form-field ft-task-instruction-file">
      <span className="form-field__label">{t('tasks.instructionFile')}</span>
      <p className="ft-composer-section__field-help">{t('tasks.instructionFileHelp')}</p>

      {showExisting ? (
        <div className="ft-task-instruction-file__current">
          <FileText size={18} aria-hidden />
          <div className="ft-task-instruction-file__meta">
            <span className="ft-task-instruction-file__name">{existing.name}</span>
            {existing.size ? (
              <span className="ft-task-instruction-file__size">{formatBytes(existing.size)}</span>
            ) : null}
          </div>
          <div className="ft-task-instruction-file__actions">
            {onDownloadExisting ? (
              <Button type="button" variant="outline" className="btn--sm" onClick={onDownloadExisting} disabled={disabled || uploading}>
                {t('tasks.downloadInstruction')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="btn--sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
              {uploading ? t('tasks.uploadingInstruction') : t('tasks.changeInstructionFile')}
            </Button>
            <Button type="button" variant="outline" className="btn--sm" onClick={handleRemove} disabled={disabled || uploading}>
              <X size={14} aria-hidden /> {t('tasks.removeInstructionFile')}
            </Button>
          </div>
        </div>
      ) : showPending ? (
        <div className="ft-task-instruction-file__current">
          <FileText size={18} aria-hidden />
          <div className="ft-task-instruction-file__meta">
            <span className="ft-task-instruction-file__name">{pendingName}</span>
            {pendingSize ? (
              <span className="ft-task-instruction-file__size">{formatBytes(pendingSize)}</span>
            ) : null}
          </div>
          <div className="ft-task-instruction-file__actions">
            <Button type="button" variant="outline" className="btn--sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
              {uploading ? t('tasks.uploadingInstruction') : t('tasks.changeInstructionFile')}
            </Button>
            <Button type="button" variant="outline" className="btn--sm" onClick={handleRemove} disabled={disabled || uploading}>
              <X size={14} aria-hidden /> {t('tasks.removeInstructionFile')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="ft-task-instruction-file__empty">
          <p>{uploading ? t('tasks.uploadingInstruction') : t('tasks.noInstructionFile')}</p>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <Upload size={14} aria-hidden /> {uploading ? t('tasks.uploadingInstruction') : t('tasks.uploadInstruction')}
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={INSTRUCTION_ACCEPT.join(',')}
        onChange={handlePick}
        disabled={disabled || uploading}
        aria-label={t('tasks.instructionFile')}
      />

      {error ? <p className="form-field__error" role="alert">{error}</p> : null}
    </div>
  );
}

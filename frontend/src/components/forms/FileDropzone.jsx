import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * @param {{
 *   onFile: (file: File) => void,
 *   accept?: string,
 *   disabled?: boolean,
 *   hint?: string,
 *   meta?: string,
 *   currentFileName?: string | null,
 * }} props
 */
export function FileDropzone({
  onFile,
  accept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  disabled = false,
  hint,
  meta,
  currentFileName,
}) {
  const { t } = useTranslation('fieldTraining');
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(file) {
    if (!file || disabled) return;
    onFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    pickFile(file);
  }

  return (
    <div
      className={`file-dropzone${dragOver ? ' file-dropzone--active' : ''}${disabled ? ' file-dropzone--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
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
        disabled={disabled}
        onChange={(e) => pickFile(e.target.files?.[0])}
      />
      <Upload size={28} aria-hidden />
      <p>{hint ?? t('tasks.dropzoneHint')}</p>
      {meta ? <span className="file-dropzone__meta">{meta}</span> : null}
      {currentFileName ? (
        <span className="file-dropzone__current">{currentFileName}</span>
      ) : null}
    </div>
  );
}

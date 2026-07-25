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
 *   multiple?: boolean,
 * }} props
 */
export function FileDropzone({
  onFile,
  accept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  disabled = false,
  hint,
  meta,
  currentFileName,
  multiple = false,
}) {
  const { t } = useTranslation('fieldTraining');
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFiles(fileList) {
    if (!fileList?.length || disabled) return;
    if (multiple) {
      Array.from(fileList).forEach((file) => onFile(file));
      return;
    }
    onFile(fileList[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFiles(e.dataTransfer.files);
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
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          pickFiles(e.target.files);
          e.target.value = '';
        }}
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

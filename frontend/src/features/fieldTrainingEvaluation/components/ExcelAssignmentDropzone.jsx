import { useRef, useState } from 'react';
import { FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { formatDocxFileSize } from './DocxTemplateDropzone.jsx';

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

function isXlsxFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  return name.endsWith('.xlsx') || type.includes('spreadsheetml.sheet');
}

export function ExcelAssignmentDropzone({
  file,
  onFile,
  disabled = false,
  uploading = false,
  error = '',
}) {
  const { t, i18n } = useTranslation('fieldTrainingEvaluation');
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function accept(next) {
    if (!next || disabled || uploading) return;
    if (!isXlsxFile(next)) {
      onFile(null, t('assignment.invalidType'));
      return;
    }
    if (next.size > MAX_EXCEL_BYTES) {
      onFile(null, t('assignment.tooLarge'));
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
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={disabled || uploading}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Upload size={28} aria-hidden />
        <p>{t('assignment.dropHint')}</p>
        <Button type="button" variant="outline" className="ft-eval-dropzone__browse">
          {t('assignment.uploadExcel')}
        </Button>
      </div>
      {file ? (
        <div className="ft-eval-file-chip">
          <FileSpreadsheet size={18} aria-hidden />
          <div className="ft-eval-file-chip__body">
            <strong>{file.name}</strong>
            <span>{formatDocxFileSize(file.size, i18n.language)}</span>
          </div>
          <button type="button" className="ft-eval-file-chip__change" onClick={() => onFile(null, '')}>
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ) : null}
      {error ? <p className="ft-eval-dropzone__error">{error}</p> : null}
    </div>
  );
}

export { MAX_EXCEL_BYTES, isXlsxFile };

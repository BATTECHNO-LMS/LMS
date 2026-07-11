import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeLabel(mime) {
  if (!mime) return '';
  const map = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'image/gif': 'GIF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  };
  return map[mime] || mime.split('/').pop()?.toUpperCase() || mime;
}

/**
 * @param {{
 *   task: {
 *     has_instruction_file?: boolean,
 *     instruction_file_name?: string | null,
 *     instruction_file_size?: number | null,
 *     instruction_file_mime_type?: string | null,
 *   },
 *   onDownload: () => void,
 *   disabled?: boolean,
 * }} props
 */
export function StudentTaskInstructionSection({ task, onDownload, disabled }) {
  const { t } = useTranslation('fieldTraining');
  const sizeLabel = formatBytes(task?.instruction_file_size);
  const typeLabel = formatMimeLabel(task?.instruction_file_mime_type);
  const metaParts = [sizeLabel, typeLabel].filter(Boolean);

  return (
    <div className="ft-student-instruction">
      <h3 className="ft-student-instruction__title">{t('tasks.instructionFile')}</h3>
      {task?.has_instruction_file ? (
        <div className="ft-student-instruction__file">
          <span className="ft-student-instruction__icon" aria-hidden>
            <FileText size={20} />
          </span>
          <div className="ft-student-instruction__meta">
            <span className="ft-student-instruction__name">
              {task.instruction_file_name || t('tasks.instructionFile')}
            </span>
            {metaParts.length ? (
              <span className="ft-student-instruction__size">{metaParts.join(' · ')}</span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="primary"
            className="btn--sm"
            onClick={onDownload}
            disabled={disabled}
          >
            {disabled ? t('tasks.downloadingInstruction') : t('tasks.downloadInstruction')}
          </Button>
        </div>
      ) : (
        <p className="ft-student-instruction__empty">{t('tasks.noInstructionFileStudent')}</p>
      )}
    </div>
  );
}

import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{
 *   task: { has_instruction_file?: boolean, instruction_file_name?: string | null, instruction_file_size?: number | null },
 *   onDownload: () => void,
 *   disabled?: boolean,
 * }} props
 */
export function StudentTaskInstructionSection({ task, onDownload, disabled }) {
  const { t } = useTranslation('fieldTraining');

  return (
    <div className="ft-student-instruction">
      <h3 className="ft-student-instruction__title">{t('tasks.instructionFile')}</h3>
      {task?.has_instruction_file ? (
        <div className="ft-student-instruction__file">
          <FileText size={18} aria-hidden />
          <div className="ft-student-instruction__meta">
            <span className="ft-student-instruction__name">{task.instruction_file_name}</span>
            {task.instruction_file_size ? (
              <span className="ft-student-instruction__size">{formatBytes(task.instruction_file_size)}</span>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="btn--sm" onClick={onDownload} disabled={disabled}>
            {t('tasks.downloadInstruction')}
          </Button>
        </div>
      ) : (
        <p className="ft-student-instruction__empty">{t('tasks.noInstructionFileStudent')}</p>
      )}
    </div>
  );
}

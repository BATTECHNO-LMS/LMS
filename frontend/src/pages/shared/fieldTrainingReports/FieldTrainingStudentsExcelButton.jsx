import { FileSpreadsheet } from 'lucide-react';

export function FieldTrainingStudentsExcelButton({
  onClick,
  exporting = false,
  disabled = false,
  label,
  exportingLabel,
}) {
  return (
    <button
      type="button"
      className="btn btn--outline btn--sm ft-students-excel-btn"
      onClick={onClick}
      disabled={disabled || exporting}
      aria-busy={exporting || undefined}
    >
      <FileSpreadsheet size={16} aria-hidden />
      <span>{exporting ? exportingLabel : label}</span>
    </button>
  );
}

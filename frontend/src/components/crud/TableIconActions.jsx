import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function TableIconActions({ viewTo, editTo, onDelete, className }) {
  const { locale } = useLocale();
  const viewLabel = translateText('عرض', locale);
  const editLabel = translateText('تعديل', locale);
  const deleteLabel = translateText('حذف', locale);

  return (
    <div className={cn('table-actions', className)}>
      <Link className="btn btn--icon btn--ghost" to={viewTo} title={viewLabel} aria-label={viewLabel}>
        <Eye size={18} />
      </Link>
      <Link className="btn btn--icon btn--ghost" to={editTo} title={editLabel} aria-label={editLabel}>
        <Pencil size={18} />
      </Link>
      <button
        type="button"
        className="btn btn--icon btn--ghost"
        title={deleteLabel}
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

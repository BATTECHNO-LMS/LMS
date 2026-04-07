import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

export function TableIconActions({ viewTo, editTo, onDelete, className }) {
  return (
    <div className={cn('table-actions', className)}>
      <Link className="btn btn--icon btn--ghost" to={viewTo} title="عرض" aria-label="عرض">
        <Eye size={18} />
      </Link>
      <Link className="btn btn--icon btn--ghost" to={editTo} title="تعديل" aria-label="تعديل">
        <Pencil size={18} />
      </Link>
      <button type="button" className="btn btn--icon btn--ghost" title="حذف" aria-label="حذف" onClick={onDelete}>
        <Trash2 size={18} />
      </button>
    </div>
  );
}

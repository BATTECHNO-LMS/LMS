import { AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function ConfirmDeleteModal({
  open,
  title = 'تأكيد الحذف',
  message = 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'حذف',
  cancelLabel = 'إلغاء',
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__icon">
          <AlertTriangle size={22} aria-hidden />
        </div>
        <h2 id="confirm-delete-title" className="modal__title">
          {title}
        </h2>
        <p className="modal__message">{message}</p>
        <div className="modal__actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

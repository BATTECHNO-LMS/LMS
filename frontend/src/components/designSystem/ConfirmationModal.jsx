import { AlertTriangle } from 'lucide-react';
import { AppModal } from './AppModal.jsx';
import { Button } from '../common/Button.jsx';

/**
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   onConfirm?: () => void,
 *   title?: React.ReactNode,
 *   description?: React.ReactNode,
 *   message?: React.ReactNode,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   confirmVariant?: string,
 *   busy?: boolean,
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 * }} props
 */
export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد العملية',
  description,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  confirmVariant = 'danger',
  busy = false,
  size = 'sm',
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      variant={confirmVariant === 'danger' ? 'danger' : 'warning'}
      icon={<AlertTriangle size={20} aria-hidden />}
      dismissible={!busy}
      closeOnOverlay={!busy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            loading={busy}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message ? <p className="app-modal__note">{message}</p> : null}
    </AppModal>
  );
}

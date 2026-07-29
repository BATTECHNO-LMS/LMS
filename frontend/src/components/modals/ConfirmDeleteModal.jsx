import { AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { AppModal } from '../designSystem/index.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function ConfirmDeleteModal({
  open,
  title = 'تأكيد الحذف',
  message = 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'حذف',
  cancelLabel = 'إلغاء',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  busy = false,
}) {
  const { locale } = useLocale();

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={translateText(title, locale)}
      size="sm"
      variant="warning"
      icon={<AlertTriangle size={20} aria-hidden />}
      dismissible={!busy}
      closeOnOverlay={!busy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {translateText(cancelLabel, locale)}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            loading={busy}
            disabled={busy}
          >
            {translateText(confirmLabel, locale)}
          </Button>
        </>
      }
    >
      <p className="app-modal__note">{translateText(message, locale)}</p>
    </AppModal>
  );
}

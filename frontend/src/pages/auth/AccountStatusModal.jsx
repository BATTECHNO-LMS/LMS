import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, CheckCircle2, Clock3, TriangleAlert, X } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';

const ICON_BY_VARIANT = {
  success: CheckCircle2,
  pending: Clock3,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function AccountStatusModal({
  open,
  title,
  message,
  note = '',
  variant = 'pending',
  onClose,
  actions = [],
}) {
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const Icon = ICON_BY_VARIANT[variant] || AlertCircle;

  const enabledActions = useMemo(() => actions.filter((a) => a && !a.hidden), [actions]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal modal--confirm auth-status-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="auth-status-modal__close"
          aria-label="إغلاق"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <div className={`modal__icon auth-status-modal__icon auth-status-modal__icon--${variant}`}>
          <Icon size={22} aria-hidden />
        </div>
        <h2 className="modal__title">{title}</h2>
        <p className="modal__message">{message}</p>
        {note ? <p className="auth-status-modal__note">{note}</p> : null}
        <div className="modal__actions">
          {enabledActions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant={action.variant || 'outline'}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}


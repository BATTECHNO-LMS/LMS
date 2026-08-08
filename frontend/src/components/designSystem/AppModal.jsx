import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

const SIZE_CLASS = {
  sm: 'app-modal--sm',
  md: 'app-modal--md',
  lg: 'app-modal--lg',
  xl: 'app-modal--xl',
};

/**
 * Unified app modal with focus trap, Escape, and body scroll lock.
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   title?: React.ReactNode,
 *   description?: React.ReactNode,
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 *   variant?: string,
 *   children?: React.ReactNode,
 *   footer?: React.ReactNode,
 *   dismissible?: boolean,
 *   closeOnOverlay?: boolean,
 *   className?: string,
 *   bodyClassName?: string,
 *   icon?: React.ReactNode,
 * }} props
 */
export function AppModal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  variant,
  children,
  footer,
  dismissible = true,
  closeOnOverlay = true,
  className,
  bodyClassName,
  icon,
}) {
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    window.setTimeout(() => {
      if (dismissible && closeBtnRef.current) {
        closeBtnRef.current.focus();
      } else {
        const focusables = panelRef.current?.querySelectorAll(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        focusables?.[0]?.focus();
      }
    }, 0);

    function onKeyDown(e) {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        onClose?.();
        return;
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
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      className="app-modal-overlay"
      role="presentation"
      onMouseDown={() => {
        if (closeOnOverlay && dismissible) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={cn('app-modal', SIZE_CLASS[size] || SIZE_CLASS.md, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || description || icon || dismissible) && (
          <div className="app-modal__header">
            {icon ? (
              <span
                className={cn('app-modal__icon', variant && `app-modal__icon--${variant}`)}
                aria-hidden
              >
                {icon}
              </span>
            ) : null}
            <div className="app-modal__header-text">
              {title ? (
                <h2 id={titleId} className="app-modal__title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="app-modal__description">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                ref={closeBtnRef}
                type="button"
                className="app-modal__close"
                aria-label="إغلاق"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        )}
        {children != null ? (
          <div className={cn('app-modal__body', bodyClassName)}>{children}</div>
        ) : null}
        {footer ? <div className="app-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

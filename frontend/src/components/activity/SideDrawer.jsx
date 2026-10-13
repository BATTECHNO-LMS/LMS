import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

/**
 * Accessible side drawer (RTL: opens from the left edge, full-screen on phones).
 * Escape closes, focus is trapped and restored on close, body scroll is locked.
 */
export function SideDrawer({ open, onClose, title, subtitle, children, footer, className }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement;
    window.setTimeout(() => panelRef.current?.querySelector('[data-drawer-close]')?.focus(), 0);

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
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
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="side-drawer-overlay" role="presentation" onMouseDown={() => onClose?.()}>
      <aside
        ref={panelRef}
        className={cn('side-drawer', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="side-drawer__header">
          <div className="side-drawer__titles">
            <h2 id={titleId} className="side-drawer__title">
              {title}
            </h2>
            {subtitle ? <p className="side-drawer__subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="side-drawer__close" aria-label="إغلاق" data-drawer-close onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="side-drawer__body">{children}</div>
        {footer ? <footer className="side-drawer__footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Building2, ChevronDown } from 'lucide-react';
import { PORTAL_ENTRIES, PORTAL_SELECTION_PATH } from '../../constants/portalConfig.js';
import { cn } from '../../utils/helpers.js';

/**
 * Header login control: dropdown with university / institution portal entries.
 */
export function PortalLoginMenu({
  label = 'تسجيل الدخول',
  className,
  buttonClassName,
  align = 'end',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('portal-login-menu', className)} ref={rootRef}>
      <button
        type="button"
        className={cn('portal-login-menu__trigger', buttonClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <ChevronDown size={compact ? 14 : 16} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn('portal-login-menu__panel', align === 'start' && 'portal-login-menu__panel--start')}
        >
          <Link
            role="menuitem"
            to={PORTAL_ENTRIES.UNIVERSITY.loginPath}
            className="portal-login-menu__item"
            onClick={() => setOpen(false)}
          >
            <GraduationCap size={18} aria-hidden />
            <span>
              <strong>{PORTAL_ENTRIES.UNIVERSITY.titleAr}</strong>
              <small>التدريب الميداني</small>
            </span>
          </Link>
          <Link
            role="menuitem"
            to={PORTAL_ENTRIES.INSTITUTION.loginPath}
            className="portal-login-menu__item"
            onClick={() => setOpen(false)}
          >
            <Building2 size={18} aria-hidden />
            <span>
              <strong>{PORTAL_ENTRIES.INSTITUTION.titleAr}</strong>
              <small>الدورات التدريبية</small>
            </span>
          </Link>
          <Link
            role="menuitem"
            to={PORTAL_SELECTION_PATH}
            className="portal-login-menu__all"
            onClick={() => setOpen(false)}
          >
            عرض كل البوابات
          </Link>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/helpers.js';
import { Button } from '../common/Button.jsx';

export function UserDropdown({ userName, userEmail, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const label = userName || userEmail || 'مستخدم';

  return (
    <div className="user-dropdown" ref={rootRef}>
      <button
        type="button"
        className={cn('user-dropdown__trigger', open && 'user-dropdown__trigger--open')}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-dropdown__avatar" aria-hidden />
        <span className="user-dropdown__name">{label}</span>
        <span className="user-dropdown__caret" aria-hidden />
      </button>
      {open ? (
        <div className="user-dropdown__menu" role="menu">
          {userEmail ? (
            <div className="user-dropdown__email" role="presentation">
              {userEmail}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="user-dropdown__logout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
          >
            تسجيل الخروج
          </Button>
        </div>
      ) : null}
    </div>
  );
}

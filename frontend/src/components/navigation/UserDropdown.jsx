import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';
import { Button } from '../common/Button.jsx';

/**
 * @param {{ userName?: string, userEmail?: string, onLogout?: () => void, compact?: boolean }} props
 */
export function UserDropdown({ userName, userEmail, onLogout, compact = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { t } = useTranslation('common');

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const label = userName || userEmail || t('user.fallbackName');

  return (
    <div className={cn('user-dropdown', compact && 'user-dropdown--compact')} ref={rootRef}>
      <button
        type="button"
        className={cn('user-dropdown__trigger', open && 'user-dropdown__trigger--open')}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
      >
        <span className="user-dropdown__avatar" aria-hidden />
        {compact ? null : (
          <>
            <span className="user-dropdown__name">{label}</span>
            <span className="user-dropdown__caret" aria-hidden />
          </>
        )}
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
            {t('user.logout')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

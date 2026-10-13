import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { Button } from '../common/Button.jsx';
import { useAuth } from '../../features/auth/index.js';

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

/**
 * @param {{ userName?: string, userEmail?: string, onLogout?: () => void, compact?: boolean }} props
 */
export function UserDropdown({ userName, userEmail, onLogout, compact = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { t } = useTranslation('common');
  const { user } = useAuth();

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
  const roleKey = user?.role ? `roles.${user.role}` : null;
  const roleLabel = roleKey ? t(roleKey, '') : '';
  const photo = user?.avatarUrl || user?.photoUrl || user?.imageUrl || null;
  const initials = initialsFromName(label);

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
        <span className="user-dropdown__avatar" aria-hidden>
          {photo ? <img src={photo} alt="" /> : initials}
        </span>
        {compact ? null : (
          <>
            <span className="user-dropdown__copy">
              <span className="user-dropdown__name">{label}</span>
              {roleLabel ? <span className="user-dropdown__role">{roleLabel}</span> : null}
            </span>
            <ChevronDown className="user-dropdown__caret" size={14} strokeWidth={2} aria-hidden />
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
            {t('user.endSession')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

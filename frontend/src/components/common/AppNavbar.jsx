import { cn } from '../../utils/helpers.js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../features/theme/index.js';
import brandLogo from '../../assets/images/batman-logo.png';
import { Moon, Sun } from 'lucide-react';
import { NotificationBell } from '../navigation/NotificationBell.jsx';
import { UserDropdown } from '../navigation/UserDropdown.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import { TenantSwitcher } from './TenantSwitcher.jsx';
import { TenantReadonlyBadge } from './TenantReadonlyBadge.jsx';

export function AppNavbar({
  projectTitle,
  pageTitle,
  userName,
  userEmail,
  onLogout,
  notificationCount = 0,
  className,
}) {
  const { t } = useTranslation('common');
  const { isDark, toggleTheme } = useTheme();
  const title = projectTitle ?? t('brand');

  return (
    <header className={cn('app-header', className)}>
      <div className="app-header__start">
        <img src={brandLogo} alt={t('logo.alt')} className="app-header__logo-image" />
        <span className="app-header__logo">{title}</span>
        <span className="app-header__divider" aria-hidden />
        <span className="app-header__page-title">{pageTitle}</span>
      </div>
      <div className="app-header__end">
        <TenantSwitcher />
        <TenantReadonlyBadge />
        <button
          type="button"
          className="app-header__theme-btn"
          onClick={toggleTheme}
          aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          title={isDark ? t('theme.light') : t('theme.dark')}
        >
          {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
        </button>
        <LanguageSwitcher />
        <NotificationBell count={notificationCount} />
        <UserDropdown userName={userName} userEmail={userEmail} onLogout={onLogout} />
      </div>
    </header>
  );
}

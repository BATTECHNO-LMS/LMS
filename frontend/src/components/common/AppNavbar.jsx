import { cn } from '../../utils/helpers.js';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import brandLogo from '../../assets/images/batman-logo.png';
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
  className,
  showMobileMenuToggle = false,
  mobileSidebarOpen = false,
  onToggleMobileSidebar,
}) {
  const { t } = useTranslation('common');
  const title = projectTitle ?? t('brand');
  const compactHeader = useMediaQuery('(max-width: 640px)');

  return (
    <header className={cn('app-header', compactHeader && 'app-header--compact-tools', className)}>
      <div className="app-header__start">
        {showMobileMenuToggle ? (
          <button
            type="button"
            className="app-header__menu-toggle"
            onClick={onToggleMobileSidebar}
            aria-label={mobileSidebarOpen ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
            aria-expanded={mobileSidebarOpen}
            aria-controls="dashboard-sidebar-nav"
          >
            <Menu size={22} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <img src={brandLogo} alt={t('logo.alt')} className="app-header__logo-image" />
        <span className="app-header__logo">{title}</span>
        <span className="app-header__divider" aria-hidden />
        <span className="app-header__page-title">{pageTitle}</span>
      </div>
      <div className="app-header__end">
        <div className="app-header__end-group">
          <TenantSwitcher />
          <TenantReadonlyBadge />
        </div>
        <div className="app-header__end-group">
          <LanguageSwitcher compact={compactHeader} />
          <NotificationBell />
          <UserDropdown userName={userName} userEmail={userEmail} onLogout={onLogout} compact={compactHeader} />
        </div>
      </div>
    </header>
  );
}

import { cn } from '../../utils/helpers.js';
import { NotificationBell } from '../navigation/NotificationBell.jsx';
import { UserDropdown } from '../navigation/UserDropdown.jsx';

export function AppNavbar({
  projectTitle = 'BATTECHNO-LMS',
  pageTitle,
  userName,
  userEmail,
  onLogout,
  notificationCount = 0,
  className,
}) {
  return (
    <header className={cn('app-header', className)}>
      <div className="app-header__start">
        <span className="app-header__logo">{projectTitle}</span>
        <span className="app-header__divider" aria-hidden />
        <span className="app-header__page-title">{pageTitle}</span>
      </div>
      <div className="app-header__end">
        <NotificationBell count={notificationCount} />
        <UserDropdown userName={userName} userEmail={userEmail} onLogout={onLogout} />
      </div>
    </header>
  );
}

import { Outlet, useLocation } from 'react-router-dom';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../utils/helpers.js';
import { AppNavbar, AppFooter } from '../components/common/index.js';
import { AdminSidebar } from '../components/navigation/AdminSidebar.jsx';
import { useAuth } from '../features/auth/index.js';
import { getPageTitleForPath, getDashboardNavGroups } from '../constants/navigation.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

/**
 * Single dashboard shell for admin, instructor, student, and reviewer.
 * Same header, sidebar system, footer, and content area.
 */
export function BaseDashboardLayout({ brand }) {
  const { user, logout } = useAuth();
  const { t: tNav, i18n } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');
  const location = useLocation();
  const isMobileShell = useMediaQuery('(max-width: 1024px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resolvedBrand = brand ?? tCommon('brand');

  const groups = useMemo(() => getDashboardNavGroups(user, tNav), [user, tNav, i18n.language]);

  const pageTitle = useMemo(
    () => getPageTitleForPath(user?.role, location.pathname, user),
    [user, user?.role, location.pathname, i18n.language]
  );

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    if (!isMobileShell) setSidebarOpen(false);
  }, [isMobileShell]);

  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  useEffect(() => {
    if (!isMobileShell || !sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileShell, sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen || !isMobileShell) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, isMobileShell, closeSidebar]);

  const drawerOpen = isMobileShell && sidebarOpen;

  return (
    <div
      className={cn(
        'layout',
        'layout--dashboard',
        isMobileShell && sidebarOpen && 'layout--dashboard-sidebar-open'
      )}
    >
      <AdminSidebar
        brand={resolvedBrand}
        groups={groups}
        drawerOpen={drawerOpen}
        onNavigate={closeSidebar}
        onDrawerClose={closeSidebar}
      />
      <div className="layout-dashboard__main">
        {isMobileShell ? (
          <div
            className="layout-dashboard__backdrop"
            aria-hidden="true"
            onClick={closeSidebar}
          />
        ) : null}
        <AppNavbar
          pageTitle={pageTitle}
          userName={user?.name || user?.email}
          userEmail={user?.email}
          onLogout={logout}
          showMobileMenuToggle={isMobileShell}
          mobileSidebarOpen={sidebarOpen}
          onToggleMobileSidebar={toggleSidebar}
        />
        <main className="layout-dashboard__content">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

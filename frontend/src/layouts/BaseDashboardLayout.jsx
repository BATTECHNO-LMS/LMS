import { Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppNavbar, AppFooter } from '../components/common/index.js';
import { AdminSidebar } from '../components/navigation/AdminSidebar.jsx';
import { useAuth } from '../features/auth/index.js';
import { getPageTitleForPath, getDashboardNavGroups } from '../constants/navigation.js';

/**
 * Single dashboard shell for admin, instructor, student, and reviewer.
 * Same header, sidebar system, footer, and content area.
 */
export function BaseDashboardLayout({ brand }) {
  const { user, logout } = useAuth();
  const { t: tNav, i18n } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');
  const location = useLocation();

  const resolvedBrand = brand ?? tCommon('brand');

  const groups = useMemo(
    () => getDashboardNavGroups(user?.role, tNav),
    [user?.role, tNav, i18n.language]
  );

  const pageTitle = useMemo(
    () => getPageTitleForPath(user?.role, location.pathname),
    [user?.role, location.pathname, i18n.language]
  );

  return (
    <div className="layout layout--dashboard">
      <AdminSidebar brand={resolvedBrand} groups={groups} />
      <div className="layout-dashboard__main">
        <AppNavbar
          pageTitle={pageTitle}
          userName={user?.name || user?.email}
          userEmail={user?.email}
          onLogout={logout}
        />
        <main className="layout-dashboard__content">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import brandLogo from '../../assets/images/batman-logo.png';
import { SidebarSectionTitle } from './SidebarSectionTitle.jsx';

export function AdminSidebar({
  brand = 'BATTECHNO-LMS',
  groups = [],
  collapsed = false,
  className,
  drawerOpen = false,
  onNavigate,
  onDrawerClose,
}) {
  const { t } = useTranslation('common');
  return (
    <aside
      className={cn(
        'app-sidebar app-sidebar--admin',
        collapsed && 'app-sidebar--collapsed',
        drawerOpen && 'app-sidebar--drawer-open',
        className
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={t('sidebar.adminMenuAria')}
    >
      <div className="app-sidebar__brand">
        <img src={brandLogo} alt={t('logo.alt')} className="app-sidebar__logo-image" />
        <span className="app-sidebar__brand-text">{brand}</span>
        <button
          type="button"
          className="app-sidebar__drawer-close"
          onClick={() => onDrawerClose?.()}
          aria-label={t('sidebar.closeDrawer')}
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <nav id="dashboard-sidebar-nav" className="app-sidebar__nav app-sidebar__nav--grouped">
        {groups.map((group) => (
          <div key={group.id} className="sidebar-nav-group">
            <SidebarSectionTitle>{group.title}</SidebarSectionTitle>
            <ul className="sidebar-nav-group__list">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to} className="sidebar-nav-group__item">
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn('sidebar-nav__link', isActive && 'sidebar-nav__link--active')
                      }
                      end={item.to.endsWith('/dashboard')}
                      onClick={() => onNavigate?.()}
                    >
                      {Icon ? <Icon className="sidebar-nav__icon" size={18} strokeWidth={2} aria-hidden /> : null}
                      <span className="sidebar-nav__label">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

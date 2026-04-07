import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/helpers.js';
import { SidebarSectionTitle } from './SidebarSectionTitle.jsx';

export function AdminSidebar({ brand = 'BATTECHNO-LMS', groups = [], collapsed = false, className }) {
  return (
    <aside
      className={cn('app-sidebar app-sidebar--admin', collapsed && 'app-sidebar--collapsed', className)}
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="قائمة الإدارة"
    >
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo" aria-hidden />
        <span className="app-sidebar__brand-text">{brand}</span>
      </div>
      <nav className="app-sidebar__nav app-sidebar__nav--grouped">
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

import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { SidebarSectionTitle } from './SidebarSectionTitle.jsx';

function pathMatchesNavItem(pathname, to) {
  if (!to) return false;
  const base = String(to).split('?')[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

function SidebarNavGroup({ group, onNavigate }) {
  const { pathname } = useLocation();
  const panelId = useId();
  const hasActive = group.items.some((item) => pathMatchesNavItem(pathname, item.to));
  const collapsible = Boolean(group.collapsible);
  const [open, setOpen] = useState(() => Boolean(group.defaultOpen) || hasActive || !collapsible);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive, pathname]);

  const showItems = !collapsible || open;

  return (
    <div
      className={cn(
        'sidebar-nav-group',
        collapsible && 'sidebar-nav-group--collapsible',
        collapsible && open && 'sidebar-nav-group--open'
      )}
    >
      {collapsible ? (
        <button
          type="button"
          className="sidebar-nav-group__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sidebar-nav-group__toggle-label">{group.title}</span>
          <ChevronDown
            className={cn('sidebar-nav-group__chevron', open && 'sidebar-nav-group__chevron--open')}
            size={16}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
      ) : (
        <SidebarSectionTitle>{group.title}</SidebarSectionTitle>
      )}

      {showItems ? (
        <ul id={panelId} className="sidebar-nav-group__list" hidden={collapsible ? !open : undefined}>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={`${item.to}-${item.labelKey || item.label}`} className="sidebar-nav-group__item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn('sidebar-nav__link', isActive && 'sidebar-nav__link--active')
                  }
                  end={item.to.endsWith('/dashboard')}
                  onClick={() => onNavigate?.()}
                >
                  {Icon ? (
                    <Icon className="sidebar-nav__icon" size={18} strokeWidth={2} aria-hidden />
                  ) : null}
                  <span className="sidebar-nav__label">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

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
        <BrandLogo variant="sidebar" alt={t('logo.alt')} />
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
          <SidebarNavGroup key={group.id} group={group} onNavigate={onNavigate} />
        ))}
      </nav>
    </aside>
  );
}

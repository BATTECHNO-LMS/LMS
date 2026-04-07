import { cn } from '../../utils/helpers.js';

export function SidebarSectionTitle({ children, className }) {
  return <p className={cn('sidebar-nav__section-title', className)}>{children}</p>;
}

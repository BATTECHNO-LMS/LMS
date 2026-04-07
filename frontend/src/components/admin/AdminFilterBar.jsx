import { cn } from '../../utils/helpers.js';

export function AdminFilterBar({ children, className }) {
  return <div className={cn('admin-filter-bar', className)}>{children}</div>;
}

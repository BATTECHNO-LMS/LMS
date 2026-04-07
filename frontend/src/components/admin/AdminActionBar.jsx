import { cn } from '../../utils/helpers.js';

export function AdminActionBar({ children, className }) {
  return <div className={cn('admin-action-bar', className)}>{children}</div>;
}

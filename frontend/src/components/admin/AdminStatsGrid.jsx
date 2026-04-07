import { cn } from '../../utils/helpers.js';

export function AdminStatsGrid({ children, className }) {
  return <div className={cn('admin-stats-grid', className)}>{children}</div>;
}

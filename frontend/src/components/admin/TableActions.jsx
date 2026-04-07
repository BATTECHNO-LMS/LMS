import { cn } from '../../utils/helpers.js';

export function TableActions({ children, className }) {
  return <div className={cn('table-actions', className)}>{children}</div>;
}

import { cn } from '../../utils/helpers.js';

const VARIANTS = {
  default: 'status-badge--neutral',
  muted: 'status-badge--muted',
  success: 'status-badge--success',
  info: 'status-badge--info',
  warning: 'status-badge--warning',
  danger: 'status-badge--danger',
};

export function StatusBadge({ children, variant = 'default', className }) {
  return <span className={cn('status-badge', VARIANTS[variant] ?? VARIANTS.default, className)}>{children}</span>;
}

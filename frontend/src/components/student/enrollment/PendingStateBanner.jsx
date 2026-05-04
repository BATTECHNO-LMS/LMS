import { Clock } from 'lucide-react';
import { cn } from '../../../utils/helpers.js';

/**
 * @param {{ children: import('react').ReactNode, variant?: 'info' | 'warning', className?: string, style?: import('react').CSSProperties }} props
 */
export function PendingStateBanner({ children, variant = 'info', className, style }) {
  return (
    <div
      style={style}
      className={cn('student-pending-banner', variant === 'warning' && 'student-pending-banner--warning', className)}
      role="status"
    >
      <Clock size={18} aria-hidden />
      <div className="student-pending-banner__text">{children}</div>
    </div>
  );
}

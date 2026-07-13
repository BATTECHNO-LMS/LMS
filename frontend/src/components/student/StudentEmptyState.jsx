import { EmptyState } from '../common/EmptyState.jsx';
import { cn } from '../../utils/helpers.js';

/**
 * Centered empty state for student sections — Admin EmptyState styling.
 */
export function StudentEmptyState({ className, ...props }) {
  return <EmptyState className={cn('empty-state--compact', className)} {...props} />;
}

import { StatCard } from '../common/StatCard.jsx';
import { cn } from '../../utils/helpers.js';

/**
 * Student KPI tile — reuses Admin StatCard design.
 */
export function StudentMetricCard({ className, ...props }) {
  return <StatCard className={cn('student-metric-card', className)} {...props} />;
}

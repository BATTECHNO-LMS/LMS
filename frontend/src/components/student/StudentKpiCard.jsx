import { StudentMetricCard } from './StudentMetricCard.jsx';

/**
 * @deprecated Prefer StudentMetricCard (Admin StatCard). Kept for compatibility.
 */
export function StudentKpiCard({ label, value, icon, color: _color = 'primary' }) {
  return <StudentMetricCard label={label} value={value} icon={icon} />;
}

import { StatusBadge } from '../../admin/StatusBadge.jsx';

const VARIANT_BY_STATUS = {
  pending: 'warning',
  enrolled: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'danger',
  withdrawn: 'muted',
};

/**
 * @param {{ status: string, label: string }} props
 */
export function EnrollmentStatusBadge({ status, label }) {
  const variant = VARIANT_BY_STATUS[status] ?? 'info';
  return <StatusBadge variant={variant}>{label}</StatusBadge>;
}

import { ASSESSMENT_TYPE_OPTIONS } from '../../constants/permissions.js';
import { StatusBadge } from '../admin/StatusBadge.jsx';

const TYPE_VARIANT = {
  quiz: 'info',
  assignment: 'default',
  lab: 'default',
  practical_exam: 'warning',
  milestone: 'warning',
  capstone_project: 'success',
  presentation: 'info',
};

const labelByValue = Object.fromEntries(ASSESSMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function AssessmentTypeBadge({ type, className }) {
  const label = labelByValue[type] ?? type;
  const variant = TYPE_VARIANT[type] ?? 'default';
  return (
    <StatusBadge variant={variant} className={className}>
      {label}
    </StatusBadge>
  );
}

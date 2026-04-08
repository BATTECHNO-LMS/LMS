import { useTranslation } from 'react-i18next';
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

export function AssessmentTypeBadge({ type, className }) {
  const { t } = useTranslation('assessments');
  const label = t(`typeLabels.${type}`, { defaultValue: type });
  const variant = TYPE_VARIANT[type] ?? 'default';
  return (
    <StatusBadge variant={variant} className={className}>
      {label}
    </StatusBadge>
  );
}

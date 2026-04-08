import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../admin/StatusBadge.jsx';

const STATE_VARIANT = {
  open: 'success',
  submitted: 'info',
  late: 'danger',
  graded: 'success',
  draft: 'muted',
};

export function SubmissionStatusBadge({ state, className }) {
  const { t } = useTranslation('submissions');
  const variant = STATE_VARIANT[state] ?? 'default';
  const label = t(`states.${state}`, { defaultValue: state });
  return (
    <StatusBadge variant={variant} className={className}>
      {label}
    </StatusBadge>
  );
}

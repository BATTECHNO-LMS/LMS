import { StatusBadge } from '../admin/StatusBadge.jsx';

const MAP = {
  open: { variant: 'success', label: 'مفتوح' },
  submitted: { variant: 'info', label: 'تم التسليم' },
  late: { variant: 'danger', label: 'متأخر' },
  graded: { variant: 'success', label: 'تم التقييم' },
  draft: { variant: 'muted', label: 'مسودة' },
};

export function SubmissionStatusBadge({ state, className }) {
  const cfg = MAP[state] ?? { variant: 'default', label: state };
  return (
    <StatusBadge variant={cfg.variant} className={className}>
      {cfg.label}
    </StatusBadge>
  );
}

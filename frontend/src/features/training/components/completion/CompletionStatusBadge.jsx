import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';

const STATUS_MAP = {
  COMPLETED: { label: 'مكتمل', variant: 'success' },
  READY_TO_COMPLETE: { label: 'جاهز للإنهاء', variant: 'info' },
  FINAL_EVALUATION_SUBMITTED: { label: 'أُرسل التقييم النهائي', variant: 'info' },
  FINAL_EVALUATION_REQUIRED: { label: 'التقييم النهائي مطلوب', variant: 'warning' },
  POST_TEST_PENDING: { label: 'بانتظار الاختبار البعدي', variant: 'warning' },
  ACTIVE: { label: 'نشط', variant: 'muted' },
  NOT_COMPLETED: { label: 'لم يُكمل', variant: 'danger' },
  ELIGIBLE: { label: 'مؤهل للإنهاء', variant: 'success' },
  NOT_ELIGIBLE: { label: 'غير مؤهل بعد', variant: 'warning' },
};

/**
 * Maps a completion `lifecycleStatus` or eligibility `status` value to an Arabic StatusBadge.
 * @param {{ status: string, className?: string }} props
 */
export function CompletionStatusBadge({ status, className }) {
  const cfg = STATUS_MAP[status] || { label: status || '—', variant: 'default' };
  return (
    <StatusBadge variant={cfg.variant} className={className}>
      {cfg.label}
    </StatusBadge>
  );
}

/** Arabic labels for institutional training task submission statuses. */
export const TRAINING_TASK_STATUS_LABEL_AR = {
  SUBMITTED: 'مُسلَّمة',
  ACCEPTED: 'مقبولة',
  GRADED: 'مُصحَّحة',
  REVISION_REQUESTED: 'مطلوب تعديل',
  REOPENED: 'أُعيد فتحها',
  RETURNED: 'مُعادة',
  REJECTED: 'مرفوضة',
};

export function trainingTaskStatusLabel(status) {
  return TRAINING_TASK_STATUS_LABEL_AR[status] || status || '—';
}

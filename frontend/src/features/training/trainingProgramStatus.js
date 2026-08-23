/** Arabic labels for institutional training-course lifecycle statuses. */
export const TRAINING_PROGRAM_STATUS_LABEL_AR = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشورة',
  REGISTRATION_OPEN: 'التسجيل مفتوح',
  REGISTRATION_CLOSED: 'التسجيل مغلق',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
  ARCHIVED: 'مؤرشفة',
};

export function trainingProgramStatusLabel(status) {
  return TRAINING_PROGRAM_STATUS_LABEL_AR[status] || status || '—';
}

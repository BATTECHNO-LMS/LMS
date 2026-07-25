/**
 * Shared grading-mode helpers for field-training tasks.
 * gradingMode is independent from isFinalTask.
 */

export const GRADING_MODES = Object.freeze({
  AI: 'AI',
  MANUAL: 'MANUAL',
  NONE: 'NONE',
});

export function resolveTaskGradingMode(task) {
  const raw = String(task?.grading_mode || '').toUpperCase();
  if (raw === 'AI' || raw === 'MANUAL' || raw === 'NONE') return raw;
  if (task?.requires_ai_self_evaluation) return 'AI';
  return 'MANUAL';
}

export function gradingModeLabelKey(mode) {
  switch (String(mode || '').toUpperCase()) {
    case 'AI':
      return 'tasks.gradingModes.AI';
    case 'MANUAL':
      return 'tasks.gradingModes.MANUAL';
    case 'NONE':
      return 'tasks.gradingModes.NONE';
    default:
      return 'tasks.gradingModes.MANUAL';
  }
}

/** Broad accept for project delivery uploads (backend still validates). */
export const SUBMISSION_ACCEPT_ALL = '*/*';

export const SUBMISSION_UPLOAD_HINT =
  'يمكن رفع المستندات والصور والفيديو والصوت وملفات البرمجة والملفات المضغوطة.';

export const TRAINING_MODES = [
  { value: 'onsite', labelKey: 'modes.onsite' },
  { value: 'remote', labelKey: 'modes.remote' },
  { value: 'hybrid', labelKey: 'modes.hybrid' },
];

export const OPPORTUNITY_STATUSES = [
  { value: 'draft', labelKey: 'status.draft' },
  { value: 'published', labelKey: 'status.published' },
  { value: 'in_progress', labelKey: 'status.in_progress' },
  { value: 'archived', labelKey: 'status.archived' },
];

export const TRAINING_STATUSES = [
  'none',
  'pre_assessment_pending',
  'pre_assessment_completed',
  'ready_for_training',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
  'failed',
  'expelled',
];

export const APPLICATION_STATUSES = [
  { value: 'pending', labelKey: 'applicationStatus.pending' },
  { value: 'approved', labelKey: 'applicationStatus.approved' },
  { value: 'rejected', labelKey: 'applicationStatus.rejected' },
  { value: 'cancelled', labelKey: 'applicationStatus.cancelled' },
];

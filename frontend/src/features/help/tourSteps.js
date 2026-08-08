export const FIELD_TRAINING_STUDENT_GUIDE_KEY = 'field_training_student';
export const FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY = 'field_training_instructor';
export const FIELD_TRAINING_REVIEWER_GUIDE_KEY = 'field_training_reviewer';

export const FIELD_TRAINING_TOUR_STEPS = [
  {
    id: 'profile',
    tourId: 'student-profile',
    titleKey: 'tour.steps.profile.title',
    bodyKey: 'tour.steps.profile.body',
    actionLabelKey: 'tour.steps.profile.action',
    actionTo: '/student/dashboard',
  },
  {
    id: 'opportunities',
    tourId: 'training-opportunities',
    titleKey: 'tour.steps.opportunities.title',
    bodyKey: 'tour.steps.opportunities.body',
    actionLabelKey: 'tour.steps.opportunities.action',
    actionTo: '/student/field-training',
  },
  {
    id: 'application',
    tourId: 'application-pretest',
    titleKey: 'tour.steps.application.title',
    bodyKey: 'tour.steps.application.body',
    actionLabelKey: 'tour.steps.application.action',
    actionTo: '/student/field-training',
  },
  {
    id: 'sessions',
    tourId: 'sessions',
    titleKey: 'tour.steps.sessions.title',
    bodyKey: 'tour.steps.sessions.body',
    actionLabelKey: 'tour.steps.sessions.action',
    actionTo: '/student/field-training',
  },
  {
    id: 'tasks',
    tourId: 'tasks',
    titleKey: 'tour.steps.tasks.title',
    bodyKey: 'tour.steps.tasks.body',
    actionLabelKey: 'tour.steps.tasks.action',
    actionTo: '/student/field-training',
  },
  {
    id: 'submissions',
    tourId: 'task-submit',
    titleKey: 'tour.steps.submissions.title',
    bodyKey: 'tour.steps.submissions.body',
  },
  {
    id: 'progress',
    tourId: 'progress',
    titleKey: 'tour.steps.progress.title',
    bodyKey: 'tour.steps.progress.body',
    actionLabelKey: 'tour.steps.progress.action',
    actionTo: '/student/field-training',
  },
  {
    id: 'certificates',
    tourId: 'certificates',
    titleKey: 'tour.steps.certificates.title',
    bodyKey: 'tour.steps.certificates.body',
    actionLabelKey: 'tour.steps.certificates.action',
    actionTo: '/student/certificate',
  },
];

/** Map role → onboarding guide_key. */
export function guideKeyForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'instructor') return FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY;
  if (r === 'reviewer') return FIELD_TRAINING_REVIEWER_GUIDE_KEY;
  if (r === 'student') return FIELD_TRAINING_STUDENT_GUIDE_KEY;
  return null;
}

/**
 * Map API onboarding steps (tour_target) into host step shape.
 * @param {Array<{ id?: string, title_ar?: string, body_ar?: string, tour_target?: string, related_route?: string }>|null|undefined} apiSteps
 */
export function mapApiTourSteps(apiSteps) {
  if (!Array.isArray(apiSteps) || !apiSteps.length) return [];
  return apiSteps.map((s, index) => ({
    id: s.id || `api-step-${index}`,
    tourId: s.tour_target || null,
    title: s.title_ar || '',
    body: s.body_ar || '',
    actionTo: s.related_route || null,
    fromApi: true,
  }));
}

export function findTourTarget(tourId) {
  if (!tourId || typeof document === 'undefined') return null;
  return document.querySelector(`[data-tour-id="${tourId}"]`);
}

/**
 * Advance past steps whose tour target is missing in the DOM.
 * Returns the next index that either has no target or whose target exists.
 */
export function resolveVisibleStepIndex(steps, fromIndex) {
  if (!Array.isArray(steps) || !steps.length) return -1;
  let i = Math.max(0, fromIndex);
  while (i < steps.length) {
    const step = steps[i];
    if (!step?.tourId) return i;
    if (findTourTarget(step.tourId)) return i;
    i += 1;
  }
  return -1;
}

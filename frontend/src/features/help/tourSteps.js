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

export function findTourTarget(tourId) {
  if (!tourId || typeof document === 'undefined') return null;
  return document.querySelector(`[data-tour-id="${tourId}"]`);
}

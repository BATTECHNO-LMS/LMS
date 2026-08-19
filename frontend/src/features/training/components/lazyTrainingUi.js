import { lazy } from 'react';

function lazyNamed(loader, name) {
  return lazy(() => loader().then((mod) => ({ default: mod[name] })));
}

export const CourseMaterialsManager = lazyNamed(
  () => import('./CourseMaterialsManager.jsx'),
  'CourseMaterialsManager'
);
export const RecordedLecturesManager = lazyNamed(
  () => import('./RecordedLecturesManager.jsx'),
  'RecordedLecturesManager'
);
export const CourseTasksManager = lazyNamed(
  () => import('./CourseTasksManager.jsx'),
  'CourseTasksManager'
);
export const TrainingAssessmentEditor = lazyNamed(
  () => import('./TrainingAssessmentEditor.jsx'),
  'TrainingAssessmentEditor'
);
export const TrainingAssessmentAttemptPanel = lazyNamed(
  () => import('./TrainingAssessmentAttemptPanel.jsx'),
  'TrainingAssessmentAttemptPanel'
);
export const EvaluationWizard = lazyNamed(
  () => import('./evaluation/EvaluationWizard.jsx'),
  'EvaluationWizard'
);
export const EvaluationAnalyticsPanel = lazyNamed(
  () => import('./evaluation/EvaluationAnalyticsPanel.jsx'),
  'EvaluationAnalyticsPanel'
);
export const CourseReportDashboard = lazyNamed(
  () => import('./reports/CourseReportDashboard.jsx'),
  'CourseReportDashboard'
);
export const IndividualReportView = lazyNamed(
  () => import('./reports/IndividualReportView.jsx'),
  'IndividualReportView'
);
export const TrainingFinalizationModal = lazyNamed(
  () => import('./completion/TrainingFinalizationModal.jsx'),
  'TrainingFinalizationModal'
);

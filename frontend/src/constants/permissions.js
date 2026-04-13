/**
 * UI-only permission keys (design / visibility). Not backend authorization.
 * Used for sidebar, routes, buttons, tables, and empty states.
 */

/** @typedef {keyof typeof UI_PERMISSION} UiPermissionKey */

export const UI_PERMISSION = {
  canViewDashboard: 'canViewDashboard',
  canViewEnrolledPrograms: 'canViewEnrolledPrograms',
  canViewContent: 'canViewContent',
  canViewSessions: 'canViewSessions',
  canViewAttendance: 'canViewAttendance',
  canViewAssessments: 'canViewAssessments',
  canSubmitAssessments: 'canSubmitAssessments',
  canEditOwnSubmission: 'canEditOwnSubmission',
  canViewFeedback: 'canViewFeedback',
  canViewSubmissionStatus: 'canViewSubmissionStatus',
  canViewGrades: 'canViewGrades',
  canViewCertificates: 'canViewCertificates',

  canManageCohorts: 'canManageCohorts',
  canManageSessions: 'canManageSessions',
  canManageAttendance: 'canManageAttendance',
  canCreateAssessments: 'canCreateAssessments',
  canEditAssessments: 'canEditAssessments',
  canManageRubric: 'canManageRubric',
  canGradeAssessments: 'canGradeAssessments',
  canPublishFeedback: 'canPublishFeedback',
  canViewSubmissionsTeaching: 'canViewSubmissionsTeaching',
  canViewGradesTeaching: 'canViewGradesTeaching',
  canUploadEvidence: 'canUploadEvidence',
  canManageRiskStudents: 'canManageRiskStudents',

  canViewRecognitionRequests: 'canViewRecognitionRequests',
  canViewUniversityReports: 'canViewUniversityReports',
  canViewReviewerEvidence: 'canViewReviewerEvidence',
  canViewLinkedCertificates: 'canViewLinkedCertificates',

  canViewNotifications: 'canViewNotifications',
};

/**
 * Assessment type values (English labels shown in forms per product spec).
 */
export const ASSESSMENT_TYPE_VALUES = {
  QUIZ: 'quiz',
  ASSIGNMENT: 'assignment',
  LAB: 'lab',
  PRACTICAL_EXAM: 'practical_exam',
  MILESTONE: 'milestone',
  CAPSTONE_PROJECT: 'capstone_project',
  PRESENTATION: 'presentation',
};

/** Options for selects: value + exact English label */
export const ASSESSMENT_TYPE_OPTIONS = [
  { value: ASSESSMENT_TYPE_VALUES.QUIZ, label: 'Quiz' },
  { value: ASSESSMENT_TYPE_VALUES.ASSIGNMENT, label: 'Assignment' },
  { value: ASSESSMENT_TYPE_VALUES.LAB, label: 'Lab' },
  { value: ASSESSMENT_TYPE_VALUES.PRACTICAL_EXAM, label: 'Practical Exam' },
  { value: ASSESSMENT_TYPE_VALUES.MILESTONE, label: 'Milestone' },
  { value: ASSESSMENT_TYPE_VALUES.CAPSTONE_PROJECT, label: 'Capstone Project' },
  { value: ASSESSMENT_TYPE_VALUES.PRESENTATION, label: 'Presentation' },
];

export const SUBMISSION_TYPE_OPTIONS = [
  { value: 'file_upload', labelAr: 'رفع ملف' },
  { value: 'repo_link', labelAr: 'رابط مستودع' },
  { value: 'text_response', labelAr: 'إجابة نصية' },
];

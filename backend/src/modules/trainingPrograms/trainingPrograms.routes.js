'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const c = require('./trainingPrograms.controller');
const v = require('./trainingPrograms.validation');

const trainerCtrl = require('./trainerAssignments.controller');
const tv = require('./trainerAssignments.validation');
const { requireTrainer } = require('./trainerScope');

const router = express.Router();
const anyRole = authorizeRoles(
  'super_admin',
  'admin',
  'instructor',
  'trainer',
  'trainee',
  'student',
  'reviewer'
);
const manage = authorizeRoles('super_admin', 'admin', 'instructor', 'trainer');
const orgAdmin = authorizeRoles('super_admin', 'admin');
const courseAdmin = authorizeRoles('super_admin', 'admin', 'reviewer');
const learner = authorizeRoles('super_admin', 'admin', 'trainee', 'student');

router.get('/student/my-programs', authenticate, learner, c.listStudentPrograms);
router.get('/trainee/my-programs', authenticate, learner, c.listStudentPrograms);
router.get(
  '/trainee/programs/:programId',
  authenticate,
  learner,
  validateRequest({ params: v.programIdParam }),
  c.getTraineeProgramDetail
);

/** Institution trainer portal APIs (assignment-scoped). */
router.get('/trainer/dashboard', authenticate, requireTrainer(), trainerCtrl.dashboard);
router.get('/trainer/courses', authenticate, requireTrainer(), trainerCtrl.listMyCourses);
router.get(
  '/trainer/courses/:programId',
  authenticate,
  requireTrainer(),
  validateRequest({ params: tv.programIdParam }),
  trainerCtrl.getCourse
);
router.post(
  '/organizations/:organizationId/trainers',
  authenticate,
  orgAdmin,
  validateRequest({ params: tv.organizationIdParam, body: tv.createTrainerBody }),
  trainerCtrl.createTrainer
);
router.get(
  '/organizations/:organizationId/trainer-assignments',
  authenticate,
  orgAdmin,
  validateRequest({ params: tv.organizationIdParam }),
  trainerCtrl.listOrgAssignments
);
router.post(
  '/organizations/:organizationId/trainer-assignments',
  authenticate,
  orgAdmin,
  validateRequest({ params: tv.organizationIdParam, body: tv.assignTrainerBody }),
  trainerCtrl.assignToCourse
);
router.post(
  '/organizations/:organizationId/trainer-assignments/:assignmentId/revoke',
  authenticate,
  orgAdmin,
  validateRequest({ params: tv.assignmentIdParam }),
  trainerCtrl.revokeAssignment
);
router.get('/certificates/verify/:code', c.verifyCertificate);

router.get(
  '/courses',
  authenticate,
  courseAdmin,
  validateRequest({ query: v.listCoursesQuery }),
  c.listTrainingCourses
);
router.get(
  '/organizations/:organizationId/programs',
  authenticate,
  anyRole,
  validateRequest({ params: v.orgIdParam }),
  c.listPrograms
);
router.post(
  '/organizations/:organizationId/programs',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.orgIdParam, body: v.createProgramBody }),
  c.createProgram
);
router.get(
  '/programs/:programId',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.getProgram
);
router.patch(
  '/programs/:programId',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam, body: v.updateProgramBody }),
  c.updateProgram
);
router.post(
  '/programs/:programId/publish',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.programIdParam }),
  c.publishProgram
);
router.get(
  '/programs/:programId/cohorts',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.listCohorts
);
router.post(
  '/programs/:programId/cohorts',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam, body: v.createCohortBody }),
  c.createCohort
);
router.get(
  '/cohorts/:cohortId/enrollments',
  authenticate,
  anyRole,
  validateRequest({ params: v.cohortIdParam }),
  c.listEnrollments
);
router.post(
  '/cohorts/:cohortId/enrollments',
  authenticate,
  manage,
  validateRequest({ params: v.cohortIdParam, body: v.enrollBody }),
  c.enrollUser
);
router.post(
  '/cohorts/:cohortId/enrollments/import/preview',
  authenticate,
  manage,
  validateRequest({ params: v.cohortIdParam, body: v.importBody }),
  c.importPreview
);
router.post(
  '/cohorts/:cohortId/enrollments/import/commit',
  authenticate,
  manage,
  validateRequest({ params: v.cohortIdParam, body: v.importBody }),
  c.importCommit
);
router.get(
  '/cohorts/:cohortId/sessions',
  authenticate,
  anyRole,
  validateRequest({ params: v.cohortIdParam }),
  c.listCohortSessions
);
router.post(
  '/cohorts/:cohortId/sessions',
  authenticate,
  manage,
  validateRequest({ params: v.cohortIdParam, body: v.sessionBody }),
  c.createSession
);
router.post(
  '/sessions/:sessionId/attendance-window',
  authenticate,
  manage,
  validateRequest({ params: v.sessionIdParam }),
  c.openAttendanceWindow
);
router.get(
  '/sessions/:sessionId/attendance',
  authenticate,
  manage,
  validateRequest({ params: v.sessionIdParam }),
  c.listSessionAttendance
);
router.post(
  '/sessions/:sessionId/attendance/confirm',
  authenticate,
  anyRole,
  validateRequest({ params: v.sessionIdParam }),
  c.confirmAttendance
);
router.post(
  '/sessions/:sessionId/attendance/mark-all-present',
  authenticate,
  manage,
  validateRequest({ params: v.sessionIdParam }),
  c.markAllPresent
);
router.get(
  '/programs/:programId/materials',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.listProgramMaterials
);
router.post(
  '/programs/:programId/materials',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam }),
  c.createProgramMaterial
);
router.get(
  '/programs/:programId/tasks',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.listProgramTasks
);
router.post(
  '/programs/:programId/tasks',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam }),
  c.createTask
);
router.get(
  '/programs/:programId/assessments',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.listProgramAssessments
);
router.get(
  '/programs/:programId/pre-post-comparison',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.getPrePostComparison
);
router.get(
  '/programs/:programId/assessment-status',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.getTraineeAssessmentStatus
);
router.post(
  '/tasks/:taskId/submissions',
  authenticate,
  anyRole,
  validateRequest({ params: v.taskIdParam }),
  c.submitTask
);
router.post(
  '/submissions/:submissionId/grade',
  authenticate,
  manage,
  validateRequest({ params: v.submissionIdParam }),
  c.gradeTask
);
router.put(
  '/programs/:programId/assessments/:kind',
  authenticate,
  manage,
  validateRequest({ params: v.assessmentKindParam }),
  c.upsertAssessment
);
router.get(
  '/assessments/:assessmentId',
  authenticate,
  anyRole,
  validateRequest({ params: v.assessmentIdParam }),
  c.getAssessment
);
router.post(
  '/assessments/:assessmentId/publish',
  authenticate,
  manage,
  validateRequest({ params: v.assessmentIdParam }),
  c.publishAssessment
);
router.get(
  '/assessments/:assessmentId/results',
  authenticate,
  manage,
  validateRequest({ params: v.assessmentIdParam }),
  c.listAssessmentResults
);
/** Start / resume attempt (preferred) */
router.post(
  '/assessments/:assessmentId/attempts/start',
  authenticate,
  anyRole,
  validateRequest({ params: v.assessmentIdParam }),
  c.startAssessmentAttempt
);
/** Legacy one-shot submit — still supported */
router.post(
  '/assessments/:assessmentId/attempts',
  authenticate,
  anyRole,
  validateRequest({ params: v.assessmentIdParam }),
  c.submitAssessment
);
router.patch(
  '/assessment-attempts/:attemptId/answers',
  authenticate,
  anyRole,
  validateRequest({ params: v.attemptIdParam }),
  c.saveAssessmentAttemptAnswers
);
router.post(
  '/assessment-attempts/:attemptId/submit',
  authenticate,
  anyRole,
  validateRequest({ params: v.attemptIdParam }),
  c.submitAssessmentAttempt
);
router.patch(
  '/assessment-attempts/:attemptId/grade',
  authenticate,
  manage,
  validateRequest({ params: v.attemptIdParam }),
  c.gradeAssessmentAttempt
);
router.get(
  '/enrollments/:enrollmentId/progress',
  authenticate,
  anyRole,
  validateRequest({ params: v.enrollmentIdParam }),
  c.getEnrollmentProgress
);
router.post(
  '/enrollments/:enrollmentId/progress/recompute',
  authenticate,
  manage,
  validateRequest({ params: v.enrollmentIdParam }),
  c.recomputeProgress
);
router.post(
  '/enrollments/:enrollmentId/complete',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.enrollmentIdParam }),
  c.approveCompletion
);
router.post(
  '/enrollments/:enrollmentId/certificate',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.enrollmentIdParam }),
  c.issueCertificate
);
router.get(
  '/enrollments/:enrollmentId/certificate',
  authenticate,
  anyRole,
  validateRequest({ params: v.enrollmentIdParam }),
  c.getEnrollmentCertificate
);

const reportRoles = authorizeRoles('super_admin', 'admin', 'trainer', 'reviewer');

/** Final evaluation (end-of-course survey). */
router.get(
  '/programs/:programId/evaluation',
  authenticate,
  anyRole,
  validateRequest({ params: v.programIdParam }),
  c.getProgramEvaluation
);
router.get(
  '/enrollments/:enrollmentId/evaluation',
  authenticate,
  anyRole,
  validateRequest({ params: v.enrollmentIdParam }),
  c.getEnrollmentEvaluation
);
router.patch(
  '/evaluation-responses/:responseId',
  authenticate,
  anyRole,
  validateRequest({ params: v.responseIdParam, body: v.evaluationAnswersBody }),
  c.saveEvaluationDraft
);
router.post(
  '/evaluation-responses/:responseId/submit',
  authenticate,
  anyRole,
  validateRequest({ params: v.responseIdParam, body: v.evaluationAnswersBody }),
  c.submitEvaluation
);
router.post(
  '/evaluation-assignments/:assignmentId/reopen',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.evaluationAssignmentIdParam, body: v.reopenEvaluationBody }),
  c.reopenEvaluation
);

/** Completion readiness, finalization, and reporting. */
router.get(
  '/programs/:programId/completion-readiness',
  authenticate,
  reportRoles,
  validateRequest({ params: v.programIdParam, query: v.cohortIdQuery }),
  c.getProgramCompletionReadiness
);
router.post(
  '/programs/:programId/finalize',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam, body: v.finalizeTrainingBody }),
  c.finalizeTraining
);
router.post(
  '/programs/:programId/reopen',
  authenticate,
  orgAdmin,
  validateRequest({ params: v.programIdParam, body: v.reopenTrainingBody }),
  c.reopenTraining
);
router.get(
  '/enrollments/:enrollmentId/individual-report',
  authenticate,
  anyRole,
  validateRequest({ params: v.enrollmentIdParam }),
  c.getIndividualReport
);
router.post(
  '/enrollments/:enrollmentId/individual-report/generate',
  authenticate,
  manage,
  validateRequest({ params: v.enrollmentIdParam }),
  c.generateIndividualReport
);
router.get(
  '/programs/:programId/course-report',
  authenticate,
  reportRoles,
  validateRequest({ params: v.programIdParam, query: v.cohortIdQuery }),
  c.getCourseReport
);
router.post(
  '/programs/:programId/course-report/generate',
  authenticate,
  manage,
  validateRequest({ params: v.programIdParam, query: v.cohortIdQuery }),
  c.generateCourseReport
);

module.exports = router;

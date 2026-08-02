const express = require('express');

const router = express.Router();

router.use('/users', require('../modules/users/users.routes'));
router.use('/admin/reviewers', require('../modules/users/adminReviewers.routes'));
router.use('/roles', require('../modules/roles/roles.routes'));
router.use('/universities', require('../modules/universities/universities.routes'));
router.use('/organizations', require('../modules/organizations/organizations.routes'));
router.use('/training', require('../modules/trainingPrograms/trainingPrograms.routes'));
router.use('/kpi', require('../modules/kpi/kpi.routes'));
router.use('/specialties', require('../modules/specialties/specialties.routes'));
router.use('/tracks', require('../modules/tracks/tracks.routes'));
router.use('/micro-credentials', require('../modules/micro-credentials/microCredentials.routes'));
router.use('/learning-outcomes', require('../modules/learning-outcomes/learningOutcomes.routes'));
router.use('/cohorts', require('../modules/cohorts/cohorts.routes'));
router.use('/student', require('../modules/student/student.routes'));
router.use('/enrollments', require('../modules/enrollments/enrollments.routes'));
router.use('/modules', require('../modules/modules/modules.routes'));
router.use('/sessions', require('../modules/sessions/sessions.routes'));
router.use('/attendance-records', require('../modules/attendance/attendance.routes'));
router.use('/assessments', require('../modules/assessments/assessments.routes'));
router.use('/rubrics', require('../modules/rubrics/rubrics.routes'));
router.use('/submissions', require('../modules/submissions/submissions.routes'));
router.use('/grades', require('../modules/grades/grades.routes'));
router.use('/students', require('../modules/students/students.routes'));
router.use('/rubric-criteria', require('../modules/rubrics/rubricCriteria.routes'));
router.use('/evidence', require('../modules/evidence/evidence.routes'));
router.use('/qa-reviews', require('../modules/qa-reviews/qaReviews.routes'));
router.use('/corrective-actions', require('../modules/corrective-actions/correctiveActions.routes'));
router.use('/risk-cases', require('../modules/risk-cases/riskCases.routes'));
router.use('/integrity-cases', require('../modules/integrity-cases/integrityCases.routes'));
router.use('/recognition-requests', require('../modules/recognition-requests/recognitionRequests.routes'));
router.use('/recognition-documents', require('../modules/recognition-documents/recognitionDocuments.routes'));
router.use('/certificates', require('../modules/certificates/certificates.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/analytics', require('../modules/analytics/analytics.routes'));
router.use('/reports', require('../modules/reports/reports.routes'));
router.use('/audit-logs', require('../modules/audit-logs/auditLogs.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/admin/courses', require('../modules/courses/adminCourses.routes'));
router.use('/student/courses', require('../modules/courses/studentCourses.routes'));
router.use('/admin/field-training', require('../modules/fieldTraining/adminFieldTraining.routes'));
router.use('/academic/field-training', require('../modules/fieldTraining/academicFieldTraining.routes'));
router.use('/instructor/field-training', require('../modules/fieldTraining/instructorFieldTraining.routes'));
router.use('/student/field-training', require('../modules/fieldTraining/studentFieldTraining.routes'));
router.use('/mobile/push', require('../modules/mobilePush/mobilePush.routes'));
router.use('/files', require('../modules/files/files.routes'));
router.use('/ai', require('../modules/ai/ai.routes'));
router.use('/public', require('../modules/public/public.routes'));

const { adminPopupsRouter, userPopupsRouter } = require('../modules/popups/popups.routes');
const {
  adminAnnouncementsRouter,
  userAnnouncementsRouter,
} = require('../modules/announcements/announcements.routes');
const {
  helpCatalogRouter,
  studentHelpRouter,
  adminHelpRouter,
  adminUserGuidesRouter,
  onboardingRouter,
} = require('../modules/help/help.routes');
router.use('/help', helpCatalogRouter);
router.use('/student', studentHelpRouter);
router.use('/admin/help', adminHelpRouter);
router.use('/admin/user-guides', adminUserGuidesRouter);
router.use('/onboarding', onboardingRouter);
router.use('/admin/popups', adminPopupsRouter);
router.use('/popups', userPopupsRouter);
router.use('/admin/announcements', adminAnnouncementsRouter);
router.use('/announcements', userAnnouncementsRouter);

const {
  adminNotificationRulesRouter,
  adminNotificationTemplatesRouter,
  adminNotificationsOpsRouter,
} = require('../modules/notificationEngine/notificationRules.routes');
router.use('/admin/notification-rules', adminNotificationRulesRouter);
router.use('/admin/notification-templates', adminNotificationTemplatesRouter);
router.use('/admin/notifications', adminNotificationsOpsRouter);

module.exports = router;

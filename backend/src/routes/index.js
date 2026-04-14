const express = require('express');

const router = express.Router();

router.use('/users', require('../modules/users/users.routes'));
router.use('/roles', require('../modules/roles/roles.routes'));
router.use('/universities', require('../modules/universities/universities.routes'));
router.use('/tracks', require('../modules/tracks/tracks.routes'));
router.use('/micro-credentials', require('../modules/micro-credentials/microCredentials.routes'));
router.use('/learning-outcomes', require('../modules/learning-outcomes/learningOutcomes.routes'));
router.use('/cohorts', require('../modules/cohorts/cohorts.routes'));
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

module.exports = router;

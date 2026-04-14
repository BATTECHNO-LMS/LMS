const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const analyticsController = require('./analytics.controller');
const { analyticsQuerySchema } = require('./analytics.validation');

const router = express.Router();
const superAdminOnly = authorizeRoles('super_admin');

router.get('/overview', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.overview);
router.get('/universities', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.universities);
router.get('/enrollments', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.enrollments);
router.get('/cohorts', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.cohorts);
router.get('/assessments', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.assessments);
router.get('/attendance', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.attendance);
router.get('/evidence', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.evidence);
router.get('/qa-integrity', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.qaIntegrity);
router.get('/recognition', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.recognition);
router.get('/certificates', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.certificates);

module.exports = router;

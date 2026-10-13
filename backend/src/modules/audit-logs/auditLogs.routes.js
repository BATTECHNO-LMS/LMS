const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const auditLogsController = require('./auditLogs.controller');
const {
  uuidParamSchema,
  studentIdParamSchema,
  userIdParamSchema,
  listAuditLogsQuerySchema,
  studentTimelineQuerySchema,
} = require('./auditLogs.validation');

const router = express.Router();
const auditRead = authorizeRoles(...env.AUDIT_LOG_READ_ROLE_CODES);

router.get(
  '/',
  authenticate,
  auditRead,
  validateRequest({ query: listAuditLogsQuerySchema }),
  auditLogsController.list
);

router.get('/catalog', authenticate, auditRead, auditLogsController.catalog);

router.get(
  '/students/:studentId/timeline',
  authenticate,
  auditRead,
  validateRequest({ params: studentIdParamSchema, query: studentTimelineQuerySchema }),
  auditLogsController.studentTimeline
);

router.get(
  '/users/:userId/sessions',
  authenticate,
  auditRead,
  validateRequest({ params: userIdParamSchema }),
  auditLogsController.userSessions
);

router.post(
  '/sessions/:id/revoke',
  authenticate,
  auditRead,
  validateRequest({ params: uuidParamSchema }),
  auditLogsController.revokeSession
);

router.get('/:id', authenticate, auditRead, validateRequest({ params: uuidParamSchema }), auditLogsController.getById);

module.exports = router;

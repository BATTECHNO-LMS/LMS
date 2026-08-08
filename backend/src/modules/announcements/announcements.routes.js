'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const ctrl = require('./announcements.controller');
const {
  uuidParamSchema,
  createAnnouncementBodySchema,
  updateAnnouncementBodySchema,
  scheduleBodySchema,
  listAnnouncementsQuerySchema,
  userActionBodySchema,
  optimisticLockBodySchema,
} = require('./announcements.validation');

const contentAdmins = authorizeRoles('super_admin', 'admin');

const adminAnnouncementsRouter = express.Router();

adminAnnouncementsRouter.get(
  '/',
  authenticate,
  contentAdmins,
  validateRequest({ query: listAnnouncementsQuerySchema }),
  ctrl.adminList
);

adminAnnouncementsRouter.post(
  '/',
  authenticate,
  contentAdmins,
  validateRequest({ body: createAnnouncementBodySchema }),
  ctrl.adminCreate
);

adminAnnouncementsRouter.patch(
  '/:id',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema, body: updateAnnouncementBodySchema }),
  ctrl.adminUpdate
);

adminAnnouncementsRouter.post(
  '/:id/publish',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema, body: optimisticLockBodySchema }),
  ctrl.adminPublish
);

adminAnnouncementsRouter.post(
  '/:id/schedule',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema, body: scheduleBodySchema }),
  ctrl.adminSchedule
);

adminAnnouncementsRouter.post(
  '/:id/pause',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema, body: optimisticLockBodySchema }),
  ctrl.adminPause
);

adminAnnouncementsRouter.post(
  '/:id/archive',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema, body: optimisticLockBodySchema }),
  ctrl.adminArchive
);

adminAnnouncementsRouter.post(
  '/:id/duplicate',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminDuplicate
);

adminAnnouncementsRouter.get(
  '/:id/analytics',
  authenticate,
  contentAdmins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminAnalytics
);

const userAnnouncementsRouter = express.Router();

userAnnouncementsRouter.get('/active', authenticate, ctrl.listActive);

userAnnouncementsRouter.post(
  '/:id/view',
  authenticate,
  validateRequest({ params: uuidParamSchema, body: userActionBodySchema }),
  ctrl.view
);

userAnnouncementsRouter.post(
  '/:id/dismiss',
  authenticate,
  validateRequest({ params: uuidParamSchema, body: userActionBodySchema }),
  ctrl.dismiss
);

userAnnouncementsRouter.post(
  '/:id/acknowledge',
  authenticate,
  validateRequest({ params: uuidParamSchema, body: userActionBodySchema }),
  ctrl.acknowledge
);

userAnnouncementsRouter.post(
  '/:id/click',
  authenticate,
  validateRequest({ params: uuidParamSchema, body: userActionBodySchema }),
  ctrl.click
);

module.exports = {
  adminAnnouncementsRouter,
  userAnnouncementsRouter,
};

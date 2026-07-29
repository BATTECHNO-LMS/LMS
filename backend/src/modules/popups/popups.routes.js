'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const ctrl = require('./popups.controller');
const {
  uuidParamSchema,
  createPopupBodySchema,
  updatePopupBodySchema,
  adminListQuerySchema,
  activePopupsQuerySchema,
} = require('./popups.validation');

const contentAdmin = authorizeRoles('super_admin', 'admin');

const adminPopupsRouter = express.Router();

adminPopupsRouter.get(
  '/',
  authenticate,
  contentAdmin,
  validateRequest({ query: adminListQuerySchema }),
  ctrl.adminList
);

adminPopupsRouter.post(
  '/',
  authenticate,
  contentAdmin,
  validateRequest({ body: createPopupBodySchema }),
  ctrl.adminCreate
);

adminPopupsRouter.patch(
  '/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: updatePopupBodySchema }),
  ctrl.adminUpdate
);

adminPopupsRouter.post(
  '/:id/publish',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminPublish
);

adminPopupsRouter.post(
  '/:id/pause',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminPause
);

adminPopupsRouter.post(
  '/:id/archive',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminArchive
);

const userPopupsRouter = express.Router();

userPopupsRouter.get(
  '/active',
  authenticate,
  validateRequest({ query: activePopupsQuerySchema }),
  ctrl.listActive
);

userPopupsRouter.post(
  '/:id/view',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  ctrl.viewPopup
);

userPopupsRouter.post(
  '/:id/dismiss',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  ctrl.dismissPopup
);

userPopupsRouter.post(
  '/:id/acknowledge',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  ctrl.acknowledgePopup
);

module.exports = {
  adminPopupsRouter,
  userPopupsRouter,
};

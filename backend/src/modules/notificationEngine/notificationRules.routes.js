'use strict';

/**
 * Mount instructions (see backend/src/routes/index.js):
 *
 *   const {
 *     adminNotificationRulesRouter,
 *     adminNotificationTemplatesRouter,
 *     adminNotificationsOpsRouter,
 *   } = require('../modules/notificationEngine/notificationRules.routes');
 *
 *   router.use('/admin/notification-rules', adminNotificationRulesRouter);
 *   router.use('/admin/notification-templates', adminNotificationTemplatesRouter);
 *   router.use('/admin/notifications', adminNotificationsOpsRouter);
 *
 * User-facing preference / acknowledge / archive / unread-count live on
 * `/notifications` via the existing notifications module (extended).
 */

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const ctrl = require('./notificationRules.controller');
const {
  uuidParamSchema,
  listRulesQuerySchema,
  createRuleBodySchema,
  updateRuleBodySchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  previewTemplateBodySchema,
  listDeliveriesQuerySchema,
  analyticsQuerySchema,
  manualSendBodySchema,
} = require('./notificationRules.validation');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');
const { z } = require('zod');

const admins = authorizeRoles('super_admin', 'admin');

const listTemplatesQuerySchema = z
  .object({
    rule_id: z.string().uuid().optional(),
    role_code: z.string().max(50).optional(),
    channel: z.string().max(40).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      rule_id: q.rule_id,
      role_code: q.role_code,
      channel: q.channel,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

/* ---- Rules CRUD ---- */
const adminNotificationRulesRouter = express.Router();

adminNotificationRulesRouter.get(
  '/catalog',
  authenticate,
  admins,
  ctrl.catalog
);

adminNotificationRulesRouter.get(
  '/',
  authenticate,
  admins,
  validateRequest({ query: listRulesQuerySchema }),
  ctrl.listRules
);

adminNotificationRulesRouter.post(
  '/',
  authenticate,
  admins,
  validateRequest({ body: createRuleBodySchema }),
  ctrl.createRule
);

adminNotificationRulesRouter.get(
  '/:id',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.getRule
);

adminNotificationRulesRouter.patch(
  '/:id',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema, body: updateRuleBodySchema }),
  ctrl.updateRule
);

adminNotificationRulesRouter.post(
  '/:id/activate',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.activateRule
);

adminNotificationRulesRouter.post(
  '/:id/pause',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.pauseRule
);

adminNotificationRulesRouter.post(
  '/:id/archive',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.archiveRule
);

/* ---- Templates CRUD + preview ---- */
const adminNotificationTemplatesRouter = express.Router();

adminNotificationTemplatesRouter.get(
  '/',
  authenticate,
  admins,
  validateRequest({ query: listTemplatesQuerySchema }),
  ctrl.listTemplates
);

adminNotificationTemplatesRouter.post(
  '/preview',
  authenticate,
  admins,
  validateRequest({ body: previewTemplateBodySchema }),
  ctrl.previewTemplate
);

adminNotificationTemplatesRouter.post(
  '/',
  authenticate,
  admins,
  validateRequest({ body: createTemplateBodySchema }),
  ctrl.createTemplate
);

adminNotificationTemplatesRouter.patch(
  '/:id',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema, body: updateTemplateBodySchema }),
  ctrl.updateTemplate
);

/* ---- Ops: deliveries, failures, retry, analytics, send ---- */
const adminNotificationsOpsRouter = express.Router();

adminNotificationsOpsRouter.get(
  '/deliveries',
  authenticate,
  admins,
  validateRequest({ query: listDeliveriesQuerySchema }),
  ctrl.listDeliveries
);

adminNotificationsOpsRouter.get(
  '/failures',
  authenticate,
  admins,
  validateRequest({ query: listDeliveriesQuerySchema }),
  ctrl.listFailures
);

adminNotificationsOpsRouter.post(
  '/deliveries/:id/retry',
  authenticate,
  admins,
  validateRequest({ params: uuidParamSchema }),
  ctrl.retryDelivery
);

adminNotificationsOpsRouter.get(
  '/analytics',
  authenticate,
  admins,
  validateRequest({ query: analyticsQuerySchema }),
  ctrl.analytics
);

adminNotificationsOpsRouter.post(
  '/send',
  authenticate,
  admins,
  validateRequest({ body: manualSendBodySchema }),
  ctrl.manualSend
);

adminNotificationsOpsRouter.post(
  '/send/preview',
  authenticate,
  admins,
  validateRequest({ body: manualSendBodySchema }),
  ctrl.previewSend
);

adminNotificationsOpsRouter.post(
  '/process-jobs',
  authenticate,
  admins,
  ctrl.processJobs
);

module.exports = {
  adminNotificationRulesRouter,
  adminNotificationTemplatesRouter,
  adminNotificationsOpsRouter,
};

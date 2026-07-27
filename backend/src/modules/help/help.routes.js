'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const ctrl = require('./help.controller');
const {
  onboardingProgressBodySchema,
  supportTicketBodySchema,
  helpSearchQuerySchema,
  contextualHelpQuerySchema,
  slugParamSchema,
  uuidParamSchema,
  adminCategoryBodySchema,
  adminArticleBodySchema,
  reorderBodySchema,
} = require('./help.validation');

const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);
const superAdminOnly = authorizeRoles('super_admin');

const helpCatalogRouter = express.Router();
helpCatalogRouter.get('/categories', authenticate, ctrl.listCategories);
helpCatalogRouter.get('/articles', authenticate, ctrl.listArticles);
helpCatalogRouter.get(
  '/articles/:slug',
  authenticate,
  validateRequest({ params: slugParamSchema }),
  ctrl.getArticle
);
helpCatalogRouter.post(
  '/articles/:id/view',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  ctrl.viewArticle
);
helpCatalogRouter.get(
  '/search',
  authenticate,
  validateRequest({ query: helpSearchQuerySchema }),
  ctrl.search
);

const studentHelpRouter = express.Router();
studentHelpRouter.get('/onboarding/field-training', authenticate, studentOnly, ctrl.getOnboarding);
studentHelpRouter.post(
  '/onboarding/field-training/start',
  authenticate,
  studentOnly,
  ctrl.startOnboarding
);
studentHelpRouter.patch(
  '/onboarding/field-training/progress',
  authenticate,
  studentOnly,
  validateRequest({ body: onboardingProgressBodySchema }),
  ctrl.progressOnboarding
);
studentHelpRouter.post(
  '/onboarding/field-training/complete',
  authenticate,
  studentOnly,
  ctrl.completeOnboarding
);
studentHelpRouter.post(
  '/onboarding/field-training/dismiss',
  authenticate,
  studentOnly,
  ctrl.dismissOnboarding
);
studentHelpRouter.post(
  '/onboarding/field-training/restart',
  authenticate,
  studentOnly,
  ctrl.restartOnboarding
);
studentHelpRouter.get(
  '/contextual-help',
  authenticate,
  studentOnly,
  validateRequest({ query: contextualHelpQuerySchema }),
  ctrl.contextualHelp
);
studentHelpRouter.post(
  '/support-tickets',
  authenticate,
  studentOnly,
  validateRequest({ body: supportTicketBodySchema }),
  ctrl.createTicket
);
studentHelpRouter.get('/support-tickets', authenticate, studentOnly, ctrl.listTickets);
studentHelpRouter.get(
  '/support-tickets/:id',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  ctrl.getTicket
);

const adminHelpRouter = express.Router();
adminHelpRouter.get('/categories', authenticate, superAdminOnly, ctrl.adminListCategories);
adminHelpRouter.post(
  '/categories',
  authenticate,
  superAdminOnly,
  validateRequest({ body: adminCategoryBodySchema }),
  ctrl.adminCreateCategory
);
adminHelpRouter.patch(
  '/categories/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema, body: adminCategoryBodySchema.partial() }),
  ctrl.adminUpdateCategory
);
adminHelpRouter.delete(
  '/categories/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminDeleteCategory
);
adminHelpRouter.get('/articles', authenticate, superAdminOnly, ctrl.adminListArticles);
adminHelpRouter.post(
  '/articles',
  authenticate,
  superAdminOnly,
  validateRequest({ body: adminArticleBodySchema }),
  ctrl.adminCreateArticle
);
adminHelpRouter.patch(
  '/articles/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema, body: adminArticleBodySchema.partial() }),
  ctrl.adminUpdateArticle
);
adminHelpRouter.post(
  '/articles/:id/publish',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminPublishArticle
);
adminHelpRouter.delete(
  '/articles/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminDeleteArticle
);
adminHelpRouter.post(
  '/articles/reorder',
  authenticate,
  superAdminOnly,
  validateRequest({ body: reorderBodySchema }),
  ctrl.adminReorderArticles
);
adminHelpRouter.get('/analytics', authenticate, superAdminOnly, ctrl.adminAnalytics);

module.exports = {
  helpCatalogRouter,
  studentHelpRouter,
  adminHelpRouter,
};

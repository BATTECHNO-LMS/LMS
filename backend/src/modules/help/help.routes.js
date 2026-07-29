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
  guideKeyParamSchema,
  versionParamSchema,
  stepIdParamSchema,
  adminCategoryBodySchema,
  adminArticleBodySchema,
  reorderBodySchema,
  adminGuideBodySchema,
  adminGuidePublishBodySchema,
  adminGuideStepBodySchema,
} = require('./help.validation');

const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);
const contentAdmin = authorizeRoles('super_admin', 'admin');

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
helpCatalogRouter.get(
  '/contextual-help',
  authenticate,
  validateRequest({ query: contextualHelpQuerySchema }),
  ctrl.contextualHelp
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
adminHelpRouter.get('/categories', authenticate, contentAdmin, ctrl.adminListCategories);
adminHelpRouter.post(
  '/categories',
  authenticate,
  contentAdmin,
  validateRequest({ body: adminCategoryBodySchema }),
  ctrl.adminCreateCategory
);
adminHelpRouter.patch(
  '/categories/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: adminCategoryBodySchema.partial() }),
  ctrl.adminUpdateCategory
);
adminHelpRouter.delete(
  '/categories/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminDeleteCategory
);
adminHelpRouter.get('/articles', authenticate, contentAdmin, ctrl.adminListArticles);
adminHelpRouter.post(
  '/articles',
  authenticate,
  contentAdmin,
  validateRequest({ body: adminArticleBodySchema }),
  ctrl.adminCreateArticle
);
adminHelpRouter.patch(
  '/articles/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: adminArticleBodySchema.partial() }),
  ctrl.adminUpdateArticle
);
adminHelpRouter.post(
  '/articles/:id/publish',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminPublishArticle
);
adminHelpRouter.post(
  '/articles/:id/archive',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminArchiveArticle
);
adminHelpRouter.delete(
  '/articles/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminDeleteArticle
);
adminHelpRouter.get(
  '/articles/:id/versions',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminListVersions
);
adminHelpRouter.post(
  '/articles/:id/versions/:version/restore',
  authenticate,
  contentAdmin,
  validateRequest({ params: versionParamSchema }),
  ctrl.adminRestoreVersion
);
adminHelpRouter.post(
  '/articles/reorder',
  authenticate,
  contentAdmin,
  validateRequest({ body: reorderBodySchema }),
  ctrl.adminReorderArticles
);
adminHelpRouter.get('/analytics', authenticate, contentAdmin, ctrl.adminAnalytics);

const adminUserGuidesRouter = express.Router();
adminUserGuidesRouter.get('/', authenticate, contentAdmin, ctrl.adminListGuides);
adminUserGuidesRouter.post(
  '/',
  authenticate,
  contentAdmin,
  validateRequest({ body: adminGuideBodySchema }),
  ctrl.adminCreateGuide
);
adminUserGuidesRouter.get(
  '/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminGetGuide
);
adminUserGuidesRouter.patch(
  '/:id',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: adminGuideBodySchema.partial() }),
  ctrl.adminUpdateGuide
);
adminUserGuidesRouter.post(
  '/:id/publish',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: adminGuidePublishBodySchema.partial() }),
  ctrl.adminPublishGuide
);
adminUserGuidesRouter.post(
  '/:id/preview',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminPreviewGuide
);
adminUserGuidesRouter.post(
  '/:id/reorder',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: reorderBodySchema }),
  ctrl.adminReorderSteps
);
adminUserGuidesRouter.post(
  '/:id/archive',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema }),
  ctrl.adminArchiveGuide
);
adminUserGuidesRouter.post(
  '/:id/steps',
  authenticate,
  contentAdmin,
  validateRequest({ params: uuidParamSchema, body: adminGuideStepBodySchema }),
  ctrl.adminCreateGuideStep
);
adminUserGuidesRouter.patch(
  '/:id/steps/:stepId',
  authenticate,
  contentAdmin,
  validateRequest({ params: stepIdParamSchema, body: adminGuideStepBodySchema.partial() }),
  ctrl.adminUpdateGuideStep
);
adminUserGuidesRouter.delete(
  '/:id/steps/:stepId',
  authenticate,
  contentAdmin,
  validateRequest({ params: stepIdParamSchema }),
  ctrl.adminDeleteGuideStep
);

const onboardingRouter = express.Router();
onboardingRouter.get('/active', authenticate, ctrl.getActiveOnboarding);
onboardingRouter.get(
  '/:guideKey',
  authenticate,
  validateRequest({ params: guideKeyParamSchema }),
  ctrl.getOnboardingByKey
);
onboardingRouter.patch(
  '/:guideKey/progress',
  authenticate,
  validateRequest({ params: guideKeyParamSchema, body: onboardingProgressBodySchema }),
  ctrl.progressOnboardingByKey
);
onboardingRouter.post(
  '/:guideKey/complete',
  authenticate,
  validateRequest({ params: guideKeyParamSchema }),
  ctrl.completeOnboardingByKey
);
onboardingRouter.post(
  '/:guideKey/dismiss',
  authenticate,
  validateRequest({ params: guideKeyParamSchema }),
  ctrl.dismissOnboardingByKey
);
onboardingRouter.post(
  '/:guideKey/restart',
  authenticate,
  validateRequest({ params: guideKeyParamSchema }),
  ctrl.restartOnboardingByKey
);

module.exports = {
  helpCatalogRouter,
  studentHelpRouter,
  adminHelpRouter,
  adminUserGuidesRouter,
  onboardingRouter,
};

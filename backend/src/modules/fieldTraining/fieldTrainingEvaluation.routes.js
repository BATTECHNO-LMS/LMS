'use strict';

const { validateRequest } = require('../../middlewares/validate.middleware');
const controller = require('./fieldTrainingEvaluation.controller');
const v = require('./fieldTrainingEvaluation.validation');

function mountWriteRoutes(router, authorize) {
  router.get(
    '/evaluation-templates',
    authorize,
    validateRequest({ query: v.universityQuerySchema }),
    controller.listTemplates
  );
  router.post(
    '/evaluation-templates',
    authorize,
    controller.handleMulter,
    validateRequest({ body: v.uploadTemplateBodySchema }),
    controller.uploadTemplate
  );
  router.post(
    '/evaluation-templates/:templateId/default',
    authorize,
    validateRequest({ params: v.templateIdParamSchema }),
    controller.setDefaultTemplate
  );
  router.get(
    '/evaluation-templates/:templateId/preview',
    authorize,
    validateRequest({ params: v.templateIdParamSchema }),
    controller.previewTemplate
  );
  router.get(
    '/applications/:applicationId/evaluation-report/preview',
    authorize,
    validateRequest({ params: v.applicationIdParamSchema }),
    controller.previewApplication
  );
  router.get(
    '/evaluation-templates/:templateId/download',
    authorize,
    validateRequest({ params: v.templateIdParamSchema }),
    controller.downloadTemplate
  );
  router.get(
    '/evaluation-policies',
    authorize,
    validateRequest({ query: v.universityQuerySchema }),
    controller.getPolicy
  );
  router.put(
    '/evaluation-policies',
    authorize,
    validateRequest({ body: v.policyBodySchema }),
    controller.upsertPolicy
  );
  router.get(
    '/applications/:applicationId/supervisor-ratings',
    authorize,
    validateRequest({ params: v.applicationIdParamSchema }),
    controller.listRatings
  );
  router.post(
    '/applications/:applicationId/supervisor-ratings',
    authorize,
    validateRequest({ params: v.applicationIdParamSchema, body: v.ratingBodySchema }),
    controller.saveRating
  );
  router.post(
    '/applications/:applicationId/evaluation-report',
    authorize,
    validateRequest({ params: v.applicationIdParamSchema }),
    controller.generateOne
  );
  router.get(
    '/:id/evaluation-template',
    authorize,
    validateRequest({ params: v.opportunityIdParamSchema }),
    controller.opportunityTemplate
  );
  router.post(
    '/:id/evaluation-template',
    authorize,
    controller.handleMulter,
    validateRequest({ params: v.opportunityIdParamSchema, body: v.uploadTemplateBodySchema }),
    (req, res, next) => {
      req.body.opportunity_id = req.params.id;
      if (req.validated?.body) req.validated.body.opportunity_id = req.params.id;
      return controller.uploadTemplate(req, res, next);
    }
  );
  router.post(
    '/:id/evaluation-template/assign',
    authorize,
    validateRequest({ params: v.opportunityIdParamSchema, body: v.assignTemplateBodySchema }),
    controller.assignOpportunityTemplate
  );
  router.post(
    '/:id/evaluation-template/use-default',
    authorize,
    validateRequest({ params: v.opportunityIdParamSchema }),
    controller.useUniversityDefault
  );
  router.post(
    '/:id/evaluation-reports/generate',
    authorize,
    validateRequest({ params: v.opportunityIdParamSchema }),
    controller.generateOpportunity
  );
  router.post(
    '/evaluation-reports/generate',
    authorize,
    validateRequest({ body: v.generateBodySchema }),
    controller.generateReports
  );
  router.post(
    '/evaluation-reports/:evaluationId/regenerate',
    authorize,
    validateRequest({ params: v.evaluationIdParamSchema, body: v.regenerateBodySchema }),
    controller.regenerate
  );
  router.patch(
    '/evaluation-reports/:evaluationId/comments',
    authorize,
    validateRequest({ params: v.evaluationIdParamSchema, body: v.commentsBodySchema }),
    controller.updateComments
  );
}

function mountReadRoutes(router, authorize) {
  router.get(
    '/evaluation-reports',
    authorize,
    validateRequest({ query: v.reportListQuerySchema }),
    controller.listReports
  );
  router.get(
    '/evaluation-reports/:evaluationId/download',
    authorize,
    validateRequest({ params: v.evaluationIdParamSchema }),
    controller.downloadReport
  );
  router.post(
    '/evaluation-reports/zip',
    authorize,
    validateRequest({ body: v.zipBodySchema }),
    controller.bulkZip
  );
  router.get(
    '/evaluation-reports/supervisor-groups',
    authorize,
    validateRequest({ query: v.supervisorGroupsQuerySchema }),
    controller.listSupervisorGroups
  );
  router.post(
    '/evaluation-reports/supervisor-zip',
    authorize,
    validateRequest({ body: v.supervisorZipBodySchema }),
    controller.zipSupervisorReports
  );
}

function mountStudentRoutes(router, authorize) {
  router.get(
    '/applications/:applicationId/evaluation-report/download',
    authorize,
    validateRequest({ params: v.applicationIdParamSchema }),
    controller.studentDownload
  );
}

module.exports = { mountWriteRoutes, mountReadRoutes, mountStudentRoutes };

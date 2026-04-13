const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const qaReviewsController = require('./qaReviews.controller');
const {
  uuidParamSchema,
  listQaReviewsQuerySchema,
  getQaReviewQuerySchema,
  createQaReviewBodySchema,
  updateQaReviewBodySchema,
  patchQaReviewStatusBodySchema,
} = require('./qaReviews.validation');

const router = express.Router();
const qaRoles = authorizeRoles(...env.QA_OVERSIGHT_ROLE_CODES);

router.get('/', authenticate, qaRoles, validateRequest({ query: listQaReviewsQuerySchema }), qaReviewsController.list);

router.post(
  '/',
  authenticate,
  qaRoles,
  validateRequest({ body: createQaReviewBodySchema }),
  qaReviewsController.create
);

router.get(
  '/:id',
  authenticate,
  qaRoles,
  validateRequest({ params: uuidParamSchema, query: getQaReviewQuerySchema }),
  qaReviewsController.getById
);

router.put(
  '/:id',
  authenticate,
  qaRoles,
  validateRequest({ params: uuidParamSchema, body: updateQaReviewBodySchema }),
  qaReviewsController.update
);

router.patch(
  '/:id/status',
  authenticate,
  qaRoles,
  validateRequest({ params: uuidParamSchema, body: patchQaReviewStatusBodySchema }),
  qaReviewsController.patchStatus
);

module.exports = router;

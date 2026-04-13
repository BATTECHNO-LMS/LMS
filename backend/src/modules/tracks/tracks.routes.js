const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const tracksController = require('./tracks.controller');
const {
  uuidParamSchema,
  listTracksQuerySchema,
  createTrackBodySchema,
  updateTrackBodySchema,
} = require('./tracks.validation');

const router = express.Router();

const curriculumRead = authorizeRoles(...env.CURRICULUM_READ_ROLE_CODES);
const curriculumWrite = authorizeRoles(...env.CURRICULUM_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  curriculumRead,
  validateRequest({ query: listTracksQuerySchema }),
  tracksController.list
);

router.get(
  '/:id',
  authenticate,
  curriculumRead,
  validateRequest({ params: uuidParamSchema }),
  tracksController.getById
);

router.post(
  '/',
  authenticate,
  curriculumWrite,
  validateRequest({ body: createTrackBodySchema }),
  tracksController.create
);

router.put(
  '/:id',
  authenticate,
  curriculumWrite,
  validateRequest({ params: uuidParamSchema, body: updateTrackBodySchema }),
  tracksController.update
);

module.exports = router;

const express = require('express');
const landingStatsController = require('./landingStats.controller');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { z } = require('zod');
const reportsCtrl = require('../trainingPrograms/trainingReports.controller');

const router = express.Router();

router.get('/landing-stats', landingStatsController.getLandingStats);

router.get(
  '/reports/:verificationCode/verify',
  validateRequest({
    params: z.object({ verificationCode: z.string().min(8).max(128) }),
  }),
  reportsCtrl.verifyPublicReport
);

module.exports = router;

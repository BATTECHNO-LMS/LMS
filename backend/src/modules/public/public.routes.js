const express = require('express');
const landingStatsController = require('./landingStats.controller');
const internshipJourneyController = require('./internshipJourney.controller');
const { academicProfileBodySchema } = require('./internshipJourney.validation');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { z } = require('zod');
const reportsCtrl = require('../trainingPrograms/trainingReports.controller');

const router = express.Router();

router.get('/landing-stats', landingStatsController.getLandingStats);

router.get('/internship-journey/universities', internshipJourneyController.listUniversities);
router.get('/internship-journey/tracks', internshipJourneyController.listTracks);
router.post(
  '/internship-journey/validate',
  validateRequest({ body: academicProfileBodySchema }),
  internshipJourneyController.validateProfile
);
router.post(
  '/internship-journey/plan-pdf',
  validateRequest({ body: academicProfileBodySchema }),
  internshipJourneyController.downloadPlanPdf
);

router.get(
  '/reports/:verificationCode/verify',
  validateRequest({
    params: z.object({ verificationCode: z.string().min(8).max(128) }),
  }),
  reportsCtrl.verifyPublicReport
);

module.exports = router;

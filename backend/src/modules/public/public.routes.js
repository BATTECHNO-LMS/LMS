const express = require('express');
const landingStatsController = require('./landingStats.controller');

const router = express.Router();

router.get('/landing-stats', landingStatsController.getLandingStats);

module.exports = router;

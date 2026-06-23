const { success } = require('../../utils/apiResponse');
const landingStatsService = require('./landingStats.service');

async function getLandingStats(_req, res, next) {
  try {
    const data = await landingStatsService.getLandingStats();
    return success(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getLandingStats };

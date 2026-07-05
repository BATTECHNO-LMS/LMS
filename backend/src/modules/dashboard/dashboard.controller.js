const dashboardService = require('./dashboard.service');
const { success } = require('../../utils/apiResponse');

async function adminStats(req, res, next) {
  try {
    const data = await dashboardService.getAdminDashboardStats(req.user);
    return success(res, data, { message: 'Admin dashboard stats retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { adminStats };

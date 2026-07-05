const settingsService = require('./settings.service');
const { success } = require('../../utils/apiResponse');

async function get(req, res, next) {
  try {
    const data = await settingsService.getSettings();
    return success(res, data, { message: 'Settings retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await settingsService.updateSettings(req.validated.body);
    return success(res, data, { message: 'Settings updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { get, update };

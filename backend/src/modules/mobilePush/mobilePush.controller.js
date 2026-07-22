const mobilePushService = require('./mobilePush.service');
const { success } = require('../../utils/apiResponse');

async function register(req, res, next) {
  try {
    const data = await mobilePushService.registerDevice(req.user.userId, req.validated.body);
    return success(res, data, { message: 'Device registered for push notifications' });
  } catch (e) {
    return next(e);
  }
}

async function unregister(req, res, next) {
  try {
    const data = await mobilePushService.unregisterDevice(
      req.user.userId,
      req.validated.body.registration_token
    );
    return success(res, data, { message: 'Device unregistered' });
  } catch (e) {
    return next(e);
  }
}

async function unregisterAll(req, res, next) {
  try {
    const data = await mobilePushService.unregisterAllDevices(req.user.userId);
    return success(res, data, { message: 'All devices unregistered' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { register, unregister, unregisterAll };

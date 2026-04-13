const notificationsService = require('./notifications.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await notificationsService.listNotifications(req.validated.query, req.user);
    return success(res, data, { message: 'Notifications retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await notificationsService.getNotificationById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Notification retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function markRead(req, res, next) {
  try {
    const data = await notificationsService.markRead(req.validated.params.id, req.user);
    return success(res, data, { message: 'Notification marked as read' });
  } catch (e) {
    return next(e);
  }
}

async function markAllRead(req, res, next) {
  try {
    const data = await notificationsService.markAllRead(req.user);
    return success(res, data, { message: 'All notifications marked as read' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, markRead, markAllRead };

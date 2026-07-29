const notificationsService = require('./notifications.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await notificationsService.listNotifications(req.validated.query, req.user);
    return success(res, data, { message: 'تم جلب الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await notificationsService.getNotificationById(req.validated.params.id, req.user);
    return success(res, data, { message: 'تم جلب الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function markRead(req, res, next) {
  try {
    const data = await notificationsService.markRead(req.validated.params.id, req.user);
    return success(res, data, { message: 'تم تعليم الإشعار كمقروء' });
  } catch (e) {
    return next(e);
  }
}

async function markAllRead(req, res, next) {
  try {
    const data = await notificationsService.markAllRead(req.user);
    return success(res, data, { message: 'تم تعليم جميع الإشعارات كمقروءة' });
  } catch (e) {
    return next(e);
  }
}

async function acknowledge(req, res, next) {
  try {
    const data = await notificationsService.acknowledge(req.validated.params.id, req.user);
    return success(res, data, { message: 'تم تأكيد قراءة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function archive(req, res, next) {
  try {
    const data = await notificationsService.archive(req.validated.params.id, req.user);
    return success(res, data, { message: 'تم أرشفة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function unreadCount(req, res, next) {
  try {
    const data = await notificationsService.unreadCount(req.user);
    return success(res, data, { message: 'عدد الإشعارات غير المقروءة' });
  } catch (e) {
    return next(e);
  }
}

async function getPreferences(req, res, next) {
  try {
    const data = await notificationsService.getPreferences(req.user);
    return success(res, data, { message: 'تم جلب تفضيلات الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const data = await notificationsService.updatePreferences(req.user, req.validated.body);
    return success(res, data, { message: 'تم تحديث تفضيلات الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  markRead,
  markAllRead,
  acknowledge,
  archive,
  unreadCount,
  getPreferences,
  updatePreferences,
};

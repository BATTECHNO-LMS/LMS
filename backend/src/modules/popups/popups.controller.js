'use strict';

const { success, created } = require('../../utils/apiResponse');
const popupsService = require('./popups.service');

function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || null;
}

async function adminList(req, res, next) {
  try {
    const data = await popupsService.adminListPopups(req.user, req.validated?.query || {});
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreate(req, res, next) {
  try {
    const data = await popupsService.adminCreatePopup(req.user, req.validated.body, {
      ipAddress: clientIp(req),
    });
    return created(res, data, { message: 'تم إنشاء النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const data = await popupsService.adminUpdatePopup(
      req.user,
      req.validated.params.id,
      req.validated.body,
      { ipAddress: clientIp(req) }
    );
    return success(res, data, { message: 'تم تحديث النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function adminPublish(req, res, next) {
  try {
    const data = await popupsService.adminPublishPopup(req.user, req.validated.params.id, {
      ipAddress: clientIp(req),
    });
    return success(res, data, { message: 'تم نشر النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function adminPause(req, res, next) {
  try {
    const data = await popupsService.adminPausePopup(req.user, req.validated.params.id, {
      ipAddress: clientIp(req),
    });
    return success(res, data, { message: 'تم إيقاف النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function adminArchive(req, res, next) {
  try {
    const data = await popupsService.adminArchivePopup(req.user, req.validated.params.id, {
      ipAddress: clientIp(req),
    });
    return success(res, data, { message: 'تم أرشفة النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function listActive(req, res, next) {
  try {
    const data = await popupsService.listActivePopups(req.user, req.validated?.query || {});
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function viewPopup(req, res, next) {
  try {
    const data = await popupsService.recordView(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function dismissPopup(req, res, next) {
  try {
    const data = await popupsService.recordDismiss(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم إغلاق النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

async function acknowledgePopup(req, res, next) {
  try {
    const data = await popupsService.recordAcknowledge(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم تأكيد الاطلاع على النافذة المنبثقة' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  adminList,
  adminCreate,
  adminUpdate,
  adminPublish,
  adminPause,
  adminArchive,
  listActive,
  viewPopup,
  dismissPopup,
  acknowledgePopup,
};

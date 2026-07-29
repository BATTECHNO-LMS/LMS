'use strict';

const { success, created } = require('../../utils/apiResponse');
const service = require('./announcements.service');

async function adminList(req, res, next) {
  try {
    const data = await service.listAdmin(req.user, req.validated.query || {});
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreate(req, res, next) {
  try {
    const data = await service.createAnnouncement(req.user, req.validated.body);
    return created(res, data, { message: 'تم إنشاء الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const data = await service.updateAnnouncement(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data, { message: 'تم تحديث الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminPublish(req, res, next) {
  try {
    const data = await service.publishAnnouncement(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم نشر الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminSchedule(req, res, next) {
  try {
    const data = await service.scheduleAnnouncement(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data, { message: 'تم جدولة الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminPause(req, res, next) {
  try {
    const data = await service.pauseAnnouncement(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم إيقاف الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminArchive(req, res, next) {
  try {
    const data = await service.archiveAnnouncement(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم أرشفة الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminDuplicate(req, res, next) {
  try {
    const data = await service.duplicateAnnouncement(req.user, req.validated.params.id);
    return created(res, data, { message: 'تم نسخ الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function adminAnalytics(req, res, next) {
  try {
    const data = await service.getAnalytics(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listActive(req, res, next) {
  try {
    const data = await service.listActiveForUser(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function view(req, res, next) {
  try {
    const data = await service.recordView(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function dismiss(req, res, next) {
  try {
    const data = await service.recordDismiss(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم إغلاق الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function acknowledge(req, res, next) {
  try {
    const data = await service.recordAcknowledge(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم تأكيد قراءة الإعلان' });
  } catch (e) {
    return next(e);
  }
}

async function click(req, res, next) {
  try {
    const data = await service.recordClick(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  adminList,
  adminCreate,
  adminUpdate,
  adminPublish,
  adminSchedule,
  adminPause,
  adminArchive,
  adminDuplicate,
  adminAnalytics,
  listActive,
  view,
  dismiss,
  acknowledge,
  click,
};

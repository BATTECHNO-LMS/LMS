'use strict';

const { success, created } = require('../../utils/apiResponse');
const service = require('./notificationRules.service');
const { processDueJobs } = require('./notificationDispatcher.service');
const {
  NOTIFICATION_EVENTS,
  CATEGORIES,
  PRIORITIES,
  CHANNELS,
  ALLOWED_TEMPLATE_VARS,
} = require('./notificationEvents.catalog');

async function listRules(req, res, next) {
  try {
    const data = await service.listRules(req.user, req.validated.query || {});
    return success(res, data, { message: 'تم جلب قواعد الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

async function getRule(req, res, next) {
  try {
    const data = await service.getRule(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم جلب قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function createRule(req, res, next) {
  try {
    const data = await service.createRule(req.user, req.validated.body);
    return created(res, data, { message: 'تم إنشاء قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function updateRule(req, res, next) {
  try {
    const data = await service.updateRule(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data, { message: 'تم تحديث قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function activateRule(req, res, next) {
  try {
    const data = await service.activateRule(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم تفعيل قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function pauseRule(req, res, next) {
  try {
    const data = await service.pauseRule(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم إيقاف قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function archiveRule(req, res, next) {
  try {
    const data = await service.archiveRule(req.user, req.validated.params.id);
    return success(res, data, { message: 'تم أرشفة قاعدة الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function listTemplates(req, res, next) {
  try {
    const data = await service.listTemplates(req.user, req.validated.query || {});
    return success(res, data, { message: 'تم جلب قوالب الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

async function createTemplate(req, res, next) {
  try {
    const data = await service.createTemplate(req.user, req.validated.body);
    return created(res, data, { message: 'تم إنشاء قالب الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const data = await service.updateTemplate(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data, { message: 'تم تحديث قالب الإشعار' });
  } catch (e) {
    return next(e);
  }
}

async function previewTemplate(req, res, next) {
  try {
    const data = await service.previewTemplate(req.user, req.validated.body);
    return success(res, data, { message: 'معاينة القالب (لم يُرسل إشعار)' });
  } catch (e) {
    return next(e);
  }
}

async function listDeliveries(req, res, next) {
  try {
    const data = await service.listDeliveries(req.user, req.validated.query || {});
    return success(res, data, { message: 'تم جلب سجلات التسليم' });
  } catch (e) {
    return next(e);
  }
}

async function listFailures(req, res, next) {
  try {
    const data = await service.listFailures(req.user, req.validated.query || {});
    return success(res, data, { message: 'تم جلب حالات الفشل' });
  } catch (e) {
    return next(e);
  }
}

async function retryDelivery(req, res, next) {
  try {
    const data = await service.retryDelivery(req.user, req.validated.params.id);
    return success(res, data, { message: 'تمت إعادة محاولة التسليم' });
  } catch (e) {
    return next(e);
  }
}

async function analytics(req, res, next) {
  try {
    const data = await service.getAnalytics(req.user, req.validated.query || {});
    return success(res, data, { message: 'تم جلب إحصائيات الإشعارات' });
  } catch (e) {
    return next(e);
  }
}

async function manualSend(req, res, next) {
  try {
    const data = await service.manualSend(req.user, req.validated.body);
    return success(res, data, {
      message: data.dry_run ? 'معاينة المستلمين' : 'تم إرسال الإشعار',
    });
  } catch (e) {
    return next(e);
  }
}

async function previewSend(req, res, next) {
  try {
    const data = await service.previewManualRecipients(req.user, req.validated.body);
    return success(res, data, { message: 'معاينة عدد المستلمين' });
  } catch (e) {
    return next(e);
  }
}

async function catalog(req, res, next) {
  try {
    return success(
      res,
      {
        events: NOTIFICATION_EVENTS,
        categories: CATEGORIES,
        priorities: PRIORITIES,
        channels: CHANNELS,
        allowed_template_vars: ALLOWED_TEMPLATE_VARS,
      },
      { message: 'كتالوج أحداث الإشعارات' }
    );
  } catch (e) {
    return next(e);
  }
}

async function processJobs(req, res, next) {
  try {
    const data = await processDueJobs({ limit: Number(req.query?.limit) || 50 });
    return success(res, data, { message: 'تمت معالجة المهام المجدولة' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listRules,
  getRule,
  createRule,
  updateRule,
  activateRule,
  pauseRule,
  archiveRule,
  listTemplates,
  createTemplate,
  updateTemplate,
  previewTemplate,
  listDeliveries,
  listFailures,
  retryDelivery,
  analytics,
  manualSend,
  previewSend,
  catalog,
  processJobs,
};

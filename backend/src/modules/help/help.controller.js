'use strict';

const { success, created } = require('../../utils/apiResponse');
const helpService = require('./help.service');
const { FIELD_TRAINING_STUDENT_GUIDE_KEY } = require('./help.constants');

async function getOnboarding(req, res, next) {
  try {
    const data = await helpService.getStudentOnboardingState(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function startOnboarding(req, res, next) {
  try {
    const data = await helpService.startOnboarding(req.user);
    return success(res, data, { message: 'تم بدء الجولة التعريفية' });
  } catch (e) {
    return next(e);
  }
}

async function progressOnboarding(req, res, next) {
  try {
    const data = await helpService.updateOnboardingProgress(req.user, req.validated.body);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function completeOnboarding(req, res, next) {
  try {
    const data = await helpService.completeOnboarding(req.user);
    return success(res, data, { message: 'تم إكمال الجولة التعريفية' });
  } catch (e) {
    return next(e);
  }
}

async function dismissOnboarding(req, res, next) {
  try {
    const data = await helpService.dismissOnboarding(req.user);
    return success(res, data, { message: 'تم تخطي الجولة' });
  } catch (e) {
    return next(e);
  }
}

async function restartOnboarding(req, res, next) {
  try {
    const data = await helpService.restartOnboarding(req.user);
    return success(res, data, { message: 'تم إعادة تشغيل الجولة' });
  } catch (e) {
    return next(e);
  }
}

async function getActiveOnboarding(req, res, next) {
  try {
    const guideKey =
      req.query.guideKey || req.query.guide_key || FIELD_TRAINING_STUDENT_GUIDE_KEY;
    const data = await helpService.getActiveOnboardingForKey(req.user, String(guideKey));
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function getOnboardingByKey(req, res, next) {
  try {
    const data = await helpService.getActiveOnboardingForKey(
      req.user,
      req.validated.params.guideKey
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function progressOnboardingByKey(req, res, next) {
  try {
    const data = await helpService.updateOnboardingProgress(
      req.user,
      req.validated.body,
      req.validated.params.guideKey
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function completeOnboardingByKey(req, res, next) {
  try {
    const data = await helpService.completeOnboarding(req.user, req.validated.params.guideKey);
    return success(res, data, { message: 'تم إكمال الجولة التعريفية' });
  } catch (e) {
    return next(e);
  }
}

async function dismissOnboardingByKey(req, res, next) {
  try {
    const data = await helpService.dismissOnboarding(req.user, req.validated.params.guideKey);
    return success(res, data, { message: 'تم تخطي الجولة' });
  } catch (e) {
    return next(e);
  }
}

async function restartOnboardingByKey(req, res, next) {
  try {
    const data = await helpService.restartOnboarding(req.user, req.validated.params.guideKey);
    return success(res, data, { message: 'تم إعادة تشغيل الجولة' });
  } catch (e) {
    return next(e);
  }
}

async function listCategories(req, res, next) {
  try {
    const data = await helpService.listPublishedCategories(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listArticles(req, res, next) {
  try {
    const data = await helpService.listPublishedArticles(req.user, {
      categorySlug: req.query.category || null,
      faqOnly: req.query.faq === '1' || req.query.faq === 'true',
    });
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function getArticle(req, res, next) {
  try {
    const data = await helpService.getPublishedArticleBySlug(req.user, req.validated.params.slug);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function viewArticle(req, res, next) {
  try {
    const data = await helpService.recordArticleView(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function search(req, res, next) {
  try {
    const data = await helpService.searchHelp(
      req.user,
      req.validated.query.q,
      req.validated.query.limit || 20
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function contextualHelp(req, res, next) {
  try {
    const data = await helpService.getContextualHelp(req.user, req.validated.query);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function createTicket(req, res, next) {
  try {
    const data = await helpService.createSupportTicket(req.user, req.validated.body);
    return created(res, data, { message: 'تم إنشاء طلب الدعم' });
  } catch (e) {
    return next(e);
  }
}

async function listTickets(req, res, next) {
  try {
    const data = await helpService.listMySupportTickets(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function getTicket(req, res, next) {
  try {
    const data = await helpService.getMySupportTicket(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminListCategories(req, res, next) {
  try {
    const data = await helpService.adminListCategories(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreateCategory(req, res, next) {
  try {
    const data = await helpService.adminCreateCategory(req.user, req.validated.body);
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminUpdateCategory(req, res, next) {
  try {
    const data = await helpService.adminUpdateCategory(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminDeleteCategory(req, res, next) {
  try {
    const data = await helpService.adminDeleteCategory(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminListArticles(req, res, next) {
  try {
    const data = await helpService.adminListArticles(req.user, {
      categoryId: req.query.category_id || null,
    });
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreateArticle(req, res, next) {
  try {
    const data = await helpService.adminCreateArticle(req.user, req.validated.body);
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminUpdateArticle(req, res, next) {
  try {
    const data = await helpService.adminUpdateArticle(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminPublishArticle(req, res, next) {
  try {
    const publish = req.body?.publish !== false;
    const data = await helpService.adminPublishArticle(req.user, req.validated.params.id, publish);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminArchiveArticle(req, res, next) {
  try {
    const data = await helpService.adminArchiveArticle(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminDeleteArticle(req, res, next) {
  try {
    const data = await helpService.adminDeleteArticle(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminListVersions(req, res, next) {
  try {
    const data = await helpService.adminListVersions(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminRestoreVersion(req, res, next) {
  try {
    const data = await helpService.adminRestoreVersion(
      req.user,
      req.validated.params.id,
      req.validated.params.version
    );
    return success(res, data, { message: 'تم استعادة الإصدار' });
  } catch (e) {
    return next(e);
  }
}

async function adminReorderArticles(req, res, next) {
  try {
    const data = await helpService.adminReorderArticles(req.user, req.validated.body.items);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminAnalytics(req, res, next) {
  try {
    const data = await helpService.adminHelpAnalytics(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminListGuides(req, res, next) {
  try {
    const data = await helpService.adminListGuides(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminGetGuide(req, res, next) {
  try {
    const data = await helpService.adminGetGuide(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreateGuide(req, res, next) {
  try {
    const data = await helpService.adminCreateGuide(req.user, req.validated.body);
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminUpdateGuide(req, res, next) {
  try {
    const data = await helpService.adminUpdateGuide(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminPublishGuide(req, res, next) {
  try {
    const data = await helpService.adminPublishGuide(
      req.user,
      req.validated.params.id,
      req.validated.body || {}
    );
    return success(res, data, { message: 'تم نشر الجولة' });
  } catch (e) {
    return next(e);
  }
}

async function adminPreviewGuide(req, res, next) {
  try {
    const data = await helpService.adminPreviewGuide(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminReorderSteps(req, res, next) {
  try {
    const data = await helpService.adminReorderSteps(
      req.user,
      req.validated.params.id,
      req.validated.body.items
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminArchiveGuide(req, res, next) {
  try {
    const data = await helpService.adminArchiveGuide(req.user, req.validated.params.id);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminCreateGuideStep(req, res, next) {
  try {
    const data = await helpService.adminCreateGuideStep(
      req.user,
      req.validated.params.id,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminUpdateGuideStep(req, res, next) {
  try {
    const data = await helpService.adminUpdateGuideStep(
      req.user,
      req.validated.params.id,
      req.validated.params.stepId,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function adminDeleteGuideStep(req, res, next) {
  try {
    const data = await helpService.adminDeleteGuideStep(
      req.user,
      req.validated.params.id,
      req.validated.params.stepId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getOnboarding,
  startOnboarding,
  progressOnboarding,
  completeOnboarding,
  dismissOnboarding,
  restartOnboarding,
  getActiveOnboarding,
  getOnboardingByKey,
  progressOnboardingByKey,
  completeOnboardingByKey,
  dismissOnboardingByKey,
  restartOnboardingByKey,
  listCategories,
  listArticles,
  getArticle,
  viewArticle,
  search,
  contextualHelp,
  createTicket,
  listTickets,
  getTicket,
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminListArticles,
  adminCreateArticle,
  adminUpdateArticle,
  adminPublishArticle,
  adminArchiveArticle,
  adminDeleteArticle,
  adminListVersions,
  adminRestoreVersion,
  adminReorderArticles,
  adminAnalytics,
  adminListGuides,
  adminGetGuide,
  adminCreateGuide,
  adminUpdateGuide,
  adminPublishGuide,
  adminPreviewGuide,
  adminReorderSteps,
  adminArchiveGuide,
  adminCreateGuideStep,
  adminUpdateGuideStep,
  adminDeleteGuideStep,
};

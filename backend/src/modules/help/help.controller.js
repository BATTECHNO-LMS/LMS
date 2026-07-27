'use strict';

const { success, created } = require('../../utils/apiResponse');
const helpService = require('./help.service');

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

async function adminDeleteArticle(req, res, next) {
  try {
    const data = await helpService.adminDeleteArticle(req.user, req.validated.params.id);
    return success(res, data);
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

module.exports = {
  getOnboarding,
  startOnboarding,
  progressOnboarding,
  completeOnboarding,
  dismissOnboarding,
  restartOnboarding,
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
  adminDeleteArticle,
  adminReorderArticles,
  adminAnalytics,
};

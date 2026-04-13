const qaReviewsService = require('./qaReviews.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await qaReviewsService.listQaReviews(req.validated.query, req.user);
    return success(res, data, { message: 'QA reviews retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await qaReviewsService.getQaReviewById(req.validated.params.id, req.validated.query, req.user);
    return success(res, data, { message: 'QA review retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await qaReviewsService.createQaReview(req.validated.body, req.user);
    return created(res, data, { message: 'QA review created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await qaReviewsService.updateQaReview(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'QA review updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await qaReviewsService.patchQaReviewStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'QA review status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

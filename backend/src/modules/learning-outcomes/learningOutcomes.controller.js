const learningOutcomesService = require('./learningOutcomes.service');
const { success, okMessage } = require('../../utils/apiResponse');

function requester(req) {
  return {
    isGlobal: Boolean(req.user?.isGlobal),
    universityId: req.user?.universityId ?? null,
  };
}

async function getById(req, res, next) {
  try {
    const data = await learningOutcomesService.getById(req.validated.params.id, requester(req));
    return success(res, data, { message: 'Learning outcome retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await learningOutcomesService.updateLearningOutcome(
      req.validated.params.id,
      req.validated.body,
      requester(req)
    );
    return success(res, data, { message: 'Learning outcome updated' });
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await learningOutcomesService.deleteLearningOutcome(req.validated.params.id, requester(req));
    return okMessage(res, 'Learning outcome deleted');
  } catch (e) {
    return next(e);
  }
}

module.exports = { getById, update, remove };

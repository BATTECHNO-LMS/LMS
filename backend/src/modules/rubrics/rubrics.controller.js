const rubricsService = require('./rubrics.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await rubricsService.listRubrics(req.validated.query);
    return success(res, data, { message: 'Rubrics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await rubricsService.getRubricById(req.validated.params.id);
    return success(res, data, { message: 'Rubric retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await rubricsService.createRubric(req.validated.body);
    return created(res, data, { message: 'Rubric created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await rubricsService.updateRubric(req.validated.params.id, req.validated.body);
    return success(res, data, { message: 'Rubric updated' });
  } catch (e) {
    return next(e);
  }
}

async function listCriteria(req, res, next) {
  try {
    const data = await rubricsService.listCriteria(req.validated.params.id);
    return success(res, data, { message: 'Criteria retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createCriterion(req, res, next) {
  try {
    const data = await rubricsService.createCriterion(req.validated.params.id, req.validated.body);
    return created(res, data, { message: 'Criterion created' });
  } catch (e) {
    return next(e);
  }
}

async function updateCriterion(req, res, next) {
  try {
    const data = await rubricsService.updateCriterion(req.validated.params.id, req.validated.body);
    return success(res, data, { message: 'Criterion updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteCriterion(req, res, next) {
  try {
    const data = await rubricsService.deleteCriterion(req.validated.params.id);
    return success(res, data, { message: 'Criterion deleted' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  listCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
};

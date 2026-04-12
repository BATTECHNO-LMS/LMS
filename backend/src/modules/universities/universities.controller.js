const universitiesService = require('./universities.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await universitiesService.listUniversities();
    return success(res, data, { message: 'Universities retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await universitiesService.getUniversityById(req.validated.params.id, req.validated.query);
    return success(res, data, { message: 'University retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await universitiesService.createUniversity(req.validated.body);
    return created(res, data, { message: 'University created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await universitiesService.updateUniversity(req.validated.params.id, req.validated.body);
    return success(res, data, { message: 'University updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
};

const universitiesService = require('./universities.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = universitiesService.listUniversities();
    return success(res, { universities: data });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list };

const specialtiesService = require('./specialties.service');
const { success } = require('../../utils/apiResponse');

async function listActive(_req, res, next) {
  try {
    const data = await specialtiesService.listActiveSpecialties();
    return success(res, data, { message: 'Specialties retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listActive };

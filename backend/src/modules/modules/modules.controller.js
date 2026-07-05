const modulesService = require('./modules.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await modulesService.listModules(req.validated.query);
    return success(res, data, { message: 'Modules retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list };

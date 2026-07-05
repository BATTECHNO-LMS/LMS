const rolesService = require('./roles.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await rolesService.listRolesOverview();
    return success(res, data, { message: 'Roles overview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await rolesService.getRoleDetail(req.validated.params.id);
    return success(res, data, { message: 'Role retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById };

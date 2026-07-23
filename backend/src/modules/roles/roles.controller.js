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

async function updatePermissions(req, res, next) {
  try {
    const data = await rolesService.updateRolePermissions(
      req.validated.params.id,
      req.validated.body.permission_codes,
      req.user,
      {
        actorUserId: req.user?.userId,
        ipAddress: req.ip,
      }
    );
    return success(res, data, { message: 'Role permissions updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, updatePermissions };

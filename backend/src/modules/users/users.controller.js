const usersService = require('./users.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await usersService.listUsers(req.validated.query);
    return success(res, data, { message: 'Users retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await usersService.getUserById(req.validated.params.id);
    return success(res, data, { message: 'User retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await usersService.createUser(req.validated.body);
    return created(res, data, { message: 'User created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await usersService.updateUser(req.validated.params.id, req.validated.body);
    return success(res, data, { message: 'User updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await usersService.patchUserStatus(req.validated.params.id, req.validated.body.status);
    return success(res, data, { message: 'User status updated' });
  } catch (e) {
    return next(e);
  }
}

async function activate(req, res, next) {
  try {
    const data = await usersService.activateUser(req.validated.params.id, {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'User activated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  patchStatus,
  activate,
};

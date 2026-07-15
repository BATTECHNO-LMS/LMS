const usersService = require('./users.service');
const { buildContentDisposition } = require('./users.export.excel');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await usersService.listUsers(req.validated.query, req.user);
    return success(res, data, { message: 'Users retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await usersService.getUserById(req.validated.params.id, req.user);
    return success(res, data, { message: 'User retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await usersService.createUser(req.validated.body, req.user);
    return created(res, data, { message: 'User created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await usersService.updateUser(req.validated.params.id, req.validated.body, req.user, {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'User updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await usersService.patchUserStatus(
      req.validated.params.id,
      req.validated.body.status,
      req.user,
      { actorUserId: req.user.userId, ipAddress: req.ip || null }
    );
    return success(res, data, { message: 'User status updated' });
  } catch (e) {
    return next(e);
  }
}

async function resetPassword(req, res, next) {
  try {
    const data = await usersService.adminResetPassword(
      req.validated.params.id,
      req.validated.body,
      req.user,
      { actorUserId: req.user.userId, ipAddress: req.ip || null }
    );
    return success(res, data, { message: data.message });
  } catch (e) {
    return next(e);
  }
}

async function activate(req, res, next) {
  try {
    const data = await usersService.activateUser(req.validated.params.id, {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
      requester: req.user,
    });
    return success(res, data, { message: 'User activated' });
  } catch (e) {
    return next(e);
  }
}

async function activateAllPending(req, res, next) {
  try {
    const data = await usersService.activateAllPendingStudents({
      university_id: req.validated?.query?.university_id,
      user_ids: req.validated?.body?.user_ids,
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
      requester: req.user,
    });
    return success(res, data, {
      message: `تم تفعيل ${data.activated ?? 0} حسابًا معلقًا بنجاح.`,
    });
  } catch (e) {
    return next(e);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const data = await usersService.verifyUserEmail(req.validated.params.id, {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
      requester: req.user,
    });
    return success(res, data, { message: data.message });
  } catch (e) {
    return next(e);
  }
}

async function verifyAllEmails(req, res, next) {
  try {
    const data = await usersService.verifyAllUnverifiedEmails({
      university_id: req.validated?.query?.university_id,
      status: req.validated?.query?.status,
      user_ids: req.validated?.body?.user_ids,
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
      requester: req.user,
    });
    return success(res, data, { message: data.message });
  } catch (e) {
    return next(e);
  }
}

async function bulkVerifyEmails(req, res, next) {
  try {
    const data = await usersService.bulkVerifyUserEmails(req.validated?.body?.userIds ?? [], {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
      requester: req.user,
    });
    return success(res, data, { message: data.message });
  } catch (e) {
    return next(e);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { buffer, filename } = await usersService.exportUsersExcel(req.validated.query, req.user, {
      actorUserId: req.user.userId,
      ipAddress: req.ip || null,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', buildContentDisposition(filename));
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
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
  resetPassword,
  activate,
  activateAllPending,
  verifyEmail,
  verifyAllEmails,
  bulkVerifyEmails,
  exportExcel,
};

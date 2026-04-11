const usersService = require('./users.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await usersService.listUsers(req.query);
    return success(res, { users: data });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list };

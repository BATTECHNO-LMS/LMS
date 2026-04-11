const authService = require('./auth.service');
const { created, success, okMessage } = require('../../utils/apiResponse');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.validated);
    return created(res, data, { message: 'Registration successful' });
  } catch (e) {
    return next(e);
  }
}

async function login(req, res, next) {
  try {
    const data = await authService.login(req.validated);
    return success(res, data, { message: 'Login successful' });
  } catch (e) {
    return next(e);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.me(req.user.userId);
    return success(res, { user }, { message: 'Profile loaded' });
  } catch (e) {
    return next(e);
  }
}

function logout(_req, res) {
  const { message } = authService.logout();
  return okMessage(res, message);
}

module.exports = { register, login, me, logout };

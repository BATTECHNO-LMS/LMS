const authService = require('./auth.service');
const { created, success, okMessage } = require('../../utils/apiResponse');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.validated);
    return created(res, data, {
      message: 'تم إنشاء الحساب. يرجى توثيق البريد الإلكتروني باستخدام الرمز المرسل.',
    });
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

async function registrationUniversities(_req, res, next) {
  try {
    const data = await authService.universitiesForRegistration();
    return success(res, data, { message: 'Universities retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function registrationSpecialties(_req, res, next) {
  try {
    const data = await authService.specialtiesForRegistration();
    return success(res, data, { message: 'Specialties retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function verifyEmailOtp(req, res, next) {
  try {
    const data = await authService.verifyEmailOtp(req.validated);
    const message = data.requiresAdminApproval
      ? 'تم توثيق البريد الإلكتروني بنجاح. حسابك الآن بانتظار موافقة الإدارة.'
      : 'تم توثيق البريد الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.';
    return success(res, data, { message });
  } catch (e) {
    return next(e);
  }
}

async function resendEmailOtp(req, res, next) {
  try {
    const { message } = await authService.resendEmailOtp(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { message } = await authService.forgotPassword(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function verifyPasswordResetOtp(req, res, next) {
  try {
    const { message, resetToken } = await authService.verifyPasswordResetOtp(req.validated);
    return success(res, { resetToken }, { message });
  } catch (e) {
    return next(e);
  }
}

async function resendPasswordResetOtp(req, res, next) {
  try {
    const { message } = await authService.resendPasswordResetOtp(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { message } = await authService.resetPassword(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  register,
  login,
  me,
  logout,
  registrationUniversities,
  registrationSpecialties,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
};

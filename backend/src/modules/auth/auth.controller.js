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

async function registerInstitution(req, res, next) {
  try {
    const data = await authService.registerInstitution(req.validated);
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
    return success(res, data, { message: 'تم تسجيل الدخول بنجاح.' });
  } catch (e) {
    return next(e);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.me(req.user.userId, { portalType: req.user.portalType || null });
    return success(res, { user }, { message: 'تم تحميل بيانات الحساب.' });
  } catch (e) {
    return next(e);
  }
}

async function listMyAssignments(req, res, next) {
  try {
    const data = await authService.listMyAssignments(req.user.userId);
    return success(res, data, { message: 'تم تحميل الجهات المرتبطة.' });
  } catch (e) {
    return next(e);
  }
}

async function setActiveOrganization(req, res, next) {
  try {
    const user = await authService.setActiveOrganization(
      req.user.userId,
      req.validated.body.organization_id
    );
    return success(res, { user }, { message: 'تم تفعيل الجهة المحددة.' });
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
    return success(res, data, { message: 'تم تحميل الجامعات المتاحة.' });
  } catch (e) {
    return next(e);
  }
}

async function registrationSpecialties(_req, res, next) {
  try {
    const data = await authService.specialtiesForRegistration();
    return success(res, data, { message: 'تم تحميل التخصصات.' });
  } catch (e) {
    return next(e);
  }
}

async function registrationUniversitySpecialties(req, res, next) {
  try {
    const specialties = await authService.universitySpecialtiesForRegistration(
      req.validated.params.universityId
    );
    return success(res, specialties, { message: 'تم تحميل تخصصات الجامعة.' });
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

async function accountStatus(req, res, next) {
  try {
    const data = await authService.accountStatus(req.validated);
    return success(res, data, { message: 'تم تحميل حالة الحساب.' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  register,
  registerInstitution,
  login,
  me,
  listMyAssignments,
  setActiveOrganization,
  logout,
  registrationUniversities,
  registrationSpecialties,
  registrationUniversitySpecialties,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
  accountStatus,
};

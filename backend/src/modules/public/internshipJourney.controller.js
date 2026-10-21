const { success } = require('../../utils/apiResponse');
const internshipJourneyService = require('./internshipJourney.service');

async function listUniversities(_req, res, next) {
  try {
    const data = await internshipJourneyService.listPublicUniversities();
    return success(res, data, { message: 'تم تحميل قائمة الجامعات.' });
  } catch (err) {
    return next(err);
  }
}

async function listTracks(_req, res, next) {
  try {
    const data = internshipJourneyService.listPublicTracks();
    return success(res, data, { message: 'تم تحميل المسارات التدريبية.' });
  } catch (err) {
    return next(err);
  }
}

async function validateProfile(req, res, next) {
  try {
    const data = await internshipJourneyService.validateAcademicProfile(req.validated.body);
    if (!data.valid) {
      return res.status(400).json({
        success: false,
        message: Object.values(data.errors)[0] || 'يرجى مراجعة الحقول المطلوبة.',
        code: 'VALIDATION_ERROR',
        details: { fields: data.errors },
      });
    }
    return success(res, data, { message: 'تم التحقق من الملف الأكاديمي.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUniversities,
  listTracks,
  validateProfile,
};

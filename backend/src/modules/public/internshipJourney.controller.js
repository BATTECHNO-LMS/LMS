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

async function downloadPlanPdf(req, res, next) {
  try {
    const { buffer, filename } = await internshipJourneyService.generatePlanPdf(req.validated.body);
    const asciiName = String(filename || 'eprojecto-field-training-plan.pdf').replace(/[^\w.\-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (err) {
    if (err?.status === 400 || err?.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: err.message || 'يرجى مراجعة الحقول المطلوبة.',
        code: 'VALIDATION_ERROR',
        details: err.details || undefined,
      });
    }
    return next(err);
  }
}

module.exports = {
  listUniversities,
  listTracks,
  validateProfile,
  downloadPlanPdf,
};

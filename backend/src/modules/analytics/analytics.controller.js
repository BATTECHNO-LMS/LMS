const analyticsService = require('./analytics.service');
const { success } = require('../../utils/apiResponse');

async function overview(req, res, next) {
  try {
    const data = await analyticsService.getOverviewAnalytics(req.validated.query);
    return success(res, data, { message: 'Analytics overview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function universities(req, res, next) {
  try {
    const data = await analyticsService.getUniversitiesAnalytics(req.validated.query);
    return success(res, data, { message: 'Universities analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function enrollments(req, res, next) {
  try {
    const data = await analyticsService.getEnrollmentsAnalytics(req.validated.query);
    return success(res, data, { message: 'Enrollments analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function cohorts(req, res, next) {
  try {
    const data = await analyticsService.getCohortsAnalytics(req.validated.query);
    return success(res, data, { message: 'Cohorts analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function assessments(req, res, next) {
  try {
    const data = await analyticsService.getAssessmentsAnalytics(req.validated.query);
    return success(res, data, { message: 'Assessments analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function attendance(req, res, next) {
  try {
    const data = await analyticsService.getAttendanceAnalytics(req.validated.query);
    return success(res, data, { message: 'Attendance analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function evidence(req, res, next) {
  try {
    const data = await analyticsService.getEvidenceAnalytics(req.validated.query);
    return success(res, data, { message: 'Evidence analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function qaIntegrity(req, res, next) {
  try {
    const data = await analyticsService.getQaIntegrityAnalytics(req.validated.query);
    return success(res, data, { message: 'QA & integrity analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function recognition(req, res, next) {
  try {
    const data = await analyticsService.getRecognitionAnalytics(req.validated.query);
    return success(res, data, { message: 'Recognition analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function certificates(req, res, next) {
  try {
    const data = await analyticsService.getCertificatesAnalytics(req.validated.query);
    return success(res, data, { message: 'Certificates analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  overview,
  universities,
  enrollments,
  cohorts,
  assessments,
  attendance,
  evidence,
  qaIntegrity,
  recognition,
  certificates,
};

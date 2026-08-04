'use strict';

const officialReports = require('./trainingReports.service');
const { REPORT_TYPES } = require('./trainingReportMetrics.service');
const { success, created } = require('../../utils/apiResponse');
const { prisma } = require('../../config/db');

const R = (req) => req.user;

async function listProgramReports(req, res, next) {
  try {
    return success(
      res,
      await officialReports.listProgramReports(R(req), req.validated.params.programId, req.validated?.query || {})
    );
  } catch (e) {
    return next(e);
  }
}

async function generateProgramReport(req, res, next) {
  try {
    const body = req.validated?.body || {};
    return created(
      res,
      await officialReports.generateOfficialReport(R(req), {
        reportType: body.reportType,
        programId: req.validated.params.programId,
        cohortId: body.cohortId,
        trainerUserId: body.trainerUserId,
        mode: body.mode,
        reason: body.reason,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function getProgramReportLatest(req, res, next) {
  try {
    const q = req.validated?.query || {};
    return success(
      res,
      await officialReports.getLatestReport(R(req), {
        reportType: q.reportType || REPORT_TYPES.COURSE,
        programId: req.validated.params.programId,
        cohortId: q.cohortId,
        trainerUserId: q.trainerUserId,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function getReportById(req, res, next) {
  try {
    return success(res, await officialReports.getReportById(R(req), req.validated.params.reportId));
  } catch (e) {
    return next(e);
  }
}

async function getReportStatus(req, res, next) {
  try {
    return success(res, await officialReports.getReportStatus(R(req), req.validated.params.reportId));
  } catch (e) {
    return next(e);
  }
}

async function downloadReportPdf(req, res, next) {
  try {
    const { buffer, report } = await officialReports.getOrCreatePdfBuffer(R(req), req.validated.params.reportId);
    const filename = `${report.referenceCode || report.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function downloadReportExcel(req, res, next) {
  try {
    const { buffer, report } = await officialReports.getOrCreateExcelBuffer(R(req), req.validated.params.reportId);
    const filename = `${report.referenceCode || report.id}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function getReportHtml(req, res, next) {
  try {
    const html = await officialReports.getPrintableHtml(R(req), req.validated.params.reportId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return next(e);
  }
}

async function generateCohortReport(req, res, next) {
  try {
    const cohort = await prisma.training_cohorts.findUnique({ where: { id: req.validated.params.cohortId } });
    if (!cohort) {
      const { ApiError } = require('../../utils/apiError');
      throw new ApiError(404, 'الدفعة غير موجودة', null, 'COHORT_NOT_FOUND');
    }
    const body = req.validated?.body || {};
    return created(
      res,
      await officialReports.generateOfficialReport(R(req), {
        reportType: body.reportType || REPORT_TYPES.COHORT,
        programId: cohort.program_id,
        cohortId: cohort.id,
        trainerUserId: body.trainerUserId,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function listCohortReports(req, res, next) {
  try {
    const cohort = await prisma.training_cohorts.findUnique({ where: { id: req.validated.params.cohortId } });
    if (!cohort) {
      const { ApiError } = require('../../utils/apiError');
      throw new ApiError(404, 'الدفعة غير موجودة', null, 'COHORT_NOT_FOUND');
    }
    return success(
      res,
      await officialReports.listProgramReports(R(req), cohort.program_id, {
        cohortId: cohort.id,
        reportType: req.validated?.query?.reportType,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function generateEnrollmentReport(req, res, next) {
  try {
    return created(
      res,
      await officialReports.generateOfficialReport(R(req), {
        reportType: REPORT_TYPES.INDIVIDUAL,
        enrollmentId: req.validated.params.enrollmentId,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function getEnrollmentReport(req, res, next) {
  try {
    const enrollment = await prisma.training_enrollments.findUnique({
      where: { id: req.validated.params.enrollmentId },
      include: { training_cohorts: true },
    });
    if (!enrollment) {
      const { ApiError } = require('../../utils/apiError');
      throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
    }
    return success(
      res,
      await officialReports.getLatestReport(R(req), {
        reportType: REPORT_TYPES.INDIVIDUAL,
        programId: enrollment.training_cohorts.program_id,
        enrollmentId: enrollment.id,
        cohortId: enrollment.cohort_id,
      })
    );
  } catch (e) {
    return next(e);
  }
}

async function downloadEnrollmentReportPdf(req, res, next) {
  try {
    const enrollment = await prisma.training_enrollments.findUnique({
      where: { id: req.validated.params.enrollmentId },
      include: { training_cohorts: true },
    });
    if (!enrollment) {
      const { ApiError } = require('../../utils/apiError');
      throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
    }
    let report;
    try {
      report = await officialReports.getLatestReport(R(req), {
        reportType: REPORT_TYPES.INDIVIDUAL,
        programId: enrollment.training_cohorts.program_id,
        enrollmentId: enrollment.id,
        cohortId: enrollment.cohort_id,
      });
    } catch {
      report = await officialReports.generateOfficialReport(R(req), {
        reportType: REPORT_TYPES.INDIVIDUAL,
        enrollmentId: enrollment.id,
      });
    }
    if (report.legacy) {
      report = await officialReports.generateOfficialReport(R(req), {
        reportType: REPORT_TYPES.INDIVIDUAL,
        enrollmentId: enrollment.id,
      });
    }
    req.validated.params.reportId = report.id;
    return downloadReportPdf(req, res, next);
  } catch (e) {
    return next(e);
  }
}

async function verifyPublicReport(req, res, next) {
  try {
    return success(res, await officialReports.verifyPublicReport(req.validated.params.verificationCode));
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listProgramReports,
  generateProgramReport,
  getProgramReportLatest,
  getReportById,
  getReportStatus,
  downloadReportPdf,
  downloadReportExcel,
  getReportHtml,
  generateCohortReport,
  listCohortReports,
  generateEnrollmentReport,
  getEnrollmentReport,
  downloadEnrollmentReportPdf,
  verifyPublicReport,
};

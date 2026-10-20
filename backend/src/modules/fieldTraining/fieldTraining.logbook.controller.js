'use strict';

const path = require('path');
const logbook = require('./fieldTraining.logbook.service');
const portfolio = require('./fieldTraining.portfolio.service');
const portfolioPdf = require('./fieldTraining.portfolio.pdf');
const smartNotifications = require('./fieldTraining.smartNotifications');
const { success, created } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const repo = require('./fieldTraining.repository');

async function studentList(req, res, next) {
  try {
    const data = await logbook.listStudentEntries(
      req.validated.params.id,
      req.user.userId,
      req.validated.query || {}
    );
    return success(res, data, { message: 'Logbook entries retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function studentCreate(req, res, next) {
  try {
    const data = await logbook.createDraft(
      req.validated.params.id,
      req.user.userId,
      req.validated.body || {},
      req.user.userId
    );
    return created(res, data, { message: 'Logbook draft created' });
  } catch (e) {
    return next(e);
  }
}

async function studentUpdate(req, res, next) {
  try {
    const data = await logbook.updateDraft(
      req.validated.params.entryId,
      req.user.userId,
      req.validated.body || {}
    );
    return success(res, data, { message: 'Logbook draft updated' });
  } catch (e) {
    return next(e);
  }
}

async function studentSubmit(req, res, next) {
  try {
    const data = await logbook.submitEntry(
      req.validated.params.entryId,
      req.user.userId,
      req.user.userId
    );
    return success(res, data, { message: 'Logbook submitted' });
  } catch (e) {
    return next(e);
  }
}

async function studentDelete(req, res, next) {
  try {
    const data = await logbook.softDeleteDraft(
      req.validated.params.entryId,
      req.user.userId,
      req.user.userId
    );
    return success(res, data, { message: 'Logbook draft deleted' });
  } catch (e) {
    return next(e);
  }
}

async function studentAddAttachment(req, res, next) {
  try {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    const data = await logbook.addAttachment(
      req.validated.params.entryId,
      req.user.userId,
      file
    );
    return created(res, data, { message: 'Attachment added' });
  } catch (e) {
    return next(e);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    const file = await logbook.downloadAttachment(req.validated.params.attachmentId, req.user);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
    );
    return res.sendFile(path.resolve(file.absolutePath));
  } catch (e) {
    return next(e);
  }
}

async function staffList(req, res, next) {
  try {
    const data = await logbook.listStaffEntries(
      req.validated.params.id,
      req.validated.query || {},
      req.user
    );
    return success(res, data, { message: 'Staff logbook entries retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function staffApprove(req, res, next) {
  try {
    const data = await logbook.approveEntry(req.validated.params.entryId, req.user);
    return success(res, data, { message: 'Logbook approved' });
  } catch (e) {
    return next(e);
  }
}

async function staffRequestRevision(req, res, next) {
  try {
    const data = await logbook.requestRevision(
      req.validated.params.entryId,
      req.user,
      req.validated.body?.comment || req.validated.body?.revision_comment
    );
    return success(res, data, { message: 'Revision requested' });
  } catch (e) {
    return next(e);
  }
}

async function getPortfolio(req, res, next) {
  try {
    const applicationId = req.validated.params.applicationId;
    const data = await portfolio.getStudentEvidencePortfolio(applicationId, req.user);
    return success(res, data, { message: 'Portfolio retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getStudentPortfolioByOpportunity(req, res, next) {
  try {
    const app = await repo.findApplicationByOpportunityAndStudent(
      req.validated.params.id,
      req.user.userId
    );
    if (!app) throw new ApiError(404, 'طلب التدريب غير موجود');
    const data = await portfolio.getStudentEvidencePortfolio(app.id, req.user);
    return success(res, data, { message: 'Portfolio retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function downloadPortfolioPdf(req, res, next) {
  try {
    let applicationId = req.validated.params.applicationId;
    if (!applicationId && req.validated.params.id) {
      const app = await repo.findApplicationByOpportunityAndStudent(
        req.validated.params.id,
        req.user.userId
      );
      if (!app) throw new ApiError(404, 'طلب التدريب غير موجود');
      applicationId = app.id;
    }
    const { buffer, filename } = await portfolioPdf.generatePortfolioPdf(applicationId, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    return res.send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function runSmartNotifications(req, res, next) {
  try {
    const data = await smartNotifications.evaluateOpportunitySmartNotifications(
      req.validated.params.id,
      { limit: Number(req.validated.query?.limit) || 50 }
    );
    return success(res, data, { message: 'Smart notifications evaluated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  studentList,
  studentCreate,
  studentUpdate,
  studentSubmit,
  studentDelete,
  studentAddAttachment,
  downloadAttachment,
  staffList,
  staffApprove,
  staffRequestRevision,
  getPortfolio,
  getStudentPortfolioByOpportunity,
  downloadPortfolioPdf,
  runSmartNotifications,
};

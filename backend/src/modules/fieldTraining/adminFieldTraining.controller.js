const fieldTrainingService = require('./fieldTraining.service');
const studentsExcelExport = require('./fieldTrainingStudentsExport.service');
const { success, created } = require('../../utils/apiResponse');
const { recordAudit } = require('../../shared/services/audit.service');
const fs = require('fs');

async function list(req, res, next) {
  try {
    const data = await fieldTrainingService.listAdminOpportunities(req.validated.query, req.user);
    return success(res, data, { message: 'Field training opportunities retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function stats(req, res, next) {
  try {
    const data = await fieldTrainingService.getAdminStats(req.validated.query, req.user);
    return success(res, data, { message: 'Field training stats retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await fieldTrainingService.getAdminOpportunityById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Opportunity retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await fieldTrainingService.createAdminOpportunity(
      req.validated.body,
      req.user.userId,
      req.user
    );
    return created(res, data, { message: 'Opportunity created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await fieldTrainingService.updateAdminOpportunity(
      req.validated.params.id,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity updated' });
  } catch (e) {
    return next(e);
  }
}

async function publish(req, res, next) {
  try {
    const data = await fieldTrainingService.publishOpportunity(
      req.validated.params.id,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity published' });
  } catch (e) {
    return next(e);
  }
}

async function archive(req, res, next) {
  try {
    const data = await fieldTrainingService.archiveOpportunity(
      req.validated.params.id,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity archived' });
  } catch (e) {
    return next(e);
  }
}

async function listApplications(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunityApplications(
      req.validated.params.id,
      req.validated.query ?? {},
      req.user
    );
    return success(res, data, { message: 'Applications retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function exportApplicationsExcel(req, res, next) {
  try {
    const file = await studentsExcelExport.exportOpportunityStudentsExcel(
      req.user,
      req.validated.params.id,
      req.validated.query ?? {}
    );
    try {
      await recordAudit({
        userId: req.user?.userId ?? null,
        universityId: file.universityId ?? req.user?.universityId ?? null,
        actionType: 'report.export',
        entityType: 'field_training_report',
        entityId: file.opportunityId ?? req.validated.params.id,
        newValues: {
          type: 'field_training_students_excel',
          university_id: file.universityId ?? null,
          opportunity_id: file.opportunityId ?? req.validated.params.id,
          filters: file.filters ?? null,
          row_count: file.rowCount ?? 0,
        },
        ipAddress: req.ip || null,
      });
    } catch {
      /* export must not fail because audit write failed */
    }
    const payload = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    const raw = String(file.filename || 'download.bin').replace(/[\r\n"]/g, '_');
    const safeAscii = raw.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'download.bin';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(raw)}`
    );
    return res.send(payload);
  } catch (e) {
    return next(e);
  }
}

async function overviewSummary(req, res, next) {
  try {
    const data = await fieldTrainingService.getOpportunityOverviewSummary(
      req.validated.params.id,
      req.user
    );
    return success(res, data, { message: 'Overview summary retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function reviewApplication(req, res, next) {
  try {
    const data = await fieldTrainingService.reviewApplication(
      req.validated.params.applicationId,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Application updated' });
  } catch (e) {
    return next(e);
  }
}

async function listTasks(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunityTasks(req.validated.params.id, {
      user: req.user,
    });
    return success(res, data, { message: 'Tasks retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createTask(req, res, next) {
  try {
    const data = await fieldTrainingService.createOpportunityTask(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'Task created' });
  } catch (e) {
    return next(e);
  }
}

async function updateTask(req, res, next) {
  try {
    const data = await fieldTrainingService.updateOpportunityTask(
      req.validated.params.taskId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Task updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteTask(req, res, next) {
  try {
    const data = await fieldTrainingService.deleteOpportunityTask(req.validated.params.taskId, req.user);
    return success(res, data, { message: 'Task deleted' });
  } catch (e) {
    return next(e);
  }
}

async function listSubmissions(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunitySubmissions(req.validated.params.id, req.user);
    return success(res, data, { message: 'Submissions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getSubmissionDownloadUrl(req, res, next) {
  try {
    const data = await fieldTrainingService.getSubmissionDownloadUrl(
      req.validated.params.submissionId,
      req.user,
      { asAdmin: true }
    );
    return success(res, data, { message: 'Download URL generated' });
  } catch (e) {
    return next(e);
  }
}

async function downloadSubmission(req, res, next) {
  try {
    const result = await fieldTrainingService.downloadSubmissionFile(
      req.validated.params.submissionId,
      req.user,
      { asAdmin: true }
    );
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
    const stream = fs.createReadStream(result.absPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
}

async function reviewSubmission(req, res, next) {
  try {
    const data = await fieldTrainingService.reviewSubmission(
      req.validated.params.submissionId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Submission reviewed' });
  } catch (e) {
    return next(e);
  }
}

async function getTaskInstructionDownloadUrl(req, res, next) {
  try {
    const data = await fieldTrainingService.getTaskInstructionDownloadUrl(
      req.validated.params.taskId,
      req.user,
      { asAdmin: true }
    );
    return success(res, data, { message: 'Instruction download URL generated' });
  } catch (e) {
    return next(e);
  }
}

async function downloadTaskInstruction(req, res, next) {
  try {
    const result = await fieldTrainingService.downloadTaskInstructionFile(
      req.validated.params.taskId,
      req.user,
      { asAdmin: true }
    );
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
    const stream = fs.createReadStream(result.absPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
}

async function eligibilityCatalog(_req, res, next) {
  try {
    const data = await fieldTrainingService.getEligibilityCatalog();
    return success(res, data, { message: 'Eligibility catalog retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listEligibility(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunityEligibility(
      req.validated.params.id,
      req.user
    );
    return success(res, data, { message: 'Eligibility retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  stats,
  eligibilityCatalog,
  listEligibility,
  getById,
  create,
  update,
  publish,
  archive,
  listApplications,
  exportApplicationsExcel,
  overviewSummary,
  reviewApplication,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listSubmissions,
  getSubmissionDownloadUrl,
  downloadSubmission,
  getTaskInstructionDownloadUrl,
  downloadTaskInstruction,
  reviewSubmission,
};

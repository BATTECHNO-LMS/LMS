'use strict';

const multer = require('multer');
const { success } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const service = require('./fieldTrainingEvaluation.service');
const { MAX_TEMPLATE_BYTES } = require('./fieldTrainingEvaluation.constants');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TEMPLATE_BYTES, files: 1 },
});

function sendFile(res, { buffer, filename, mimeType }) {
  const payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const raw = String(filename || 'download.bin').replace(/[\r\n"]/g, '_');
  const safeAscii = raw.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'download.bin';
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(raw)}`);
  res.setHeader('X-Eval-Selected', String(arguments[1]?.summary?.selected || ''));
  return res.send(payload);
}

function handleMulter(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return next(new ApiError(400, 'تعذّر رفع الملف', { reason: err.message }, 'UPLOAD_FAILED'));
    return next();
  });
}

async function listTemplates(req, res, next) {
  try {
    return success(res, await service.listTemplates(req.user, req.validated?.query || req.query));
  } catch (err) {
    return next(err);
  }
}

async function uploadTemplate(req, res, next) {
  try {
    const data = await service.uploadTemplate(req.user, { ...(req.validated?.body || req.body), ...req.body }, req.file);
    return success(res, data, { status: 201, message: 'Template uploaded' });
  } catch (err) {
    return next(err);
  }
}

async function setDefaultTemplate(req, res, next) {
  try {
    return success(res, await service.setDefaultTemplate(req.user, req.validated.params.templateId));
  } catch (err) {
    return next(err);
  }
}

async function previewTemplate(req, res, next) {
  try {
    return success(res, await service.previewTemplate(req.user, req.validated.params.templateId));
  } catch (err) {
    return next(err);
  }
}

async function previewApplication(req, res, next) {
  try {
    return success(res, await service.previewApplicationPayload(req.user, req.validated.params.applicationId));
  } catch (err) {
    return next(err);
  }
}

async function downloadTemplate(req, res, next) {
  try {
    const file = await service.downloadTemplateFile(req.user, req.validated.params.templateId);
    return sendFile(res, file);
  } catch (err) {
    return next(err);
  }
}

async function opportunityTemplate(req, res, next) {
  try {
    return success(res, await service.getOpportunityTemplateState(req.user, req.validated.params.id));
  } catch (err) {
    return next(err);
  }
}

async function assignOpportunityTemplate(req, res, next) {
  try {
    const templateId = req.validated.body.template_id || null;
    return success(res, await service.assignOpportunityTemplate(req.user, req.validated.params.id, templateId));
  } catch (err) {
    return next(err);
  }
}

async function useUniversityDefault(req, res, next) {
  try {
    return success(res, await service.assignOpportunityTemplate(req.user, req.validated.params.id, null));
  } catch (err) {
    return next(err);
  }
}

async function getPolicy(req, res, next) {
  try {
    return success(res, await service.getPolicy(req.user, req.validated?.query?.university_id || req.query.university_id));
  } catch (err) {
    return next(err);
  }
}

async function upsertPolicy(req, res, next) {
  try {
    const body = req.validated.body;
    return success(res, await service.upsertPolicy(req.user, body.university_id, body));
  } catch (err) {
    return next(err);
  }
}

async function listRatings(req, res, next) {
  try {
    return success(res, await service.listSupervisorRatings(req.user, req.validated.params.applicationId));
  } catch (err) {
    return next(err);
  }
}

async function saveRating(req, res, next) {
  try {
    return success(res, await service.saveSupervisorRating(req.user, req.validated.params.applicationId, req.validated.body), {
      status: 201,
    });
  } catch (err) {
    return next(err);
  }
}

async function listReports(req, res, next) {
  try {
    return success(res, await service.listFinalReports(req.user, req.validated.query));
  } catch (err) {
    return next(err);
  }
}

async function generateReports(req, res, next) {
  try {
    const body = req.validated.body;
    const data = await service.generateForApplications(req.user, body.application_ids, {
      regenerate: Boolean(body.regenerate),
      regenerationReason: body.regeneration_reason,
    });
    return success(res, data, { message: 'Evaluation reports processed' });
  } catch (err) {
    return next(err);
  }
}

async function generateOne(req, res, next) {
  try {
    const data = await service.generateOne(req.user, req.validated.params.applicationId, {
      regenerate: false,
    });
    return success(res, data, { message: 'Evaluation generated' });
  } catch (err) {
    return next(err);
  }
}

async function generateOpportunity(req, res, next) {
  try {
    const data = await service.generateForOpportunity(req.user, req.validated.params.id);
    return success(res, data, { message: 'Evaluation reports processed' });
  } catch (err) {
    return next(err);
  }
}

async function regenerate(req, res, next) {
  try {
    const row = await service.getEvaluation(req.user, req.validated.params.evaluationId);
    const data = await service.generateOne(req.user, row.application_id, {
      regenerate: true,
      regenerationReason: req.validated.body?.regeneration_reason || 'manual_regenerate',
    });
    return success(res, data);
  } catch (err) {
    return next(err);
  }
}

async function downloadReport(req, res, next) {
  try {
    const file = await service.downloadPdf(req.user, req.validated.params.evaluationId);
    return sendFile(res, file);
  } catch (err) {
    return next(err);
  }
}

async function updateComments(req, res, next) {
  try {
    return success(res, await service.updateComments(req.user, req.validated.params.evaluationId, req.validated.body.general_comments));
  } catch (err) {
    return next(err);
  }
}

async function bulkZip(req, res, next) {
  try {
    const body = req.validated.body || {};
    const result = await service.bulkZip(req.user, {
      evaluationIds: body.evaluation_ids || [],
      applicationIds: body.application_ids || [],
      query: {
        university_id: body.university_id,
        opportunity_id: body.opportunity_id,
        final_status: body.final_status,
        academic_year: body.academic_year,
        student_name: body.student_name,
        university_number: body.university_number,
        from: body.from,
        to: body.to,
        generated: 'yes',
      },
    });
    res.setHeader('X-Zip-Selected', String(result.summary.selected));
    res.setHeader('X-Zip-Included', String(result.summary.included));
    res.setHeader('X-Zip-Missing', String(result.summary.missing));
    res.setHeader('X-Zip-Failed', String(result.summary.failed));
    return sendFile(res, { buffer: result.buffer, filename: result.filename, mimeType: 'application/zip', summary: result.summary });
  } catch (err) {
    return next(err);
  }
}

async function listSupervisorGroups(req, res, next) {
  try {
    const supervisorReports = require('./fieldTraining.supervisorReports.service');
    return success(res, await supervisorReports.listSupervisorGroups(req.user, req.validated.query || {}));
  } catch (err) {
    return next(err);
  }
}

async function zipSupervisorReports(req, res, next) {
  try {
    const supervisorReports = require('./fieldTraining.supervisorReports.service');
    const result = await supervisorReports.zipSupervisorReports(req.user, req.validated.body || {});
    res.setHeader('X-Zip-Selected', String(result.summary.selected));
    res.setHeader('X-Zip-Included', String(result.summary.included));
    res.setHeader('X-Zip-Missing', String(result.summary.missing));
    res.setHeader('X-Zip-Failed', String(result.summary.failed));
    res.setHeader('X-Zip-Skipped', String(result.summary.skipped?.length || 0));
    return sendFile(res, {
      buffer: result.buffer,
      filename: result.filename,
      mimeType: 'application/zip',
      summary: result.summary,
    });
  } catch (err) {
    return next(err);
  }
}

async function studentDownload(req, res, next) {
  try {
    const file = await service.studentOwnPdf(req.user, req.validated.params.applicationId);
    return sendFile(res, file);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  handleMulter,
  listTemplates,
  uploadTemplate,
  setDefaultTemplate,
  previewTemplate,
  previewApplication,
  downloadTemplate,
  opportunityTemplate,
  assignOpportunityTemplate,
  useUniversityDefault,
  getPolicy,
  upsertPolicy,
  listRatings,
  saveRating,
  listReports,
  generateReports,
  generateOne,
  generateOpportunity,
  regenerate,
  downloadReport,
  updateComments,
  bulkZip,
  listSupervisorGroups,
  zipSupervisorReports,
  studentDownload,
};

'use strict';

const { success } = require('../../utils/apiResponse');
const letterService = require('./fieldTraining.completionLetter.service');
const supervisorService = require('./fieldTraining.supervisorExcel.service');
const { ApiError } = require('../../utils/apiError');
const parse = require('./fieldTraining.supervisorExcel.parse');
const multer = require('multer');

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parse.MAX_EXCEL_BYTES, files: 1 },
});

function parseResolutions(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function handleExcelMulter(req, res, next) {
  excelUpload.single('file')(req, res, (err) => {
    if (err) return next(new ApiError(400, 'تعذّر رفع ملف Excel', { reason: err.message }, 'UPLOAD_FAILED'));
    return next();
  });
}

async function listCompletionLetters(req, res, next) {
  try {
    return success(
      res,
      await letterService.listCompletionLetters(req.validated.params.id, req.user, req.validated.query || {})
    );
  } catch (err) {
    return next(err);
  }
}

async function previewBulkIssue(req, res, next) {
  try {
    return success(
      res,
      await letterService.previewBulkIssue(req.validated.params.id, req.user, req.validated.body || {})
    );
  } catch (err) {
    return next(err);
  }
}

async function startBulkIssue(req, res, next) {
  try {
    const data = await letterService.startBulkIssue(req.validated.params.id, req.user, {
      retryFailedIds: req.validated.body?.retry_failed_ids || [],
    });
    return success(res, data, { message: 'بدأ إصدار الكتب' });
  } catch (err) {
    return next(err);
  }
}

async function getBulkIssueJob(req, res, next) {
  try {
    return success(
      res,
      await letterService.getJob(req.validated.params.id, req.validated.params.jobId, req.user)
    );
  } catch (err) {
    return next(err);
  }
}

async function retryBulkIssueJob(req, res, next) {
  try {
    return success(
      res,
      await letterService.retryFailedJob(req.validated.params.id, req.validated.params.jobId, req.user),
      { message: 'تمت إعادة محاولة السجلات الفاشلة' }
    );
  } catch (err) {
    return next(err);
  }
}

async function downloadIssuedZip(req, res, next) {
  try {
    const file = await letterService.downloadIssuedZip(req.validated.params.id, req.user);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', file.contentDisposition);
    res.setHeader('X-Zip-Selected', String(file.summary.selected));
    res.setHeader('X-Zip-Included', String(file.summary.included));
    res.setHeader('X-Zip-Failed', String(file.summary.failed));
    res.setHeader('X-Zip-Unissued', String(file.summary.unissued));
    file.stream.on('error', (err) => next(err));
    return file.stream.pipe(res);
  } catch (err) {
    return next(err);
  }
}

async function previewSupervisorImport(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'يرجى اختيار ملف Excel');
    const data = await supervisorService.previewImport(req.validated.params.id, req.user, req.file, {
      resolutions: parseResolutions(req.body?.resolutions),
    });
    return success(res, data, { message: 'تمت معاينة التوزيع' });
  } catch (err) {
    return next(err);
  }
}

async function resolveSupervisorImport(req, res, next) {
  try {
    return success(
      res,
      await supervisorService.applyResolutions(req.validated.params.id, req.user, req.validated.body)
    );
  } catch (err) {
    return next(err);
  }
}

async function applySupervisorImport(req, res, next) {
  try {
    return success(
      res,
      await supervisorService.applyImport(req.validated.params.id, req.user, req.validated.body),
      { message: 'تم اعتماد توزيع المشرفين' }
    );
  } catch (err) {
    return next(err);
  }
}

async function updateAcademicSupervisorName(req, res, next) {
  try {
    return success(
      res,
      await supervisorService.updateEnrollmentSupervisorName(
        req.validated.params.applicationId,
        req.user,
        req.validated.body
      ),
      { message: 'تم تحديث اسم المشرف الأكاديمي' }
    );
  } catch (err) {
    return next(err);
  }
}

async function listAcademicSupervisors(req, res, next) {
  try {
    return success(res, await supervisorService.listAcademicSupervisors(req.validated.params.id, req.user));
  } catch (err) {
    return next(err);
  }
}

async function downloadSupervisorTemplate(req, res, next) {
  try {
    const file = await supervisorService.downloadTemplate(req.validated.params.id, req.user);
    const { contentDispositionAttachment } = require('./fieldTraining.completionLetter.filename');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(file.filename));
    return res.send(file.buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  handleExcelMulter,
  listCompletionLetters,
  previewBulkIssue,
  startBulkIssue,
  getBulkIssueJob,
  retryBulkIssueJob,
  downloadIssuedZip,
  previewSupervisorImport,
  resolveSupervisorImport,
  applySupervisorImport,
  updateAcademicSupervisorName,
  listAcademicSupervisors,
  downloadSupervisorTemplate,
};

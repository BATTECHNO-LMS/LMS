const multer = require('multer');
const { ApiError } = require('../../utils/apiError');
const { MAX_GENERAL_BYTES, isAllowedMimeType } = require('../../shared/storage/fileRules');
const { isAllowedSubmissionFile } = require('../fieldTraining/fieldTraining.submissionFileRules');

function isAcceptedUploadFile(file) {
  const mime = String(file.mimetype || '').trim().toLowerCase();
  if (isAllowedMimeType(mime)) return true;
  const check = isAllowedSubmissionFile({
    fileName: file.originalname,
    mimeType: mime || 'application/octet-stream',
    size: 1,
  });
  return check.valid;
}

const uploadDirectFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_GENERAL_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAcceptedUploadFile(file)) {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
}).single('file');

function handleDirectUpload(req, res, next) {
  uploadDirectFile(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'حجم الملف يتجاوز الحد المسموح', null, 'FILE_TOO_LARGE'));
    }
    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      return next(new ApiError(400, 'نوع الملف غير مدعوم', null, 'FILE_VALIDATION_ERROR'));
    }
    return next(new ApiError(400, 'تعذّر رفع الملف', { reason: err.message }, 'UPLOAD_FAILED'));
  });
}

module.exports = { handleDirectUpload };

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { env } = require('../../config/env');
const {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
  isAllowedSubmissionFile,
  isBlockedExtension,
} = require('./fieldTraining.submissionFileRules');

const MAX_BYTES = MAX_FILE_BYTES;
const INSTRUCTION_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const INSTRUCTION_MIME = new Set([
  ...ALLOWED_MIME,
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const taskId = req.validated?.params?.taskId || req.params.taskId || 'unknown';
    const dir = path.join(env.UPLOAD_DIR || 'uploads', 'field-training', taskId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '') || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (isBlockedExtension(file.originalname)) {
    cb(new Error('UNSUPPORTED_FILE_TYPE'));
    return;
  }
  const check = isAllowedSubmissionFile({
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: 1,
  });
  if (check.valid || ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('UNSUPPORTED_FILE_TYPE'));
}

const uploadTaskFile = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: MAX_FILES_PER_SUBMISSION },
  fileFilter,
}).array('files', MAX_FILES_PER_SUBMISSION);

const uploadTaskFileSingle = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter,
}).single('file');

function handleTaskUpload(req, res, next) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  uploadTaskFile(req, res, (err) => {
    if (err && (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message === 'Unexpected field')) {
      return uploadTaskFileSingle(req, res, (err2) => mapUploadError(err2, next));
    }
    return mapUploadError(err, next);
  });
}

function mapUploadError(err, next) {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return next(Object.assign(new Error('FILE_TOO_LARGE'), { statusCode: 400 }));
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return next(Object.assign(new Error('TOO_MANY_FILES'), { statusCode: 400 }));
  }
  if (err.message === 'UNSUPPORTED_FILE_TYPE') {
    return next(Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { statusCode: 400 }));
  }
  return next(err);
}

module.exports = {
  handleTaskUpload,
  MAX_BYTES,
  INSTRUCTION_MAX_BYTES,
  ALLOWED_MIME,
  INSTRUCTION_MIME,
  MAX_FILES_PER_SUBMISSION,
};

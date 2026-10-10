'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../../utils/apiError');
const { MAX_FILE_BYTES, ERROR_MESSAGES } = require('./taskSubmissionFileRules');

const TMP_DIR = path.join(os.tmpdir(), 'lms-task-submission-uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      fs.mkdir(TMP_DIR, { recursive: true }, (err) => cb(err, TMP_DIR));
    },
    filename(_req, _file, cb) {
      cb(null, `${Date.now()}-${crypto.randomUUID()}.part`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10, fieldSize: 64 * 1024 },
}).single('file');

/** Multer wrapper that maps every failure to a safe Arabic message (no internal details). */
function handleTaskSubmissionUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(new ApiError(400, ERROR_MESSAGES.FILE_REQUIRED, null, 'FILE_REQUIRED'));
      return next();
    }
    if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => null);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(413, ERROR_MESSAGES.FILE_TOO_LARGE, null, 'FILE_TOO_LARGE'));
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new ApiError(400, 'يرجى رفع ملف واحد في كل طلب.', null, 'UPLOAD_FAILED'));
    }
    return next(new ApiError(400, ERROR_MESSAGES.UPLOAD_FAILED, null, 'UPLOAD_FAILED'));
  });
}

module.exports = { handleTaskSubmissionUpload, TMP_DIR };

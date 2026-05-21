const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { env } = require('../../config/env');

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf']);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const lessonId = req.validated?.params?.lessonId || req.params.lessonId || 'unknown';
    const dir = path.join(env.UPLOAD_DIR || 'uploads', 'lesson-training', lessonId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.pdf';
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('UNSUPPORTED_FILE_TYPE'));
}

const uploadLessonSubmission = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter,
}).single('file');

function handleLessonSubmissionUpload(req, res, next) {
  uploadLessonSubmission(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(Object.assign(new Error('FILE_TOO_LARGE'), { statusCode: 400 }));
    }
    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      return next(Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { statusCode: 400 }));
    }
    return next(err);
  });
}

module.exports = { handleLessonSubmissionUpload, MAX_BYTES };

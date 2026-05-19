const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/apiError');

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(env.UPLOAD_DIR || 'uploads', 'courses', 'covers');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
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

const uploadCover = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter,
}).single('file');

function handleCoverUpload(req, res, next) {
  uploadCover(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'حجم الصورة يتجاوز 4 ميجابايت'));
    }
    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      return next(new ApiError(400, 'نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP'));
    }
    return next(err);
  });
}

module.exports = { handleCoverUpload, MAX_BYTES, ALLOWED_MIME };

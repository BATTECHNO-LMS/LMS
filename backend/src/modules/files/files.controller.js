const filesService = require('./files.service');
const { success } = require('../../utils/apiResponse');

async function presignUpload(req, res, next) {
  try {
    const data = await filesService.presignUpload(req.validated.body, req.user);
    return success(res, data, { message: 'Presigned upload URL created' });
  } catch (e) {
    return next(e);
  }
}

async function confirmUpload(req, res, next) {
  try {
    const data = await filesService.confirmUpload(req.validated.body, req.user);
    return success(res, data, { message: 'Upload confirmed' });
  } catch (e) {
    return next(e);
  }
}

async function downloadUrl(req, res, next) {
  try {
    const data = await filesService.getDownloadUrl(req.validated.params.id, req.user);
    return success(res, data, { message: 'Download URL generated' });
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const data = await filesService.deleteFile(req.validated.params.id, req.user);
    return success(res, data, { message: 'File deleted' });
  } catch (e) {
    return next(e);
  }
}

async function health(req, res, next) {
  try {
    const data = await filesService.checkStorageHealth();
    const status = data.ok ? 200 : 503;
    return res.status(status).json({ success: data.ok, data });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  presignUpload,
  confirmUpload,
  downloadUrl,
  remove,
  health,
};

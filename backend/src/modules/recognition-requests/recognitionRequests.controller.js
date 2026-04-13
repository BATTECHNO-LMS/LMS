const recognitionRequestsService = require('./recognitionRequests.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await recognitionRequestsService.listRecognitionRequests(req.validated.query, req.user);
    return success(res, data, { message: 'Recognition requests retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await recognitionRequestsService.getRecognitionRequestById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Recognition request retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await recognitionRequestsService.createRecognitionRequest(req.validated.body, req.user);
    return created(res, data, { message: 'Recognition request created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await recognitionRequestsService.updateRecognitionRequest(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Recognition request updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await recognitionRequestsService.patchRecognitionStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Recognition request status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

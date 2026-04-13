const recognitionDocumentsService = require('./recognitionDocuments.service');
const { success, created } = require('../../utils/apiResponse');

async function listForRequest(req, res, next) {
  try {
    const data = await recognitionDocumentsService.listForRequest(req.validated.params.id, req.user);
    return success(res, data, { message: 'Recognition documents retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForRequest(req, res, next) {
  try {
    const data = await recognitionDocumentsService.createForRequest(req.validated.params.id, req.validated.body, req.user);
    return created(res, data, { message: 'Recognition document created' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await recognitionDocumentsService.getDocumentById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Recognition document retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await recognitionDocumentsService.updateDocument(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Recognition document updated' });
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const data = await recognitionDocumentsService.deleteDocument(req.validated.params.id, req.user);
    return success(res, data, { message: 'Recognition document deleted' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listForRequest, createForRequest, getById, update, remove };

const recognitionDocumentsService = require('./recognitionDocuments.service');
const { recordAudit } = require('../../utils/auditRecorder');
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
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? null,
      actionType: 'recognition_document.create',
      entityType: 'recognition_document',
      entityId: data.recognition_document.id,
      newValues: {
        recognition_request_id: data.recognition_document.recognition_request_id,
        document_type: data.recognition_document.document_type,
      },
      ipAddress: req.ip || null,
    });
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
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? null,
      actionType: 'recognition_document.update',
      entityType: 'recognition_document',
      entityId: req.validated.params.id,
      newValues: {
        document_type: data.recognition_document.document_type,
        title: data.recognition_document.title,
      },
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'Recognition document updated' });
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    const data = await recognitionDocumentsService.deleteDocument(req.validated.params.id, req.user);
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? null,
      actionType: 'recognition_document.delete',
      entityType: 'recognition_document',
      entityId: req.validated.params.id,
      newValues: { deleted: true },
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'Recognition document deleted' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listForRequest, createForRequest, getById, update, remove };

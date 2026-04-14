const recognitionRequestsService = require('./recognitionRequests.service');
const { dispatchAppEvent } = require('../../shared/services/eventDispatcher.service');
const { recordAudit } = require('../../shared/services/audit.service');
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
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? data.recognition_request.university_id ?? null,
      actionType: 'recognition_request.create',
      entityType: 'recognition_request',
      entityId: data.recognition_request.id,
      newValues: {
        status: data.recognition_request.status,
        cohort_id: data.recognition_request.cohort_id,
        micro_credential_id: data.recognition_request.micro_credential_id,
      },
      ipAddress: req.ip || null,
    });
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
    await dispatchAppEvent('recognition_request_status_changed', {
      request: data.recognition_request,
      actor: req.user,
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'Recognition request status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

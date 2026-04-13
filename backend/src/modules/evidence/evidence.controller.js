const evidenceService = require('./evidence.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await evidenceService.listEvidence(req.validated.query, req.user);
    return success(res, data, { message: 'Evidence retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await evidenceService.getEvidenceById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Evidence retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await evidenceService.createEvidence(req.validated.body, req.user);
    return created(res, data, { message: 'Evidence created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await evidenceService.updateEvidence(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Evidence updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update };

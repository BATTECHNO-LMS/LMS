const integrityCasesService = require('./integrityCases.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await integrityCasesService.listIntegrityCases(req.validated.query, req.user);
    return success(res, data, { message: 'Integrity cases retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await integrityCasesService.getIntegrityCaseById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Integrity case retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await integrityCasesService.createIntegrityCase(req.validated.body, req.user);
    return created(res, data, { message: 'Integrity case created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await integrityCasesService.updateIntegrityCase(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Integrity case updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await integrityCasesService.patchIntegrityCaseStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Integrity case status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

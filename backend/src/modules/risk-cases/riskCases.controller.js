const riskCasesService = require('./riskCases.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await riskCasesService.listRiskCases(req.validated.query, req.user);
    return success(res, data, { message: 'Risk cases retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await riskCasesService.getRiskCaseById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Risk case retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await riskCasesService.createRiskCase(req.validated.body, req.user);
    return created(res, data, { message: 'Risk case created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await riskCasesService.updateRiskCase(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Risk case updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await riskCasesService.patchRiskCaseStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Risk case status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

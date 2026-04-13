const correctiveActionsService = require('./correctiveActions.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await correctiveActionsService.listCorrectiveActions(req.validated.query, req.user);
    return success(res, data, { message: 'Corrective actions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await correctiveActionsService.getCorrectiveById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Corrective action retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await correctiveActionsService.createCorrectiveAction(req.validated.body, req.user);
    return created(res, data, { message: 'Corrective action created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await correctiveActionsService.updateCorrectiveAction(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Corrective action updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await correctiveActionsService.patchCorrectiveStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Corrective action status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };

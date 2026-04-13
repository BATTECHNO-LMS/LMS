const microCredentialsService = require('./microCredentials.service');
const learningOutcomesService = require('../learning-outcomes/learningOutcomes.service');
const { success, created } = require('../../utils/apiResponse');

function requester(req) {
  return {
    isGlobal: Boolean(req.user?.isGlobal),
    universityId: req.user?.universityId ?? null,
  };
}

async function list(req, res, next) {
  try {
    const data = await microCredentialsService.listMicroCredentials(req.validated.query, requester(req));
    return success(res, data, { message: 'Micro-credentials retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await microCredentialsService.getMicroCredentialById(req.validated.params.id, requester(req));
    return success(res, data, { message: 'Micro-credential retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await microCredentialsService.createMicroCredential(req.validated.body, requester(req));
    return created(res, data, { message: 'Micro-credential created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await microCredentialsService.updateMicroCredential(
      req.validated.params.id,
      req.validated.body,
      requester(req)
    );
    return success(res, data, { message: 'Micro-credential updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await microCredentialsService.patchMicroCredentialStatus(
      req.validated.params.id,
      req.validated.body,
      requester(req)
    );
    return success(res, data, { message: 'Micro-credential status updated' });
  } catch (e) {
    return next(e);
  }
}

async function listLearningOutcomes(req, res, next) {
  try {
    const data = await learningOutcomesService.listByMicroCredentialId(
      req.validated.params.microCredentialId,
      requester(req)
    );
    return success(res, data, { message: 'Learning outcomes retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createLearningOutcome(req, res, next) {
  try {
    const data = await learningOutcomesService.createForMicroCredential(
      req.validated.params.microCredentialId,
      req.validated.body,
      requester(req)
    );
    return created(res, data, { message: 'Learning outcome created' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  patchStatus,
  listLearningOutcomes,
  createLearningOutcome,
};

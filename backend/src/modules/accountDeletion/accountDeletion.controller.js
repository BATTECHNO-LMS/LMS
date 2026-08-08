'use strict';

const accountDeletionService = require('./accountDeletion.service');
const { success, created } = require('../../utils/apiResponse');

function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || null;
}

async function getMine(req, res, next) {
  try {
    const data = await accountDeletionService.getMyDeletionRequest(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function createMine(req, res, next) {
  try {
    const data = await accountDeletionService.createMyDeletionRequest(
      req.user,
      req.validated.body,
      { ipAddress: clientIp(req) }
    );
    return created(res, data, { message: data.message });
  } catch (e) {
    return next(e);
  }
}

async function cancelMine(req, res, next) {
  try {
    const data = await accountDeletionService.cancelMyDeletionRequest(req.user, {
      ipAddress: clientIp(req),
    });
    return success(res, data, { message: 'Deletion request cancelled' });
  } catch (e) {
    return next(e);
  }
}

async function listAdmin(req, res, next) {
  try {
    const data = await accountDeletionService.listDeletionRequestsForAdmin(
      req.user,
      req.query || {}
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function processAdmin(req, res, next) {
  try {
    const data = await accountDeletionService.processDeletionRequest(
      req.user,
      req.params.id,
      req.validated.body,
      { ipAddress: clientIp(req) }
    );
    return success(res, data, { message: 'Deletion request updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getMine,
  createMine,
  cancelMine,
  listAdmin,
  processAdmin,
};

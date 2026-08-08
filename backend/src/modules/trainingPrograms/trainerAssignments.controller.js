'use strict';

const service = require('./trainerAssignments.service');
const { success, created } = require('../../utils/apiResponse');

function requester(req) {
  return req.user;
}

async function dashboard(req, res, next) {
  try {
    return success(res, await service.getTrainerDashboard(requester(req)));
  } catch (e) {
    return next(e);
  }
}

async function listMyCourses(req, res, next) {
  try {
    return success(res, await service.listTrainerCourses(requester(req)));
  } catch (e) {
    return next(e);
  }
}

async function getCourse(req, res, next) {
  try {
    return success(
      res,
      await service.getTrainerCourse(requester(req), req.validated.params.programId)
    );
  } catch (e) {
    return next(e);
  }
}

async function createTrainer(req, res, next) {
  try {
    const data = await service.createTrainerUser(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function assignToCourse(req, res, next) {
  try {
    const data = await service.assignTrainerToCourse(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function revokeAssignment(req, res, next) {
  try {
    const data = await service.revokeTrainerAssignment(
      requester(req),
      req.validated.params.organizationId,
      req.validated.params.assignmentId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listOrgAssignments(req, res, next) {
  try {
    const data = await service.listOrganizationTrainerAssignments(
      requester(req),
      req.validated.params.organizationId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  dashboard,
  listMyCourses,
  getCourse,
  createTrainer,
  assignToCourse,
  revokeAssignment,
  listOrgAssignments,
};

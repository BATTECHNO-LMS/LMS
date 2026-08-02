'use strict';

const organizationsService = require('./organizations.service');
const { success, created } = require('../../utils/apiResponse');

function requester(req) {
  return req.user;
}

async function list(req, res, next) {
  try {
    const type = req.query?.type;
    const data = await organizationsService.listOrganizations(requester(req), { type });
    return success(res, data, { message: 'Organizations retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listPublicInstitutions(req, res, next) {
  try {
    const data = await organizationsService.listPublicInstitutions();
    return success(res, data, { message: 'Institutions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listPublicBranches(req, res, next) {
  try {
    const data = await organizationsService.listPublicBranches(req.validated.params.organizationId);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listPublicDepartments(req, res, next) {
  try {
    const data = await organizationsService.listPublicDepartments(
      req.validated.params.organizationId,
      req.query?.branchId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await organizationsService.getOrganizationById(requester(req), req.validated.params.id);
    return success(res, data, { message: 'Organization retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createInstitution(req, res, next) {
  try {
    const data = await organizationsService.createInstitution(requester(req), req.validated.body);
    return created(res, data, { message: 'Institution created' });
  } catch (e) {
    return next(e);
  }
}

async function updateInstitution(req, res, next) {
  try {
    const data = await organizationsService.updateInstitution(
      requester(req),
      req.validated.params.id,
      req.validated.body
    );
    return success(res, data, { message: 'Institution updated' });
  } catch (e) {
    return next(e);
  }
}

async function listBranches(req, res, next) {
  try {
    const data = await organizationsService.listBranches(
      requester(req),
      req.validated.params.organizationId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function createBranch(req, res, next) {
  try {
    const data = await organizationsService.createBranch(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function updateBranch(req, res, next) {
  try {
    const data = await organizationsService.updateBranch(
      requester(req),
      req.validated.params.organizationId,
      req.validated.params.branchId,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listDepartments(req, res, next) {
  try {
    const data = await organizationsService.listDepartments(
      requester(req),
      req.validated.params.organizationId,
      req.query?.branchId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function createDepartment(req, res, next) {
  try {
    const data = await organizationsService.createDepartment(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function assignUser(req, res, next) {
  try {
    const data = await organizationsService.assignUser(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function listMembers(req, res, next) {
  try {
    const data = await organizationsService.listMembers(
      requester(req),
      req.validated.params.organizationId,
      req.validated.query || {}
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function verifyMemberEmail(req, res, next) {
  try {
    const data = await organizationsService.verifyMemberEmail(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return success(res, data, { message: 'Email verified' });
  } catch (e) {
    return next(e);
  }
}

async function changeMemberActivation(req, res, next) {
  try {
    const data = await organizationsService.changeMemberActivation(
      requester(req),
      req.validated.params.organizationId,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function dashboardSummary(req, res, next) {
  try {
    const data = await organizationsService.getDashboardSummary(
      requester(req),
      req.validated.params.organizationId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  listPublicInstitutions,
  listPublicBranches,
  listPublicDepartments,
  getById,
  createInstitution,
  updateInstitution,
  listBranches,
  createBranch,
  updateBranch,
  listDepartments,
  createDepartment,
  assignUser,
  listMembers,
  verifyMemberEmail,
  changeMemberActivation,
  dashboardSummary,
};

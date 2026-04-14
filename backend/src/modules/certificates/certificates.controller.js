const certificatesService = require('./certificates.service');
const { dispatchAppEvent } = require('../../shared/services/eventDispatcher.service');
const { success, created } = require('../../utils/apiResponse');

async function verify(req, res, next) {
  try {
    const code = req.validated.params.verificationCode;
    const data = await certificatesService.verifyByCode(code);
    return success(res, data, { message: 'Verification result' });
  } catch (e) {
    return next(e);
  }
}

async function list(req, res, next) {
  try {
    const data = await certificatesService.listCertificates(req.validated.query, req.user);
    return success(res, data, { message: 'Certificates retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await certificatesService.getCertificateById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Certificate retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await certificatesService.createCertificate(req.validated.body, req.user);
    await dispatchAppEvent('certificate_issued', {
      certificate: data.certificate,
      actor: req.user,
      ipAddress: req.ip || null,
    });
    return created(res, data, { message: 'Certificate issued' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await certificatesService.patchCertificateStatus(req.validated.params.id, req.validated.body, req.user);
    await dispatchAppEvent('certificate_status_changed', {
      certificate: data.certificate,
      actor: req.user,
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'Certificate status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { verify, list, getById, create, patchStatus };

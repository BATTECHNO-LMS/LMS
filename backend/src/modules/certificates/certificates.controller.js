const certificatesService = require('./certificates.service');
const { recordAudit } = require('../../utils/auditRecorder');
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
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? null,
      actionType: 'certificate.issue',
      entityType: 'certificate',
      entityId: data.certificate.id,
      newValues: { certificate_no: data.certificate.certificate_no, student_id: data.certificate.student_id },
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
    await recordAudit({
      userId: req.user.userId,
      universityId: req.user.universityId ?? null,
      actionType: 'certificate.status',
      entityType: 'certificate',
      entityId: req.validated.params.id,
      newValues: { status: data.certificate.status },
      ipAddress: req.ip || null,
    });
    return success(res, data, { message: 'Certificate status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { verify, list, getById, create, patchStatus };

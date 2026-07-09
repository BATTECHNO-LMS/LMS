const reportService = require('./fieldTrainingReport.service');
const { success } = require('../../utils/apiResponse');
const { recordAudit } = require('../../shared/services/audit.service');

async function auditReport(req, action, entityId, summary) {
  await recordAudit({
    userId: req.user?.userId ?? null,
    universityId: req.user?.universityId ?? null,
    actionType: action,
    entityType: 'field_training_report',
    entityId,
    newValues: summary,
    ipAddress: req.ip || null,
  });
}

function sendExport(res, { buffer, contentType, filename }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
}

async function dashboard(req, res, next) {
  try {
    const data = await reportService.getDashboard(req.user, req.validated.query);
    await auditReport(req, 'report.read', null, { type: 'field_training_dashboard', university_id: data.university_id });
    return success(res, data, { message: 'Field training dashboard loaded' });
  } catch (e) {
    return next(e);
  }
}

async function globalReport(req, res, next) {
  try {
    const data = await reportService.getGlobalReport(req.user, req.validated.query);
    await auditReport(req, 'report.read', null, { type: 'field_training_global' });
    return success(res, data, { message: 'Global field training report generated' });
  } catch (e) {
    return next(e);
  }
}

async function exportGlobalPdf(req, res, next) {
  try {
    const file = await reportService.exportGlobalReport(req.user, req.validated.query, 'pdf');
    await auditReport(req, 'report.export', null, { type: 'field_training_global', format: 'pdf' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function exportGlobalExcel(req, res, next) {
  try {
    const file = await reportService.exportGlobalReport(req.user, req.validated.query, 'xlsx');
    await auditReport(req, 'report.export', null, { type: 'field_training_global', format: 'xlsx' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function universityReport(req, res, next) {
  try {
    const data = await reportService.getUniversityReport(req.user, req.validated.query);
    await auditReport(req, 'report.read', data.university?.id ?? null, { type: 'field_training_university' });
    return success(res, data, { message: 'University field training report generated' });
  } catch (e) {
    return next(e);
  }
}

async function studentsList(req, res, next) {
  try {
    const data = await reportService.listUniversityApplications(req.user, req.validated.query);
    await auditReport(req, 'report.read', data.university?.id ?? null, { type: 'field_training_students' });
    return success(res, data, { message: 'Field training students loaded' });
  } catch (e) {
    return next(e);
  }
}

async function studentReport(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const data = await reportService.getStudentReport(req.user, applicationId);
    await auditReport(req, 'report.read', applicationId, { type: 'field_training_student' });
    return success(res, data, { message: 'Student field training report generated' });
  } catch (e) {
    return next(e);
  }
}

async function exportUniversityPdf(req, res, next) {
  try {
    const file = await reportService.exportUniversityReport(req.user, req.validated.query, 'pdf');
    await auditReport(req, 'report.export', req.validated.query.university_id ?? null, { type: 'field_training_university', format: 'pdf' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function exportUniversityExcel(req, res, next) {
  try {
    const file = await reportService.exportUniversityReport(req.user, req.validated.query, 'xlsx');
    await auditReport(req, 'report.export', req.validated.query.university_id ?? null, { type: 'field_training_university', format: 'xlsx' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function exportStudentPdf(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const file = await reportService.exportStudentReport(req.user, applicationId, 'pdf');
    await auditReport(req, 'report.export', applicationId, { type: 'field_training_student', format: 'pdf' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function exportStudentExcel(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const file = await reportService.exportStudentReport(req.user, applicationId, 'xlsx');
    await auditReport(req, 'report.export', applicationId, { type: 'field_training_student', format: 'xlsx' });
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function academicUniversityReport(req, res, next) {
  try {
    const data = await reportService.getAcademicUniversityReport(req.user, req.validated.query);
    await auditReport(req, 'report.read', data.university?.id ?? null, { type: 'academic_field_training_university' });
    return success(res, data, { message: 'University field training report generated' });
  } catch (e) {
    return next(e);
  }
}

async function academicStudentsList(req, res, next) {
  try {
    const data = await reportService.listAcademicStudents(req.user, req.validated.query);
    await auditReport(req, 'report.read', data.university?.id ?? null, { type: 'academic_field_training_students' });
    return success(res, data, { message: 'Field training students loaded' });
  } catch (e) {
    return next(e);
  }
}

async function academicStudentReport(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const scoped = reportService.withAcademicUniversity(req.user, {});
    await reportService.getUniversityReport(req.user, scoped);
    const data = await reportService.getStudentReport(req.user, applicationId);
    await auditReport(req, 'report.read', applicationId, { type: 'academic_field_training_student' });
    return success(res, data, { message: 'Student field training report generated' });
  } catch (e) {
    return next(e);
  }
}

async function academicExportUniversityPdf(req, res, next) {
  try {
    const query = reportService.withAcademicUniversity(req.user, req.validated.query);
    const file = await reportService.exportUniversityReport(req.user, query, 'pdf');
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function academicExportUniversityExcel(req, res, next) {
  try {
    const query = reportService.withAcademicUniversity(req.user, req.validated.query);
    const file = await reportService.exportUniversityReport(req.user, query, 'xlsx');
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function academicExportStudentPdf(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const file = await reportService.exportStudentReport(req.user, applicationId, 'pdf');
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

async function academicExportStudentExcel(req, res, next) {
  try {
    const { applicationId } = req.validated.params;
    const file = await reportService.exportStudentReport(req.user, applicationId, 'xlsx');
    return sendExport(res, file);
  } catch (e) {
    return next(e);
  }
}

const fieldTrainingService = require('./fieldTraining.service');
const fs = require('fs');

async function academicTaskInstructionDownloadUrl(req, res, next) {
  try {
    const data = await fieldTrainingService.getTaskInstructionDownloadUrl(
      req.validated.params.taskId,
      req.user,
      { asAcademic: true }
    );
    return success(res, data, { message: 'Instruction download URL generated' });
  } catch (e) {
    return next(e);
  }
}

async function academicDownloadTaskInstruction(req, res, next) {
  try {
    const result = await fieldTrainingService.downloadTaskInstructionFile(
      req.validated.params.taskId,
      req.user,
      { asAcademic: true }
    );
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
    const stream = fs.createReadStream(result.absPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  dashboard,
  globalReport,
  exportGlobalPdf,
  exportGlobalExcel,
  universityReport,
  studentsList,
  studentReport,
  exportUniversityPdf,
  exportUniversityExcel,
  exportStudentPdf,
  exportStudentExcel,
  academicUniversityReport,
  academicStudentsList,
  academicStudentReport,
  academicExportUniversityPdf,
  academicExportUniversityExcel,
  academicExportStudentPdf,
  academicExportStudentExcel,
  academicTaskInstructionDownloadUrl,
  academicDownloadTaskInstruction,
  applications: studentsList,
  exportUniversity: exportUniversityPdf,
  exportStudent: exportStudentPdf,
};

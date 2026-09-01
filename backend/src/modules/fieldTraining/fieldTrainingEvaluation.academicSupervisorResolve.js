'use strict';

const names = require('./fieldTraining.supervisorName');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUniversityNumber(student = {}) {
  return (
    resolveOfficialUniversityNumber(student).number ||
    extractUniversityNumberFromEmail(student?.email) ||
    ''
  );
}

function supervisorFromImportPreviewGroups(groups = []) {
  const byApplicationId = new Map();
  const byUniversityNumber = new Map();
  const byEmail = new Map();
  for (const group of groups) {
    const groupSupervisor = names.displaySupervisorName(group.supervisorLabel || group.title?.split('—')?.[0]);
    for (const student of group.students || []) {
      const proposed = names.displaySupervisorName(
        student.proposed_supervisor_name || student.proposedSupervisorName || groupSupervisor
      );
      if (!proposed || (student.errors || []).length) continue;
      const applicationId = student.application_id || student.applicationId;
      const universityNumber = String(student.university_number || student.universityNumber || '');
      const universityEmail = emailKey(student.university_email || student.universityEmail);
      const record = { applicationId, universityNumber, universityEmail, supervisorName: proposed, source: 'excel_preview' };
      if (applicationId) byApplicationId.set(String(applicationId), record);
      if (universityNumber) byUniversityNumber.set(universityNumber, record);
      if (universityEmail) byEmail.set(universityEmail, record);
    }
  }
  return { byApplicationId, byUniversityNumber, byEmail };
}

function buildImportSupervisorIndex(batches = []) {
  const byApplicationId = new Map();
  const byUniversityNumber = new Map();
  const byEmail = new Map();
  for (const batch of batches) {
    const maps = supervisorFromImportPreviewGroups(batch.preview_json?.groups || []);
    for (const [key, value] of maps.byApplicationId) {
      if (!byApplicationId.has(key)) byApplicationId.set(key, value);
    }
    for (const [key, value] of maps.byUniversityNumber) {
      if (!byUniversityNumber.has(key)) byUniversityNumber.set(key, value);
    }
    for (const [key, value] of maps.byEmail) {
      if (!byEmail.has(key)) byEmail.set(key, value);
    }
  }
  return { byApplicationId, byUniversityNumber, byEmail };
}

function resolveAcademicSupervisorName({
  application = {},
  student = {},
  assignment = null,
  importIndex = null,
} = {}) {
  const onApp = names.displaySupervisorName(application.academic_supervisor_name);
  if (onApp) return { name: onApp, source: 'application' };

  const onAssignment = names.displaySupervisorName(assignment?.academic_supervisor_name || assignment?.supervisor_name);
  if (onAssignment) return { name: onAssignment, source: 'assignment' };

  const applicationId = String(application.id || '');
  const universityNumber = normalizeUniversityNumber(student);
  const universityEmail = emailKey(student?.email);

  if (importIndex) {
    const hit =
      (applicationId && importIndex.byApplicationId.get(applicationId)) ||
      (universityNumber && importIndex.byUniversityNumber.get(universityNumber)) ||
      (universityEmail && importIndex.byEmail.get(universityEmail)) ||
      null;
    if (hit?.supervisorName) {
      return { name: hit.supervisorName, source: hit.source || 'excel_preview' };
    }
  }

  return { name: null, source: null, code: 'ACADEMIC_SUPERVISOR_MISSING' };
}

module.exports = {
  buildImportSupervisorIndex,
  resolveAcademicSupervisorName,
  normalizeUniversityNumber,
};

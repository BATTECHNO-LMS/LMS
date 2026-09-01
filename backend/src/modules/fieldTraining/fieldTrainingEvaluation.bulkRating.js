'use strict';

const {
  SCORE_SOURCE,
  MANUAL_AUTHORIZED_BULK_RATING,
  BULK_RATING_REASON_AR,
} = require('./fieldTrainingEvaluation.constants');

const DB_SUPERVISOR_FIELDS = Object.freeze([
  'thinking_and_initiative',
  'problem_solving',
  'teamwork',
  'professional_conduct',
  'supervisor_cooperation',
  'rules_compliance',
]);

const CAMEL_TO_DB = Object.freeze({
  thinkingAndInitiative: 'thinking_and_initiative',
  problemSolving: 'problem_solving',
  teamwork: 'teamwork',
  professionalConduct: 'professional_conduct',
  supervisorCooperation: 'supervisor_cooperation',
  rulesCompliance: 'rules_compliance',
});

const DB_TO_CAMEL = Object.freeze(
  Object.fromEntries(Object.entries(CAMEL_TO_DB).map(([camel, db]) => [db, camel]))
);

const CRITERION_TO_DB_FIELD = Object.freeze({
  criterion3: 'thinking_and_initiative',
  criterion4: 'problem_solving',
  criterion6: 'teamwork',
  criterion7: 'professional_conduct',
  criterion8: 'supervisor_cooperation',
  criterion10: 'rules_compliance',
});

const CRITERION_LABELS_AR = Object.freeze({
  criterion3: 'القدرة على التفكير وطرح الأسئلة',
  criterion4: 'القدرة على حل المشكلات',
  criterion6: 'العلاقات مع الزملاء والتعاون معهم',
  criterion7: 'المحافظة على المظهر واللياقة العامة',
  criterion8: 'التعاون مع المشرف الميداني ومع إدارة المؤسسة',
  criterion10: 'الالتزام بقواعد وتعليمات المؤسسة',
});

const BULK_ELIGIBLE_CRITERION_KEYS = Object.freeze(Object.keys(CRITERION_TO_DB_FIELD));

const BULK_RATING_MARKER = `[${MANUAL_AUTHORIZED_BULK_RATING}]`;

function parseBulkAuthorizedDbFields(ratingRows = []) {
  const fields = new Set();
  for (const row of ratingRows) {
    const notes = String(row?.notes || '');
    if (!notes.includes(MANUAL_AUTHORIZED_BULK_RATING)) continue;
    const match = /\[BULK:([^\]]+)\]/.exec(notes);
    if (!match) continue;
    for (const part of match[1].split(',')) {
      const field = part.trim();
      if (DB_SUPERVISOR_FIELDS.includes(field)) fields.add(field);
    }
  }
  return fields;
}

function bulkAuthorizedSupervisorFields(ratingRows = []) {
  const camel = new Set();
  for (const dbField of parseBulkAuthorizedDbFields(ratingRows)) {
    const key = DB_TO_CAMEL[dbField];
    if (key) camel.add(key);
  }
  return camel;
}

function buildBulkRatingNotes(dbFields = [], reason = BULK_RATING_REASON_AR) {
  return [
    BULK_RATING_MARKER,
    `[BULK:${dbFields.join(',')}]`,
    reason,
  ].join(' ');
}

function listMissingBulkEligibleCriteria(calculated, eligibilityStatus) {
  if (String(eligibilityStatus || '').toUpperCase() !== 'ELIGIBLE') return [];
  const missing = [];
  for (const criterionKey of BULK_ELIGIBLE_CRITERION_KEYS) {
    const evidence = calculated?.criterionEvidence?.[criterionKey];
    if (evidence?.score != null) continue;
    const dbField = CRITERION_TO_DB_FIELD[criterionKey];
    missing.push({
      criterionKey,
      dbField,
      camelField: DB_TO_CAMEL[dbField],
      labelAr: CRITERION_LABELS_AR[criterionKey],
      previousValue: null,
      proposedScore: 5,
      source: MANUAL_AUTHORIZED_BULK_RATING,
    });
  }
  return missing;
}

function analyzeStudentBulkGaps({ calculated, eligibilityStatus, studentName, universityNumber, applicationId }) {
  const derivableNow = [];
  const stillMissing = listMissingBulkEligibleCriteria(calculated, eligibilityStatus);
  for (const key of BULK_ELIGIBLE_CRITERION_KEYS) {
    const evidence = calculated?.criterionEvidence?.[key];
    if (evidence?.score != null && evidence?.source === SCORE_SOURCE.DERIVED_FROM_PERFORMANCE) {
      derivableNow.push({
        criterionKey: key,
        labelAr: CRITERION_LABELS_AR[key],
        score: evidence.score,
        source: evidence.source,
      });
    }
  }
  return {
    applicationId,
    studentName,
    universityNumber,
    eligibilityStatus,
    eligibleForBulk: stillMissing.length > 0 && String(eligibilityStatus).toUpperCase() === 'ELIGIBLE',
    automaticallyDerived: derivableNow,
    missingProfessionalCriteria: stillMissing,
    ratingsToApply: stillMissing.length,
  };
}

function rowEligibleForBulk(row = {}) {
  return Boolean(row.eligibleForBulk ?? row.bulkEligibleForApproval);
}

function rowBulkRatingsToApply(row = {}) {
  if (typeof row.ratingsToApply === 'number') return row.ratingsToApply;
  if (Array.isArray(row.missingBulkCriteria)) return row.missingBulkCriteria.length;
  if (Array.isArray(row.missingProfessionalCriteria)) return row.missingProfessionalCriteria.length;
  return 0;
}

function getMissingProfessionalCriteria(calculated, eligibilityStatus) {
  return listMissingBulkEligibleCriteria(calculated, eligibilityStatus);
}

function summarizeBulkPreview(students = []) {
  const needingBulk = students.filter(rowEligibleForBulk);
  const ratingsToApply = needingBulk.reduce((sum, row) => sum + rowBulkRatingsToApply(row), 0);
  const automaticallyDerivedCount = students.reduce(
    (sum, row) => sum + (row.automaticallyDerived?.length || row.automaticallyDerivedCriteria?.length || 0),
    0
  );
  return {
    totalStudents: students.length,
    eligibleStudents: students.filter((row) => String(row.eligibilityStatus).toUpperCase() === 'ELIGIBLE').length,
    studentsNeedingBulk: needingBulk.length,
    studentsAffected: needingBulk.length,
    ratingsToApply,
    criteriaAffected: ratingsToApply,
    automaticallyDerivedCount,
    notEligibleSkipped: students.filter(
      (row) =>
        rowBulkRatingsToApply(row) > 0 && String(row.eligibilityStatus).toUpperCase() !== 'ELIGIBLE'
    ).length,
  };
}

module.exports = {
  DB_SUPERVISOR_FIELDS,
  CAMEL_TO_DB,
  DB_TO_CAMEL,
  CRITERION_TO_DB_FIELD,
  CRITERION_LABELS_AR,
  BULK_ELIGIBLE_CRITERION_KEYS,
  BULK_RATING_REASON_AR,
  parseBulkAuthorizedDbFields,
  bulkAuthorizedSupervisorFields,
  buildBulkRatingNotes,
  listMissingBulkEligibleCriteria,
  getMissingProfessionalCriteria,
  analyzeStudentBulkGaps,
  rowEligibleForBulk,
  rowBulkRatingsToApply,
  summarizeBulkPreview,
};

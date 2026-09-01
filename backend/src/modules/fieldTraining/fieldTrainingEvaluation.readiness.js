'use strict';

const {
  READY_STATUS,
  MISSING_REQUIRED_DATA,
  READY_AUTOMATIC,
  READY_WITH_MANUAL_RATING,
  MISSING_STATIC_DATA,
  MISSING_PROFESSIONAL_EVIDENCE,
  GENERATED_STATUS,
  STATIC_MISSING_FIELD_CODES,
  PAYLOAD_KEY_TO_MISSING_CODE,
  PROFESSIONAL_CRITERION_EVIDENCE_CODES,
  SCORE_SOURCE,
} = require('./fieldTrainingEvaluation.constants');

const PROFESSIONAL_MISSING_CODES = new Set(
  Object.values(PAYLOAD_KEY_TO_MISSING_CODE).filter((code) => code.startsWith('PROFESSIONAL_RATING_'))
);

function isStaticMissingCode(code) {
  return STATIC_MISSING_FIELD_CODES.includes(code);
}

function isProfessionalMissingCode(code) {
  return PROFESSIONAL_MISSING_CODES.has(code);
}

function classifyEvaluationReadiness({
  missingFieldEntries = [],
  criterionEvidence = {},
  generated = false,
  usesManualRating = false,
} = {}) {
  const codes = missingFieldEntries.map((row) => row.code || row);
  const staticMissing = codes.filter(isStaticMissingCode);
  const professionalMissing = codes.filter(isProfessionalMissingCode);

  if (generated && !codes.length) {
    return {
      readiness: GENERATED_STATUS,
      readinessCategory: GENERATED_STATUS,
      staticMissing,
      professionalMissing,
    };
  }

  if (staticMissing.length) {
    return {
      readiness: MISSING_REQUIRED_DATA,
      readinessCategory: MISSING_STATIC_DATA,
      staticMissing,
      professionalMissing,
    };
  }

  if (professionalMissing.length) {
    return {
      readiness: MISSING_REQUIRED_DATA,
      readinessCategory: MISSING_PROFESSIONAL_EVIDENCE,
      staticMissing,
      professionalMissing,
    };
  }

  const manualUsed =
    usesManualRating ||
    Object.values(criterionEvidence).some(
      (row) =>
        row?.source === SCORE_SOURCE.DIRECT_SUPERVISOR_RATING ||
        row?.source === SCORE_SOURCE.MANUAL_AUTHORIZED_EVALUATION ||
        row?.source === SCORE_SOURCE.MANUAL_AUTHORIZED_BULK_RATING
    );

  return {
    readiness: READY_STATUS,
    readinessCategory: manualUsed ? READY_WITH_MANUAL_RATING : READY_AUTOMATIC,
    staticMissing,
    professionalMissing,
  };
}

function missingProfessionalCriteria(criterionEvidence = {}) {
  const labels = {
    criterion3: 'القدرة على التفكير وطرح الأسئلة',
    criterion4: 'القدرة على حل المشكلات',
    criterion6: 'العلاقات مع الزملاء والتعاون معهم',
    criterion7: 'المحافظة على المظهر واللياقة العامة',
    criterion8: 'التعاون مع المشرف الميداني ومع إدارة المؤسسة',
    criterion10: 'الالتزام بقواعد وتعليمات المؤسسة',
  };
  const manualOnly = new Set([
    PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_6,
    PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_7,
    PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_8,
  ]);
  return Object.entries(criterionEvidence)
    .filter(([, row]) => row?.score == null && row?.missingEvidence && manualOnly.has(row.missingEvidence))
    .map(([key, row]) => ({
      criterionKey: key,
      code: row.missingEvidence,
      labelAr: labels[key] || row.missingEvidence,
    }));
}

function explainCriterionEvidence(criterionKey, criterionEvidence = {}) {
  const row = criterionEvidence[criterionKey];
  if (!row) return null;
  return {
    criterionKey,
    score: row.score,
    source: row.source,
    calculatedMetric: row.calculatedMetric,
    evidence: row.evidence,
    missingEvidence: row.missingEvidence,
  };
}

module.exports = {
  classifyEvaluationReadiness,
  missingProfessionalCriteria,
  explainCriterionEvidence,
  isStaticMissingCode,
  isProfessionalMissingCode,
};

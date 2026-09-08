'use strict';

/**
 * Resolve auditable Field Training eligibility overrides.
 * Matching is by university student number only — never by display name.
 */

const {
  ELIGIBILITY_OVERRIDE_TYPE,
  GATE_REASONS,
  GATE_REASON_LABELS_AR,
} = require('./fieldTrainingEvaluation.constants');

function normalizeUniversityNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '');
}

function resolveEligibilityOverride({ policy = {}, student = {}, application = {} } = {}) {
  const uniNumber =
    normalizeUniversityNumber(student.university_student_number) ||
    normalizeUniversityNumber(student.universityStudentNumber) ||
    normalizeUniversityNumber(application.university_student_number);

  const fromApp = application?.eligibility_reason?.details?.eligibilityOverride;
  if (fromApp && fromApp.type === ELIGIBILITY_OVERRIDE_TYPE.FORCE_NOT_ELIGIBLE) {
    const appNumber = normalizeUniversityNumber(fromApp.universityStudentNumber);
    if (!appNumber || !uniNumber || appNumber === uniNumber) {
      return {
        applied: true,
        type: ELIGIBILITY_OVERRIDE_TYPE.FORCE_NOT_ELIGIBLE,
        reasonCode: fromApp.reasonCode || GATE_REASONS.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION,
        reasonAr:
          fromApp.reasonAr || GATE_REASON_LABELS_AR.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION,
        preserveActualMarks: fromApp.preserveActualMarks !== false,
        skipZeroParticipation: fromApp.skipZeroParticipation !== false,
        source: fromApp.source || 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
        universityStudentNumber: uniNumber || appNumber || null,
        actor: fromApp.actor || null,
        timestamp: fromApp.timestamp || null,
      };
    }
  }

  if (!uniNumber) return null;
  const list = Array.isArray(policy?.scoringRules?.eligibilityOverrides)
    ? policy.scoringRules.eligibilityOverrides
    : [];
  const match = list.find(
    (row) => normalizeUniversityNumber(row.universityStudentNumber) === uniNumber
  );
  if (!match) return null;
  if (match.type !== ELIGIBILITY_OVERRIDE_TYPE.FORCE_NOT_ELIGIBLE) return null;

  return {
    applied: true,
    type: ELIGIBILITY_OVERRIDE_TYPE.FORCE_NOT_ELIGIBLE,
    reasonCode: match.reasonCode || GATE_REASONS.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION,
    reasonAr: match.reasonAr || GATE_REASON_LABELS_AR.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION,
    preserveActualMarks: match.preserveActualMarks !== false,
    skipZeroParticipation: match.skipZeroParticipation !== false,
    source: match.source || 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
    universityStudentNumber: uniNumber,
    actor: match.actor || null,
    timestamp: match.timestamp || null,
  };
}

module.exports = {
  normalizeUniversityNumber,
  resolveEligibilityOverride,
  ELIGIBILITY_OVERRIDE_TYPE,
};

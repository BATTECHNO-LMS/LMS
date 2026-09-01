'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  listMissingBulkEligibleCriteria,
  analyzeStudentBulkGaps,
  summarizeBulkPreview,
  buildBulkRatingNotes,
  bulkAuthorizedSupervisorFields,
  parseBulkAuthorizedDbFields,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.bulkRating');
const { SCORE_SOURCE, MANUAL_AUTHORIZED_BULK_RATING } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const { calculateFinalEvaluation } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');

function calculatedWithMissingBehavioral(eligibilityStatus = 'ELIGIBLE') {
  const result = calculateFinalEvaluation({
    attendancePercentage: 100,
    completedHours: 140,
    requiredHours: 140,
    requiredTaskCount: 4,
    acceptedTaskCount: 4,
    taskScoreAveragePercent: 92,
    postAssessmentScore: 88,
    preAssessmentScore: 60,
    supervisorRatings: {},
    hoursDataLoaded: true,
    attendanceDataLoaded: true,
  });
  return { ...result, eligibilityStatus };
}

describe('field training bulk eligible rating', () => {
  it('lists missing bulk criteria only for ELIGIBLE students', () => {
    const calculated = calculatedWithMissingBehavioral('ELIGIBLE');
    const eligibleMissing = listMissingBulkEligibleCriteria(calculated, 'ELIGIBLE');
    const ineligibleMissing = listMissingBulkEligibleCriteria(calculated, 'NOT_ELIGIBLE');
    assert.ok(eligibleMissing.length >= 3);
    assert.equal(ineligibleMissing.length, 0);
    assert.ok(eligibleMissing.every((row) => row.proposedScore === 5));
    assert.equal(eligibleMissing[0].source, MANUAL_AUTHORIZED_BULK_RATING);
  });

  it('does not propose bulk for criteria already derived', () => {
    const calculated = calculatedWithMissingBehavioral('ELIGIBLE');
    assert.ok(calculated.criterion3Score != null);
    assert.ok(calculated.criterion4Score != null);
    const missing = listMissingBulkEligibleCriteria(calculated, 'ELIGIBLE');
    assert.ok(!missing.some((row) => row.criterionKey === 'criterion3'));
    assert.ok(!missing.some((row) => row.criterionKey === 'criterion4'));
  });

  it('summarizes students needing bulk approval separately from not eligible', () => {
    const eligible = analyzeStudentBulkGaps({
      calculated: calculatedWithMissingBehavioral('ELIGIBLE'),
      eligibilityStatus: 'ELIGIBLE',
      studentName: 'Eligible Student',
      universityNumber: '1',
      applicationId: 'a1',
    });
    const ineligible = analyzeStudentBulkGaps({
      calculated: calculatedWithMissingBehavioral('NOT_ELIGIBLE'),
      eligibilityStatus: 'NOT_ELIGIBLE',
      studentName: 'Ineligible Student',
      universityNumber: '2',
      applicationId: 'a2',
    });
    const summary = summarizeBulkPreview([eligible, ineligible]);
    assert.equal(eligible.eligibleForBulk, true);
    assert.equal(ineligible.eligibleForBulk, false);
    assert.ok(summary.studentsNeedingBulk >= 1);
    assert.ok(summary.notEligibleSkipped >= 0);
  });

  it('counts bulk preview when readiness rows use bulkEligibleForApproval only', () => {
    const calculated = calculatedWithMissingBehavioral('ELIGIBLE');
    const analysis = analyzeStudentBulkGaps({
      calculated,
      eligibilityStatus: 'ELIGIBLE',
      studentName: 'Eligible Student',
      universityNumber: '1',
      applicationId: 'a1',
    });
    const readinessRow = {
      applicationId: analysis.applicationId,
      eligibilityStatus: analysis.eligibilityStatus,
      bulkEligibleForApproval: analysis.eligibleForBulk,
      missingBulkCriteria: analysis.missingProfessionalCriteria,
    };
    const summary = summarizeBulkPreview([readinessRow]);
    assert.equal(summary.studentsNeedingBulk, 1);
    assert.equal(summary.studentsAffected, 1);
    assert.ok(summary.ratingsToApply >= 3);
    assert.ok(summary.criteriaAffected >= 3);
  });

  it('does not overwrite existing scores when analyzing gaps', () => {
    const calculated = calculatedWithMissingBehavioral('ELIGIBLE');
    calculated.criterionEvidence.criterion6 = {
      score: 4,
      source: SCORE_SOURCE.DIRECT_SUPERVISOR_RATING,
    };
    calculated.criterion6Score = 4;
    const missing = listMissingBulkEligibleCriteria(calculated, 'ELIGIBLE');
    assert.ok(!missing.some((row) => row.criterionKey === 'criterion6'));
    assert.ok(missing.some((row) => row.criterionKey === 'criterion7'));
    assert.ok(missing.some((row) => row.criterionKey === 'criterion8'));
  });

  it('builds auditable bulk rating notes', () => {
    const notes = buildBulkRatingNotes(['teamwork', 'professional_conduct']);
    assert.match(notes, /MANUAL_AUTHORIZED_BULK_RATING/);
    assert.match(notes, /teamwork,professional_conduct/);
    assert.match(notes, /اعتماد إداري للبنود المهنية الناقصة للطالب المؤهل/);
  });

  it('parses bulk authorized fields from stored rating notes for scoring source', () => {
    const fields = parseBulkAuthorizedDbFields([
      { notes: '[MANUAL_AUTHORIZED_BULK_RATING] [BULK:teamwork,professional_conduct] reason' },
    ]);
    assert.deepEqual([...fields], ['teamwork', 'professional_conduct']);
    const camel = bulkAuthorizedSupervisorFields([
      { notes: '[MANUAL_AUTHORIZED_BULK_RATING] [BULK:teamwork] reason' },
    ]);
    assert.ok(camel.has('teamwork'));
  });

  it('keeps existing derived scores when analyzing gaps', () => {
    const calculated = calculatedWithMissingBehavioral('ELIGIBLE');
    assert.equal(calculated.criterionEvidence.criterion3.source, SCORE_SOURCE.DERIVED_FROM_PERFORMANCE);
    assert.notEqual(calculated.criterion3Score, 5);
  });
});

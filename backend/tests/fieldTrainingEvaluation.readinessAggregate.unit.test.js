'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPopulationSummary,
  computeGenerationCounts,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.readinessAggregate');
const { eligibilityBucket } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');

describe('field training readiness aggregate', () => {
  it('reconciles eligibility buckets with approved population', () => {
    const apps = [
      { id: '1', training_status: 'in_training', completion_eligibility_status: 'eligible' },
      { id: '2', training_status: 'in_training', completion_eligibility_status: 'ineligible' },
      { id: '3', training_status: 'expelled', completion_eligibility_status: 'ineligible' },
      { id: '4', training_status: 'in_training', completion_eligibility_status: 'pending' },
    ];
    const students = [{ applicationId: '1' }, { applicationId: '2' }, { applicationId: '3' }, { applicationId: '4' }];
    const population = buildPopulationSummary(apps, students, []);
    assert.equal(population.totalApplicationsConsidered, 4);
    assert.equal(population.eligible, 1);
    assert.equal(population.notEligible, 2);
    assert.equal(population.eligibilityPending, 1);
    assert.equal(population.reconciliation.matchesTotal, true);
    assert.equal(population.excluded.expelled, 1);
    assert.equal(population.reconciliation.activeNonExpelled, 3);
  });

  it('gates final ready count on template generation readiness', () => {
    const students = [
      { readiness: 'READY', readinessCategory: 'READY_AUTOMATIC' },
      { readiness: 'READY', readinessCategory: 'READY_WITH_MANUAL_RATING' },
    ];
    const blocked = computeGenerationCounts(students, false);
    const allowed = computeGenerationCounts(students, true);
    assert.equal(blocked.dataReady, 2);
    assert.equal(blocked.finalReady, 0);
    assert.equal(allowed.finalReady, 2);
  });

  it('classifies pending eligibility separately from ineligible', () => {
    assert.equal(eligibilityBucket({ completion_eligibility_status: 'pending' }), 'PENDING');
    assert.equal(eligibilityBucket({ completion_eligibility_status: 'needs_review' }), 'PENDING');
    assert.equal(eligibilityBucket({ completion_eligibility_status: 'ineligible' }), 'NOT_ELIGIBLE');
    assert.equal(eligibilityBucket({ completion_eligibility_status: 'eligible' }), 'ELIGIBLE');
  });
});

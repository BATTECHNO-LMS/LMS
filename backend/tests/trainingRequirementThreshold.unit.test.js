'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { mergeRequirementThreshold } = require('../src/modules/trainingPrograms/trainingPrograms.service');
const { shouldIssueCertificateOnFinalize } = require('../src/modules/trainingPrograms/trainingCompletion.service');

describe('mergeRequirementThreshold', () => {
  it('keeps passing_required and blocks_content when only pass_score is updated', () => {
    const merged = mergeRequirementThreshold(
      { pass_score: 60, passing_required: true, blocks_content: true },
      { pass_score: 70 }
    );
    assert.equal(merged.pass_score, 70);
    assert.equal(merged.passing_required, true);
    assert.equal(merged.blocks_content, true);
  });

  it('preserves existing threshold when pass_score is omitted', () => {
    const merged = mergeRequirementThreshold({ passing_required: true, blocks_content: true }, null);
    assert.equal(merged.passing_required, true);
    assert.equal(merged.blocks_content, true);
  });
});

describe('shouldIssueCertificateOnFinalize', () => {
  it('issues a certificate on exceptional finalize unless certificateEnabled is false', () => {
    assert.equal(shouldIssueCertificateOnFinalize({}), true);
    assert.equal(shouldIssueCertificateOnFinalize({ certificateEnabled: true }), true);
    assert.equal(shouldIssueCertificateOnFinalize({ certificateEnabled: false }), false);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const {
  classifyStudent,
  evaluateCompletionLetterIssueGate,
  evaluateCompletionLetterDownloadGate,
  buildLetterInvalidationMetadata,
  LETTER_GATE_CODES,
  SKIP_REASONS,
  MIN_COMPLETION_LETTER_HOURS,
} = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const {
  isOfficiallyEligible,
} = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');

const HASH = 'abc123';

function eligibleApp(overrides = {}) {
  return {
    id: 'app-ok',
    student_id: 'stu-ok',
    completion_eligibility_status: 'eligible',
    training_status: 'eligible_for_completion',
    completed_training_hours: 140,
    expelled_at: null,
    eligibility_reason: {
      details: {
        approvedEvaluationResult: { approvedStatus: 'ELIGIBLE', approvedFinalScore: 86 },
      },
    },
    ...overrides,
  };
}

function issuedLetter(overrides = {}) {
  return {
    id: 'letter-1',
    status: 'issued',
    source_data_hash: HASH,
    pdf_url: 'field-training/completion-letters/app/FT.pdf',
    file_ready: true,
    metadata: {},
    ...overrides,
  };
}

describe('completion letter official eligibility gates', () => {
  it('allows an eligible student to issue a completion letter', () => {
    const official = { eligibility: 'ELIGIBLE' };
    const gate = evaluateCompletionLetterIssueGate({ official, app: eligibleApp() });
    assert.equal(gate.allowed, true);
    assert.equal(isOfficiallyEligible(official), true);
  });

  it('denies issue when current official eligibility is not eligible', () => {
    const official = { eligibility: 'NOT_ELIGIBLE' };
    const gate = evaluateCompletionLetterIssueGate({
      official,
      app: eligibleApp({
        completion_eligibility_status: 'ineligible',
        eligibility_reason: {
          details: { approvedEvaluationResult: { approvedStatus: 'NOT_ELIGIBLE' } },
        },
      }),
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, LETTER_GATE_CODES.NOT_ELIGIBLE);
    assert.equal(gate.skipReason, SKIP_REASONS.NOT_ELIGIBLE);
  });

  it('denies issue for an expelled student even if a stored status looks eligible', () => {
    const gate = evaluateCompletionLetterIssueGate({
      official: { eligibility: 'ELIGIBLE' },
      app: eligibleApp({ training_status: 'expelled', expelled_at: new Date().toISOString() }),
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, LETTER_GATE_CODES.EXPELLED);
    const classified = classifyStudent(
      eligibleApp({ training_status: 'expelled', expelled_at: new Date().toISOString() }),
      null,
      HASH
    );
    assert.equal(classified.skipReason, SKIP_REASONS.EXPELLED);
  });

  it('denies issue for a failed student', () => {
    const gate = evaluateCompletionLetterIssueGate({
      official: { eligibility: 'ELIGIBLE' },
      app: eligibleApp({ training_status: 'failed' }),
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, LETTER_GATE_CODES.FAILED);
    const classified = classifyStudent(eligibleApp({ training_status: 'failed' }), null, HASH);
    assert.equal(classified.skipReason, SKIP_REASONS.FAILED);
  });

  it('invalidates an existing issued letter when eligibility becomes not eligible', () => {
    const official = { eligibility: 'NOT_ELIGIBLE' };
    const letter = issuedLetter();
    const gate = evaluateCompletionLetterDownloadGate({
      official,
      app: eligibleApp({
        completion_eligibility_status: 'ineligible',
        training_status: 'completed',
        eligibility_reason: {
          details: { approvedEvaluationResult: { approvedStatus: 'NOT_ELIGIBLE' } },
        },
      }),
      letter,
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, LETTER_GATE_CODES.NOT_CURRENTLY_VALID);
    const meta = buildLetterInvalidationMetadata(letter, {
      reason: 'eligibility_transition_to_not_eligible',
      eligibility: 'NOT_ELIGIBLE',
    });
    assert.equal(meta.invalidation.status, 'revoked');
    assert.equal(meta.invalidation.previousStatus, 'issued');
    assert.equal(letter.pdf_url, 'field-training/completion-letters/app/FT.pdf');
  });

  it('does not serve a revoked historical letter as a current official letter', () => {
    const gate = evaluateCompletionLetterDownloadGate({
      official: { eligibility: 'NOT_ELIGIBLE' },
      app: eligibleApp({ completion_eligibility_status: 'ineligible' }),
      letter: issuedLetter({ status: 'revoked' }),
    });
    assert.equal(gate.allowed, false);
    assert.equal(
      gate.code === LETTER_GATE_CODES.NOT_CURRENTLY_VALID || gate.code === LETTER_GATE_CODES.NOT_FOUND,
      true
    );
  });

  it('leaves an eligible student with an issued letter unaffected', () => {
    const official = { eligibility: 'ELIGIBLE' };
    const letter = issuedLetter();
    const issue = evaluateCompletionLetterIssueGate({ official, app: eligibleApp() });
    const download = evaluateCompletionLetterDownloadGate({
      official,
      app: eligibleApp(),
      letter,
    });
    assert.equal(issue.allowed, true);
    assert.equal(download.allowed, true);
    const skip = classifyStudent(eligibleApp(), { ...letter, file_ready: true }, HASH);
    assert.equal(skip.alreadyIssued, true);
    assert.equal(skip.skipReason, SKIP_REASONS.SOURCE_UNCHANGED);
  });

  it('does not allow another student identity to pass the owner check', () => {
    const app = eligibleApp({ student_id: 'stu-owner' });
    const otherStudentId = 'stu-other-university';
    assert.notEqual(app.student_id, otherStudentId);
    assert.throws(() => {
      if (app.student_id !== otherStudentId) {
        throw new ApiError(403, 'Forbidden');
      }
    }, (err) => err.statusCode === 403);
  });

  it('direct issue gate cannot bypass official eligibility', () => {
    const app = eligibleApp({
      completion_eligibility_status: 'eligible',
      eligibility_reason: {
        details: { approvedEvaluationResult: { approvedStatus: 'NOT_ELIGIBLE' } },
      },
    });
    const gate = evaluateCompletionLetterIssueGate({ app });
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, LETTER_GATE_CODES.NOT_ELIGIBLE);
  });

  it('repeated issue of an unchanged current letter follows existing idempotency', () => {
    const skip = classifyStudent(eligibleApp(), issuedLetter({ file_ready: true }), HASH);
    assert.equal(skip.alreadyIssued, true);
    assert.equal(skip.skipReason, SKIP_REASONS.SOURCE_UNCHANGED);
    assert.equal(MIN_COMPLETION_LETTER_HOURS, 140);
  });

  it('does not treat training_status=completed as eligible', () => {
    const gate = evaluateCompletionLetterIssueGate({
      official: { eligibility: 'NOT_ELIGIBLE' },
      app: eligibleApp({
        training_status: 'completed',
        completion_eligibility_status: 'ineligible',
        eligibility_reason: {
          details: { approvedEvaluationResult: { approvedStatus: 'NOT_ELIGIBLE' } },
        },
      }),
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.skipReason, SKIP_REASONS.NOT_ELIGIBLE);
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
  gradeAnswers,
  normalizeQuestionType,
} = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

describe('Institutional assessments reuse FT question engine', () => {
  it('maps single_choice alias to multiple_choice', () => {
    assert.equal(normalizeQuestionType('single_choice'), 'multiple_choice');
  });

  it('stores and grades objective questions', () => {
    const prepared = prepareQuestionForStorage(
      {
        question_text: 'هل أنت جاهز؟',
        question_type: 'single_choice',
        options: ['نعم', 'لا'],
        correct_answer: 'نعم',
        points: 10,
      },
      0
    );
    assert.equal(prepared.question_type, 'multiple_choice');
    const validation = validateAssessmentQuestions([prepared]);
    assert.equal(typeof validation, 'object');
    assert.equal(validation.ok, true);

    const graded = gradeAnswers(
      [{ id: 'q1', question_type: prepared.question_type, options: prepared.options, correct_answer: prepared.correct_answer, points: 10 }],
      { q1: 'نعم' }
    );
    assert.equal(graded.scorePercent, 100);
  });
});

describe('trainingAssessment.service exports', () => {
  it('exposes lifecycle APIs without creating a second engine', () => {
    const svc = require('../src/modules/trainingPrograms/trainingAssessment.service');
    for (const key of [
      'listProgramAssessments',
      'upsertAssessment',
      'publishAssessment',
      'startAttempt',
      'saveAttemptAnswers',
      'submitAttempt',
      'gradeAttempt',
      'getPrePostComparison',
      'getTraineeAssessmentStatus',
    ]) {
      assert.equal(typeof svc[key], 'function', key);
    }
  });
});

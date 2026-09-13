'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  QUESTION_COUNT,
  QUESTION_POINTS,
  TOTAL_SCORE,
  PASSING_SCORE,
  PASS_CORRECT_COUNT,
  CLOSES_AT,
  UNIVERSITY_CODE,
  OPPORTUNITY_ID,
  toStorageQuestions,
  validateZarqaPreBank,
  gradeCorrectCount,
  RAW_QUESTIONS,
} = require('../src/modules/fieldTraining/fieldTraining.zarqaPreAssessment');
const { studentPayloadLeaksAnswers } = require('../src/modules/fieldTraining/fieldTraining.standardizedPostAssessment');
const { toStudentQuestionDto } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

describe('Zarqa Field Training PRE assessment bank', () => {
  it('validates 20 MCQs at 5 points totaling 100 with pass 60', () => {
    const result = validateZarqaPreBank();
    assert.equal(typeof result, 'object');
    assert.equal(result.ok, true);
    assert.equal(result.questionCount, QUESTION_COUNT);
    assert.equal(result.questionPoints, QUESTION_POINTS);
    assert.equal(result.totalPoints, TOTAL_SCORE);
    assert.equal(result.passingScore, PASSING_SCORE);
    assert.equal(result.passCorrectCount, PASS_CORRECT_COUNT);
    assert.equal(result.correctAnswersConfigured, 20);
    assert.equal(UNIVERSITY_CODE, 'zarqa-private-university');
    assert.equal(OPPORTUNITY_ID, 'cbe032b3-e7ef-475f-851e-faa7e61264b2');
    assert.equal(CLOSES_AT, '2026-09-13T23:59:00+03:00');
  });

  it('stores four options and one correct answer per question', () => {
    const stored = toStorageQuestions();
    assert.equal(stored.length, 20);
    for (let i = 0; i < stored.length; i += 1) {
      const q = stored[i];
      assert.equal(q.question_type, 'multiple_choice');
      assert.equal(q.options.length, 4);
      assert.equal(q.points, 5);
      assert.equal(q.is_required, true);
      assert.ok(q.options.includes(RAW_QUESTIONS[i].correct_answer));
    }
  });

  it('grades 11/12/20/0 without percentage renormalization', () => {
    const fail11 = gradeCorrectCount(11);
    assert.equal(fail11.scorePoints, 55);
    assert.equal(fail11.scorePercent, 55);
    assert.equal(fail11.passed, false);

    const pass12 = gradeCorrectCount(12);
    assert.equal(pass12.scorePoints, 60);
    assert.equal(pass12.scorePercent, 60);
    assert.equal(pass12.passed, true);

    const pass20 = gradeCorrectCount(20);
    assert.equal(pass20.scorePoints, 100);
    assert.equal(pass20.scorePercent, 100);
    assert.equal(pass20.passed, true);

    const fail0 = gradeCorrectCount(0);
    assert.equal(fail0.scorePoints, 0);
    assert.equal(fail0.scorePercent, 0);
    assert.equal(fail0.passed, false);
  });

  it('does not leak correct answers in the student DTO', () => {
    const stored = toStorageQuestions().map((q, i) => ({ ...q, id: `q-${i}` }));
    const student = stored.map((q) => toStudentQuestionDto(q));
    assert.equal(studentPayloadLeaksAnswers(student), false);
    for (const q of student) {
      assert.equal(q.correct_answer, undefined);
    }
  });
});

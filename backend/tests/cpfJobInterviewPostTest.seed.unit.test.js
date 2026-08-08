'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  COURSE_CODE,
  ASSESSMENT_CODE,
  PRE_ASSESSMENT_CODE,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
} = require('../scripts/seed-cpf-job-interview-post-test');

const { gradeAnswers } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

describe('CPF job-interview post-test seed spec', () => {
  it('uses stable course and assessment codes', () => {
    assert.equal(COURSE_CODE, 'CPF-JOB-INTERVIEW-2026-08');
    assert.equal(ASSESSMENT_CODE, 'CPF-JOB-INTERVIEW-2026-POST');
    assert.equal(PRE_ASSESSMENT_CODE, 'CPF-JOB-INTERVIEW-2026-PRE');
  });

  it('has exactly 20 questions with four options and one correct answer matching the key', () => {
    validateSpecLocally();
    assert.equal(POST_QUESTIONS.length, 20);
    assert.equal(Object.keys(ANSWER_KEY).length, 20);

    for (let i = 0; i < POST_QUESTIONS.length; i += 1) {
      const q = POST_QUESTIONS[i];
      const n = i + 1;
      assert.equal(q.options.length, 4, `q${n} options`);
      assert.equal(q.correctLetter, ANSWER_KEY[n], `q${n} letter`);
      assert.ok(q.options[LETTER_TO_INDEX[q.correctLetter]]);
    }
  });

  it('prepares questions through the shared assessment engine', () => {
    const prepared = prepareQuestions();
    assert.equal(prepared.length, 20);
    const totalPoints = prepared.reduce((s, q) => s + Number(q.points || 0), 0);
    assert.equal(totalPoints, 20);
    for (const q of prepared) {
      assert.equal(q.question_type, 'multiple_choice');
      assert.equal(q.options.length, 4);
      assert.equal(q.options.filter((o) => o === q.correct_answer).length, 1);
    }
  });

  it('auto-grades a perfect attempt at 100% and a failing attempt below 70%', () => {
    const prepared = prepareQuestions();
    const questions = prepared.map((q, i) => ({
      id: `q${i + 1}`,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: 1,
    }));

    const perfectAnswers = Object.fromEntries(
      questions.map((q) => [q.id, q.correct_answer])
    );
    const perfect = gradeAnswers(questions, perfectAnswers);
    assert.equal(perfect.scorePercent, 100);
    assert.equal(perfect.maxPoints, 20);
    assert.equal(perfect.scorePoints, 20);

    const failingAnswers = Object.fromEntries(
      questions.map((q, i) => {
        // pick a wrong option for first 10, correct for last 10 → 50%
        if (i < 10) {
          const wrong = q.options.find((o) => o !== q.correct_answer);
          return [q.id, wrong];
        }
        return [q.id, q.correct_answer];
      })
    );
    const failing = gradeAnswers(questions, failingAnswers);
    assert.equal(failing.scorePercent, 50);
    assert.ok(failing.scorePercent < 70);
  });

  it('answer key matches the published specification exactly', () => {
    const expected = [
      'C',
      'B',
      'D',
      'A',
      'C',
      'B',
      'D',
      'A',
      'C',
      'B',
      'D',
      'A',
      'C',
      'B',
      'D',
      'C',
      'A',
      'D',
      'B',
      'C',
    ];
    for (let i = 0; i < 20; i += 1) {
      assert.equal(ANSWER_KEY[i + 1], expected[i], `key ${i + 1}`);
    }
  });
});

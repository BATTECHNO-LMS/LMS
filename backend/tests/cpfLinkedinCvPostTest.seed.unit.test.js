'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ORG_CODE,
  COURSE_CODE,
  COURSE_TITLE_AR,
  PRE_ASSESSMENT_CODE,
  ASSESSMENT_CODE,
  ASSESSMENT_TITLE,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
} = require('../scripts/seed-cpf-linkedin-cv-post-test');

const { gradeAnswers } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const { mapAssessmentOut } = require('../src/modules/trainingPrograms/trainingAssessment.service');

const SEED_PATH = path.join(__dirname, '../scripts/seed-cpf-linkedin-cv-post-test.js');

const EXPECTED_KEY = [
  'B',
  'A',
  'C',
  'C',
  'C',
  'B',
  'C',
  'B',
  'B',
  'C',
  'B',
  'C',
  'C',
  'B',
  'B',
  'C',
  'B',
  'C',
  'B',
  'B',
  'C',
  'A',
  'A',
  'B',
  'B',
];

describe('CPF LinkedIn & CV post-test seed spec', () => {
  it('uses stable course and assessment codes', () => {
    assert.equal(ORG_CODE, 'CROWN_PRINCE_FOUNDATION');
    assert.equal(COURSE_CODE, 'CPF-LINKEDIN-CV-2026');
    assert.equal(COURSE_TITLE_AR, 'LinkedIn وكتابة السيرة الذاتية CV');
    assert.equal(ASSESSMENT_CODE, 'CPF-LINKEDIN-CV-2026-POST');
    assert.equal(PRE_ASSESSMENT_CODE, 'CPF-LINKEDIN-CV-2026-PRE');
    assert.equal(ASSESSMENT_TITLE, 'الامتحان البعدي المتقدم – LinkedIn وتسويق المهارات');
  });

  it('has exactly 25 questions with four options and one correct answer matching the key', () => {
    validateSpecLocally();
    assert.equal(POST_QUESTIONS.length, 25);
    assert.equal(Object.keys(ANSWER_KEY).length, 25);
    for (let i = 0; i < POST_QUESTIONS.length; i += 1) {
      const q = POST_QUESTIONS[i];
      const n = i + 1;
      assert.equal(q.options.length, 4, `q${n} options`);
      assert.equal(q.correctLetter, ANSWER_KEY[n], `q${n} letter`);
      assert.ok(q.options[LETTER_TO_INDEX[q.correctLetter]]);
    }
  });

  it('answer key matches the published specification including Q8=B and Q23=A', () => {
    for (let i = 0; i < 25; i += 1) {
      assert.equal(ANSWER_KEY[i + 1], EXPECTED_KEY[i], `key ${i + 1}`);
    }
    assert.equal(ANSWER_KEY[8], 'B');
    assert.equal(ANSWER_KEY[23], 'A');
    assert.equal(POST_QUESTIONS[7].correctLetter, 'B');
    assert.equal(POST_QUESTIONS[22].correctLetter, 'A');
  });

  it('prepares questions through the shared assessment engine', () => {
    const prepared = prepareQuestions();
    assert.equal(prepared.length, 25);
    const totalPoints = prepared.reduce((s, q) => s + Number(q.points || 0), 0);
    assert.equal(totalPoints, 25);
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

    const perfect = gradeAnswers(
      questions,
      Object.fromEntries(questions.map((q) => [q.id, q.correct_answer]))
    );
    assert.equal(perfect.scorePercent, 100);
    assert.equal(perfect.maxPoints, 25);
    assert.equal(perfect.scorePoints, 25);
    assert.ok(perfect.scorePercent >= 70);

    const failing = gradeAnswers(
      questions,
      Object.fromEntries(
        questions.map((q, i) => {
          if (i < 10) return [q.id, q.options.find((o) => o !== q.correct_answer)];
          return [q.id, q.correct_answer];
        })
      )
    );
    assert.equal(failing.scorePercent, 60);
    assert.ok(failing.scorePercent < 70);
  });

  it('does not invent availability dates or modify the pre-test in source', () => {
    const src = fs.readFileSync(SEED_PATH, 'utf8');
    assert.match(src, /kind:\s*'POST_TEST'/);
    assert.match(src, /pass_score:\s*70/);
    assert.match(src, /duration_minutes:\s*30/);
    assert.match(src, /max_attempts:\s*1/);
    assert.match(src, /passing_required:\s*true/);
    assert.equal(src.includes('training_programs.create'), false);
    assert.equal(src.includes(PRE_ASSESSMENT_CODE) && /PRE_TEST/.test(src), true);
    assert.equal(/new Date\('20\d{2}-/.test(src), false);
  });

  it('hides correct answers from trainee payloads', () => {
    const prepared = prepareQuestions();
    const mapped = mapAssessmentOut(
      {
        id: 'a1',
        program_id: 'p1',
        kind: 'POST_TEST',
        code: ASSESSMENT_CODE,
        title: ASSESSMENT_TITLE,
        instructions: 'test',
        duration_minutes: 30,
        max_attempts: 1,
        pass_score: 70,
        opens_at: null,
        closes_at: null,
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
        training_assessment_questions: prepared.map((q, i) => ({
          id: `q${i + 1}`,
          prompt: q.question_text,
          question_type: q.question_type,
          options_json: q.options,
          correct_answer: q.correct_answer,
          points: 1,
          sort_order: i,
        })),
      },
      { includeQuestions: true, includeCorrect: false }
    );
    assert.equal(mapped.showCorrectAnswers, false);
    assert.equal(mapped.shuffleAnswers, false);
    assert.equal(mapped.kind, 'POST_TEST');
    assert.equal(mapped.passScore, 70);
    assert.equal(mapped.durationMinutes, 30);
    assert.equal(mapped.maxAttempts, 1);
    assert.equal(mapped.questions.length, 25);
    assert.ok(mapped.questions.every((q) => q.correct_answer === undefined));

    const admin = mapAssessmentOut(
      {
        ...mapped,
        id: 'a1',
        program_id: 'p1',
        kind: 'POST_TEST',
        code: ASSESSMENT_CODE,
        title: ASSESSMENT_TITLE,
        instructions: 'test',
        duration_minutes: 30,
        max_attempts: 1,
        pass_score: 70,
        opens_at: null,
        closes_at: null,
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
        training_assessment_questions: prepared.map((q, i) => ({
          id: `q${i + 1}`,
          prompt: q.question_text,
          question_type: q.question_type,
          options_json: q.options,
          correct_answer: q.correct_answer,
          points: 1,
          sort_order: i,
        })),
      },
      { includeQuestions: true, includeCorrect: true }
    );
    assert.equal(admin.questions[7].correct_answer, POST_QUESTIONS[7].options[1]);
    assert.equal(admin.questions[22].correct_answer, POST_QUESTIONS[22].options[0]);
  });
});

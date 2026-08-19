'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ORG_CODE,
  ORG_NAME_AR,
  COURSE_CODE,
  ASSESSMENT_CODE,
  COURSE_TITLE_AR,
  COURSE_TITLE_EN,
  ASSESSMENT_TITLE,
  DOMAINS,
  ANSWER_KEY,
  PRE_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
  mergeCourseSettings,
} = require('../scripts/seed-cpf-linkedin-cv-course');

const { gradeAnswers } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const { mapAssessmentOut } = require('../src/modules/trainingPrograms/trainingAssessment.service');

const SEED_PATH = path.join(__dirname, '../scripts/seed-cpf-linkedin-cv-course.js');

describe('CPF LinkedIn & CV course seed spec', () => {
  it('uses stable organization, course, and pre-test codes', () => {
    assert.equal(ORG_CODE, 'CROWN_PRINCE_FOUNDATION');
    assert.equal(ORG_NAME_AR, 'مؤسسة ولي العهد');
    assert.equal(COURSE_CODE, 'CPF-LINKEDIN-CV-2026');
    assert.equal(ASSESSMENT_CODE, 'CPF-LINKEDIN-CV-2026-PRE');
    assert.equal(COURSE_TITLE_AR, 'LinkedIn وكتابة السيرة الذاتية CV');
    assert.equal(COURSE_TITLE_EN, 'LinkedIn & CV Development');
    assert.equal(ASSESSMENT_TITLE, 'الاختبار القبلي – LinkedIn وكتابة السيرة الذاتية CV');
    assert.deepEqual(DOMAINS, ['السيرة الذاتية', 'LinkedIn', 'التوظيف والاستعداد المهني']);
  });

  it('has exactly 20 questions with four options and one correct answer matching the key', () => {
    validateSpecLocally();
    assert.equal(PRE_QUESTIONS.length, 20);
    assert.equal(Object.keys(ANSWER_KEY).length, 20);

    for (let i = 0; i < PRE_QUESTIONS.length; i += 1) {
      const q = PRE_QUESTIONS[i];
      const n = i + 1;
      assert.equal(q.options.length, 4, `q${n} options`);
      assert.equal(q.correctLetter, ANSWER_KEY[n], `q${n} letter`);
      assert.ok(q.options[LETTER_TO_INDEX[q.correctLetter]]);
    }
  });

  it('answer key matches the published specification exactly', () => {
    const expected = [
      'B',
      'A',
      'C',
      'B',
      'B',
      'A',
      'B',
      'C',
      'C',
      'C',
      'B',
      'B',
      'C',
      'B',
      'B',
      'C',
      'B',
      'B',
      'C',
      'A',
    ];
    for (let i = 0; i < 20; i += 1) {
      assert.equal(ANSWER_KEY[i + 1], expected[i], `key ${i + 1}`);
    }
  });

  it('prepares questions through the shared assessment engine as single-choice', () => {
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

  it('auto-grades a perfect attempt at 100% and a 55% attempt below the 60% pass score', () => {
    const prepared = prepareQuestions();
    const questions = prepared.map((q, i) => ({
      id: `q${i + 1}`,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: 1,
    }));

    const perfectAnswers = Object.fromEntries(questions.map((q) => [q.id, q.correct_answer]));
    const perfect = gradeAnswers(questions, perfectAnswers);
    assert.equal(perfect.scorePercent, 100);
    assert.equal(perfect.maxPoints, 20);
    assert.equal(perfect.scorePoints, 20);
    assert.ok(perfect.scorePercent >= 60);

    const failingAnswers = Object.fromEntries(
      questions.map((q, i) => {
        if (i < 9) {
          const wrong = q.options.find((o) => o !== q.correct_answer);
          return [q.id, wrong];
        }
        return [q.id, q.correct_answer];
      })
    );
    const failing = gradeAnswers(questions, failingAnswers);
    assert.equal(failing.scorePercent, 55);
    assert.ok(failing.scorePercent < 60);
  });

  it('does not invent schedule, hours, cohort, or trainer assignment in the seed source', () => {
    const src = fs.readFileSync(SEED_PATH, 'utf8');
    assert.match(src, /status:\s*'DRAFT'/);
    assert.match(src, /kind:\s*'PRE_TEST'/);
    assert.match(src, /pass_score:\s*60/);
    assert.match(src, /duration_minutes:\s*20/);
    assert.match(src, /max_attempts:\s*1/);
    assert.match(src, /passing_required:\s*false/);
    assert.match(src, /blocks_content:\s*false/);
    assert.equal(src.includes('training_cohorts.create'), false);
    assert.equal(src.includes('training_trainer_assignments.create'), false);
    assert.equal(/start_date:\s/.test(src), false);
    assert.equal(/end_date:\s/.test(src), false);
    assert.equal(/required_hours:\s/.test(src), false);
    assert.equal(/delivery_mode:\s/.test(src), false);
    assert.equal(/max_participants:\s/.test(src), false);
    assert.equal(/required_attendance_pct:\s/.test(src), false);
    assert.equal(/opens_at:\s/.test(src), false);
    assert.equal(/closes_at:\s/.test(src), false);
  });

  it('keeps pre-test diagnostic unless an existing course already blocks content', () => {
    const created = mergeCourseSettings(null);
    assert.equal(created.preTestBlocksContent, false);
    assert.equal(created.titleEn, COURSE_TITLE_EN);
    assert.deepEqual(created.domains, DOMAINS);
    assert.equal(created.enrollment.institutionTraineesOnly, true);
    assert.equal(created.enrollment.publicRegistration, false);

    const preserved = mergeCourseSettings({ preTestBlocksContent: true, timezone: 'UTC' });
    assert.equal(preserved.preTestBlocksContent, true);
    assert.equal(preserved.timezone, 'UTC');
  });

  it('hides answer keys from trainee assessment payloads', () => {
    const mapped = mapAssessmentOut(
      {
        id: 'a1',
        program_id: 'p1',
        kind: 'PRE_TEST',
        code: ASSESSMENT_CODE,
        title: ASSESSMENT_TITLE,
        instructions: 'test',
        duration_minutes: 20,
        max_attempts: 1,
        pass_score: 60,
        opens_at: null,
        closes_at: null,
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
        training_assessment_questions: [
          {
            id: 'q1',
            prompt: PRE_QUESTIONS[0].prompt,
            question_type: 'multiple_choice',
            options_json: PRE_QUESTIONS[0].options,
            correct_answer: PRE_QUESTIONS[0].options[1],
            points: 1,
            sort_order: 0,
          },
        ],
      },
      { includeQuestions: true, includeCorrect: false }
    );
    assert.equal(mapped.showCorrectAnswers, false);
    assert.equal(mapped.shuffleAnswers, false);
    assert.equal(mapped.showResults, true);
    assert.equal(mapped.passScore, 60);
    assert.equal(mapped.durationMinutes, 20);
    assert.equal(mapped.maxAttempts, 1);
    assert.equal(mapped.questions[0].correct_answer, undefined);
    assert.equal(mapped.questions[0].options.length, 4);
  });
});

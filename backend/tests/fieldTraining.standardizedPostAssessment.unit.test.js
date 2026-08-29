'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  prepareQuestionForStorage,
  normalizeCorrectAnswer,
  gradeAnswers,
} = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const {
  TEMPLATE_ID,
  ASSESSMENT_TITLE,
  QUESTION_COUNT,
  TOTAL_GRADE,
  PASSING_SCORE,
  validateStandardizedBank,
  toStorageQuestions,
  shuffleQuestionsForStudent,
  resolveAttemptStatus,
  parseAssessmentDescription,
  serializeDescription,
  STANDARDIZED_POST_QUESTIONS,
} = require('../src/modules/fieldTraining/fieldTraining.standardizedPostAssessment');

describe('standardized field-training post-assessment bank', () => {
  it('validates 25 unique Arabic MCQs totaling 100 with even answers and mixed difficulty', () => {
    const result = validateStandardizedBank();
    assert.equal(typeof result, 'object');
    assert.equal(result.ok, true);
    assert.equal(result.questionCount, QUESTION_COUNT);
    assert.equal(result.totalPoints, TOTAL_GRADE);
    assert.equal(STANDARDIZED_POST_QUESTIONS.length, 25);
    const positions = result.positionCounts;
    assert.equal(positions.length, 4);
    assert.ok(Math.max(...positions) - Math.min(...positions) <= 1);
  });

  it('stores four options, one correct answer, and a reviewer explanation', () => {
    const stored = toStorageQuestions();
    assert.equal(stored.length, 25);
    for (const q of stored) {
      assert.equal(q.question_type, 'multiple_choice');
      assert.equal(Array.isArray(q.options), true);
      assert.equal(q.options.length, 4);
      assert.equal(q.points, 4);
      assert.equal(q.is_required, true);
      const answer = normalizeCorrectAnswer(q.question_type, q.correct_answer, q.options);
      assert.ok(q.options.includes(answer));
      assert.equal(typeof q.correct_answer, 'object');
      assert.ok(String(q.correct_answer.explanation || '').length > 8);
    }
    assert.match(ASSESSMENT_TITLE, /التقييم البعدي/);
    assert.equal(TEMPLATE_ID, 'FIELD_TRAINING_POST_ASSESSMENT_FULLSTACK_2026_V1');
    assert.equal(PASSING_SCORE, 60);
  });

  it('auto-grades an MCQ whose correct answer is stored as { answer, explanation }', () => {
    const prepared = prepareQuestionForStorage(
      {
        question_text: 'سؤال تجريبي؟',
        question_type: 'multiple_choice',
        options: ['أ', 'ب', 'ج', 'د'],
        correct_answer: { answer: 'ج', explanation: 'الشرح الداخلي' },
        points: 4,
        is_required: true,
      },
      0
    );
    const graded = gradeAnswers([{ id: 'q1', ...prepared }], { q1: 'ج' });
    assert.equal(graded.scorePoints, 4);
    assert.equal(graded.questionResults[0].gradingStatus, 'auto_graded');
  });

  it('shuffles questions and options deterministically per student without leaking answers', () => {
    const questions = toStorageQuestions().map((q, i) => ({ ...q, id: `q-${i}` }));
    const a = shuffleQuestionsForStudent(questions, {
      studentId: 'student-a',
      assessmentId: 'assessment-1',
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    const a2 = shuffleQuestionsForStudent(questions, {
      studentId: 'student-a',
      assessmentId: 'assessment-1',
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    const b = shuffleQuestionsForStudent(questions, {
      studentId: 'student-b',
      assessmentId: 'assessment-1',
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    assert.deepEqual(a.map((q) => q.id), a2.map((q) => q.id));
    assert.notDeepEqual(a.map((q) => q.id), b.map((q) => q.id));
    assert.equal(a.length, 25);
    assert.equal(new Set(a.map((q) => q.id)).size, 25);
  });

  it('maps attempt states to the required Arabic labels', () => {
    assert.equal(resolveAttemptStatus(null).label_ar, 'لم يبدأ');
    assert.equal(resolveAttemptStatus({ submitted_at: null }).label_ar, 'قيد التقديم');
    assert.equal(
      resolveAttemptStatus({
        submitted_at: new Date(),
        grading_details: [{ gradingStatus: 'pending_manual' }],
      }).label_ar,
      'تم التسليم'
    );
    assert.equal(
      resolveAttemptStatus({ submitted_at: new Date(), grading_details: [{ gradingStatus: 'auto_graded' }] })
        .label_ar,
      'تم التصحيح'
    );
    assert.equal(resolveAttemptStatus(null, 80).label_ar, 'تم التصحيح');
  });

  it('parses settings JSON so students see Arabic description rather than raw JSON', () => {
    const parsed = parseAssessmentDescription(serializeDescription());
    assert.equal(parsed.settings.template_id, TEMPLATE_ID);
    assert.match(parsed.body, /تقييم بعدي/);
    assert.equal(parsed.body.startsWith('{'), false);
  });
});

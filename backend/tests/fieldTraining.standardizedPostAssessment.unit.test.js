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
  validateStoredAssessmentCopy,
  toStorageQuestions,
  shuffleQuestionsForStudent,
  sanitizeStudentQuestions,
  studentPayloadLeaksAnswers,
  verifyAutomaticGrading,
  buildAdminAnswerKey,
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
    assert.deepEqual(result.positionCounts, [7, 6, 6, 6]);
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

  it('exposes a string correct_answer to the admin editor so completeness does not stringify objects', () => {
    const { toAdminQuestionDto, toStudentQuestionDto } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
    const stored = toStorageQuestions()[0];
    const admin = toAdminQuestionDto({
      id: 'q-admin',
      assessment_id: 'a1',
      ...stored,
    });
    assert.equal(typeof admin.correct_answer, 'string');
    assert.equal(admin.correct_answer, stored.correct_answer.answer);
    assert.ok(admin.options.includes(admin.correct_answer));
    assert.equal(typeof admin.explanation, 'string');
    const student = toStudentQuestionDto({
      id: 'q-student',
      assessment_id: 'a1',
      ...stored,
    });
    assert.equal(student.correct_answer, undefined);
    assert.equal(student.explanation, undefined);
    assert.equal(student.options.length, 4);
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

  it('auto-grades 25/24/15/14 correct answers and never scores blank or invalid options', () => {
    const stored = toStorageQuestions();
    const storedCheck = validateStoredAssessmentCopy(
      stored.map((q, i) => ({ ...q, id: `q-${i}`, question_type: 'multiple_choice' }))
    );
    assert.equal(storedCheck.ok, true);
    const result = verifyAutomaticGrading(stored);
    assert.equal(typeof result, 'object');
    assert.equal(result.allCorrect, 100);
    assert.equal(result.twentyFourCorrect, 96);
    assert.equal(result.fifteenCorrect, 60);
    assert.equal(result.fourteenCorrect, 56);
    assert.equal(result.passAtSixty, true);
    assert.equal(result.failAtFiftySix, true);
    assert.equal(result.blankAndInvalidZero, true);
    assert.equal(result.shufflePreservesMapping, true);
  });

  it('strips correct answers from the student payload and keeps mapping after shuffle', () => {
    const stored = toStorageQuestions().map((q, i) => ({ ...q, id: `q-${i}` }));
    const studentView = shuffleQuestionsForStudent(stored, {
      studentId: 's1',
      assessmentId: 'a1',
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    assert.equal(studentPayloadLeaksAnswers(studentView), false);
    assert.equal(studentView.every((q) => q.options.length === 4), true);
    const answers = {};
    for (const sq of studentView) {
      const original = stored.find((q) => q.id === sq.id);
      const correct = normalizeCorrectAnswer(original.question_type, original.correct_answer, original.options);
      assert.ok(sq.options.includes(correct));
      answers[sq.id] = correct;
    }
    const graded = gradeAnswers(stored, answers);
    assert.equal(graded.scorePercent, 100);
    assert.equal(sanitizeStudentQuestions(stored).every((q) => q.correct_answer == null), true);
  });

  it('builds a complete admin answer key with one correct option per question', () => {
    const key = buildAdminAnswerKey();
    assert.equal(key.length, 25);
    const letters = { أ: 0, ب: 0, ج: 0, د: 0 };
    for (const row of key) {
      assert.equal(row.options.length, 4);
      assert.ok(['أ', 'ب', 'ج', 'د'].includes(row.correct_option));
      assert.equal(row.options.find((opt) => opt.letter === row.correct_option).text, row.correct_answer_text);
      assert.ok(String(row.explanation || '').length > 8);
      letters[row.correct_option] += 1;
    }
    assert.deepEqual(letters, { أ: 7, ب: 6, ج: 6, د: 6 });
  });
});

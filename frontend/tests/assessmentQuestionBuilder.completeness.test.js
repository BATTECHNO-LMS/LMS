/**
 * Assessment editor completeness: MCQ answers stored as { answer, explanation }.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countIncompleteQuestions,
  hydrateQuestionFromApi,
  isQuestionIncomplete,
  resolveMcqCorrectAnswer,
  serializeQuestionForApi,
} from '../src/pages/admin/fieldTraining/components/manage/assessmentQuestionBuilder.utils.js';

const OPTIONS = [
  'استخدام عنصر label مع الخاصية for المطابقة لمعرّف الحقل',
  'وضع النص بجانب الحقل دون ربط برمجي بين التسمية والإدخال',
  'الاعتماد على اللون فقط لتمييز الحقل المطلوب من المستخدم',
  'وضع النص داخل عنصر div فوق الحقل دون ربط دلالي',
];
const CORRECT = OPTIONS[0];

describe('assessment question builder completeness', () => {
  it('treats { answer, explanation } as complete after hydrate, not as [object Object]', () => {
    const raw = {
      id: 'q1',
      question_text: 'في صفحة تسجيل دخول، ما الاستخدام الأدق لربط تسمية الحقل بمربع الإدخال لتحسين إمكانية الوصول؟',
      question_type: 'multiple_choice',
      options: OPTIONS,
      correct_answer: { answer: CORRECT, explanation: 'ربط label عبر for/id.' },
      points: 4,
      is_required: true,
    };
    assert.equal(String(raw.correct_answer), '[object Object]');
    assert.equal(isQuestionIncomplete(raw), false);
    const hydrated = hydrateQuestionFromApi(raw);
    assert.equal(hydrated.correct_answer, CORRECT);
    assert.equal(hydrated.explanation.includes('label'), true);
    assert.equal(isQuestionIncomplete(hydrated), false);
    assert.equal(countIncompleteQuestions([hydrated]), 0);
  });

  it('resolves the correct option from option objects with isCorrect', () => {
    const raw = {
      question_text: 'سؤال',
      question_type: 'multiple_choice',
      points: 4,
      options: [
        { id: 'a', text: 'أ', isCorrect: false },
        { id: 'b', text: 'ب', isCorrect: true },
        { id: 'c', text: 'ج', isCorrect: false },
        { id: 'd', text: 'د', isCorrect: false },
      ],
      correct_answer: null,
    };
    assert.equal(resolveMcqCorrectAnswer(raw), 'ب');
    const hydrated = hydrateQuestionFromApi(raw);
    assert.deepEqual(hydrated.options, ['أ', 'ب', 'ج', 'د']);
    assert.equal(hydrated.correct_answer, 'ب');
    assert.equal(isQuestionIncomplete(hydrated), false);
  });

  it('round-trips explanation through serialize so auto-grade still finds the option text', () => {
    const hydrated = hydrateQuestionFromApi({
      question_text: 'سؤال',
      question_type: 'multiple_choice',
      options: OPTIONS,
      correct_answer: { answer: CORRECT, explanation: 'شرح داخلي للمراجع' },
      points: 4,
      is_required: true,
    });
    const payload = serializeQuestionForApi(hydrated, 0);
    assert.deepEqual(payload.options, OPTIONS);
    assert.equal(payload.correct_answer.answer, CORRECT);
    assert.equal(payload.correct_answer.explanation, 'شرح داخلي للمراجع');
  });
});

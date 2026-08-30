/**
 * Standardized field-training post-assessment UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {
  countIncompleteQuestions,
  hydrateQuestionFromApi,
  isQuestionIncomplete,
  serializeQuestionForApi,
} from '../src/pages/admin/fieldTraining/components/manage/assessmentQuestionBuilder.utils.js';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training post-assessment UI', () => {
  it('shows the four Arabic attempt states and saves progress', () => {
    const tab = readSrc('../src/pages/student/fieldTraining/components/StudentAssessmentsTab.jsx');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    assert.match(ar, /"statusNotStarted": "لم يبدأ"/);
    assert.match(ar, /"statusInProgress": "قيد التقديم"/);
    assert.match(ar, /"statusSubmitted": "تم التسليم"/);
    assert.match(ar, /"statusGraded": "تم التصحيح"/);
    assert.match(tab, /saveStudentAssessmentProgress/);
    assert.match(tab, /dir="rtl"/);
    assert.match(service, /assessments\/\$\{type\}\/save/);
  });

  it('marks stored MCQ answers as complete when correct_answer is { answer, explanation }', () => {
    const hydrated = hydrateQuestionFromApi({
      id: 'q1',
      question_text: 'ما الرمز المناسب لإنشاء مورد؟',
      question_type: 'multiple_choice',
      options: ['200', '201 Created', '404', '500'],
      correct_answer: { answer: '201 Created', explanation: '201 هو رمز الإنشاء.' },
      points: 4,
      is_required: true,
    });
    assert.equal(hydrated.correct_answer, '201 Created');
    assert.equal(hydrated.explanation, '201 هو رمز الإنشاء.');
    assert.equal(isQuestionIncomplete(hydrated), false);
    assert.equal(countIncompleteQuestions([hydrated]), 0);
    const saved = serializeQuestionForApi(hydrated, 0);
    assert.equal(saved.correct_answer.answer, '201 Created');
    assert.equal(saved.correct_answer.explanation, '201 هو رمز الإنشاء.');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAssessmentDateTime,
  looksLikeRawIsoDate,
  parseAssessmentDate,
} from '../src/features/training/assessmentPresentation/assessmentDate.js';
import {
  buildAssessmentMetrics,
  mapTraineeAssessment,
  resolveAssessmentUiState,
} from '../src/features/training/assessmentPresentation/mapTraineeAssessment.js';

const SAMPLE = {
  id: 'a1',
  title: 'الاختبار القبلي – اجتياز مقابلات العمل',
  kind: 'PRE_TEST',
  type: 'pre',
  durationMinutes: 20,
  questionCount: 20,
  attemptsUsed: 1,
  attemptsAllowed: 1,
  passScore: 60,
  passingScore: 60,
  opensAt: '2026-08-02T06:00:00.000Z',
  closesAt: '2026-08-03T15:00:00.000Z',
  availability: 'available',
  showResults: true,
  showCorrectAnswers: false,
  instructions:
    'يتكون الاختبار من 20 سؤالًا من نوع الاختيار من متعدد حول موضوع اجتياز مقابلات العمل.',
  latestResult: {
    score: 85,
    status: 'GRADED',
    pendingManual: false,
  },
  activeAttemptId: null,
};

describe('assessmentDate', () => {
  it('formats Jordan timezone Arabic datetime without raw ISO fragments', () => {
    const label = formatAssessmentDateTime('2026-08-02T06:00:00.000Z');
    assert.equal(looksLikeRawIsoDate(label), false);
    assert.doesNotMatch(label, /T/);
    assert.match(label, /2026/);
    assert.match(label, /2/);
    // ar-JO may render August as آب or أغسطس depending on ICU data
    assert.ok(/آب|أغسطس/.test(label), `unexpected month in: ${label}`);
  });

  it('formats opening/closing seed window in Asia/Amman', () => {
    const opens = formatAssessmentDateTime('2026-08-02T06:00:00.000Z');
    const closes = formatAssessmentDateTime('2026-08-03T15:00:00.000Z');
    assert.equal(looksLikeRawIsoDate(opens), false);
    assert.equal(looksLikeRawIsoDate(closes), false);
    assert.doesNotMatch(opens, /02T00:00|02T06:00/);
    assert.doesNotMatch(closes, /03T15:00|03T06:00/);
  });

  it('handles null dates safely', () => {
    assert.equal(formatAssessmentDateTime(null), 'غير محدد');
    assert.equal(formatAssessmentDateTime(''), 'غير محدد');
    assert.equal(formatAssessmentDateTime('not-a-date'), 'غير محدد');
  });

  it('does not shift date-only calendar days', () => {
    const parsed = parseAssessmentDate('2026-08-02');
    assert.equal(parsed.kind, 'date-only');
    assert.equal(parsed.year, 2026);
    assert.equal(parsed.month, 8);
    assert.equal(parsed.day, 2);
    const label = formatAssessmentDateTime('2026-08-02');
    assert.match(label, /2/);
    assert.match(label, /2026/);
    assert.doesNotMatch(label, /1 أغسطس|3 أغسطس/);
  });
});

describe('mapTraineeAssessment', () => {
  it('maps title, pre-test badge, metrics, and passed result', () => {
    const mapped = mapTraineeAssessment(SAMPLE, {
      courseTitle: 'اجتياز مقابلات العمل',
      programType: 'TRAINING_COURSE',
    });
    assert.equal(mapped.title, SAMPLE.title);
    assert.equal(mapped.typeBadgeLabel, 'اختبار قبلي');
    assert.equal(mapped.durationMinutes, 20);
    assert.equal(mapped.questionCount, 20);
    assert.equal(mapped.attemptsUsed, 1);
    assert.equal(mapped.attemptsAllowed, 1);
    assert.equal(mapped.passScore, 60);
    assert.equal(mapped.score, 85);
    assert.equal(mapped.passed, true);
    assert.equal(mapped.exhausted, true);
    assert.equal(mapped.statusBadge.label, 'مكتمل');
    assert.equal(mapped.action.type, 'exhausted');
    assert.equal(mapped.resultMode, 'completed');
    assert.equal(mapped.showCorrectAnswers, false);
    assert.equal(looksLikeRawIsoDate(mapped.opensAtLabel), false);
    assert.equal(looksLikeRawIsoDate(mapped.closesAtLabel), false);

    const metrics = buildAssessmentMetrics(mapped);
    assert.deepEqual(
      metrics.map((m) => m.value),
      ['20 دقيقة', '20 سؤالًا', '1 من 1', '60%']
    );
  });

  it('hides score when showResults is false', () => {
    const mapped = mapTraineeAssessment({
      ...SAMPLE,
      showResults: false,
      latestResult: { status: 'GRADED', pendingManual: false },
    });
    assert.equal(mapped.score, null);
    assert.equal(mapped.passed, null);
  });

  it('does not invent default duration/questions/attempts/pass score', () => {
    const mapped = mapTraineeAssessment({
      id: 'x',
      title: 'اختبار',
      kind: 'PRE_TEST',
      availability: 'available',
    });
    assert.equal(mapped.durationMinutes, null);
    assert.equal(mapped.questionCount, null);
    assert.equal(mapped.attemptsAllowed, null);
    assert.equal(mapped.passScore, null);
    const metrics = buildAssessmentMetrics(mapped);
    assert.equal(metrics.find((m) => m.key === 'duration').value, '—');
    assert.equal(metrics.find((m) => m.key === 'questions').value, '—');
    assert.equal(metrics.find((m) => m.key === 'passScore').value, '—');
  });

  it('supports not-started start action', () => {
    const mapped = mapTraineeAssessment({
      ...SAMPLE,
      attemptsUsed: 0,
      latestResult: null,
      activeAttemptId: null,
    });
    assert.equal(mapped.action.type, 'start');
    assert.equal(mapped.action.label, 'بدء الاختبار');
    assert.equal(mapped.statusBadge.label, 'متاح');
    assert.equal(mapped.resultMode, 'none');
  });

  it('supports active attempt resume', () => {
    const mapped = mapTraineeAssessment({
      ...SAMPLE,
      attemptsUsed: 0,
      latestResult: null,
      activeAttemptId: 'att-1',
    });
    assert.equal(mapped.action.type, 'resume');
    assert.equal(mapped.action.label, 'متابعة الاختبار');
  });

  it('supports upcoming / closed / prerequisites / pending / retry states', () => {
    assert.equal(
      mapTraineeAssessment({
        ...SAMPLE,
        attemptsUsed: 0,
        latestResult: null,
        availability: 'ASSESSMENT_NOT_AVAILABLE',
      }).action.type,
      'not_open'
    );
    assert.equal(
      mapTraineeAssessment({
        ...SAMPLE,
        attemptsUsed: 0,
        latestResult: null,
        availability: 'ASSESSMENT_CLOSED',
      }).statusBadge.label,
      'مغلق'
    );
    assert.equal(
      mapTraineeAssessment({
        ...SAMPLE,
        attemptsUsed: 0,
        latestResult: null,
        availability: 'ASSESSMENT_PREREQUISITES_INCOMPLETE',
      }).action.type,
      'prerequisites'
    );
    assert.equal(
      mapTraineeAssessment({
        ...SAMPLE,
        attemptsUsed: 1,
        exhausted: true,
        latestResult: { status: 'SUBMITTED', pendingManual: true },
      }).statusBadge.label,
      'بانتظار التصحيح'
    );
    assert.equal(
      mapTraineeAssessment({
        ...SAMPLE,
        attemptsUsed: 1,
        attemptsAllowed: 2,
        latestResult: { score: 45, status: 'GRADED', pendingManual: false },
      }).action.type,
      'retry'
    );
  });

  it('marks failed completed result when score below pass score', () => {
    const mapped = mapTraineeAssessment({
      ...SAMPLE,
      latestResult: { score: 45, status: 'GRADED', pendingManual: false },
    });
    assert.equal(mapped.passed, false);
    assert.equal(mapped.score, 45);
  });

  it('keeps FIELD_TRAINING programType as presentation context only', () => {
    const mapped = mapTraineeAssessment(SAMPLE, { programType: 'FIELD_TRAINING' });
    assert.equal(mapped.programType, 'FIELD_TRAINING');
    assert.equal(mapped.durationMinutes, 20);
  });
});

describe('resolveAssessmentUiState', () => {
  it('does not expose a start button when attempts are exhausted', () => {
    const state = resolveAssessmentUiState({
      availability: 'available',
      canResume: false,
      exhausted: true,
      hasCompletedAttempt: true,
      pendingManual: false,
      opensAt: null,
    });
    assert.equal(state.action.type, 'exhausted');
    assert.notEqual(state.action.type, 'start');
  });
});

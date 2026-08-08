'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  RATING_LABELS_AR,
  npsCategory,
  average,
  filterQuestionsForDeliveryMode,
  computeSectionScores,
} = require('../src/modules/trainingPrograms/trainingEvaluation.scoring');

describe('trainingEvaluation.scoring npsCategory', () => {
  it('classifies 9-10 as PROMOTER', () => {
    assert.equal(npsCategory(9), 'PROMOTER');
    assert.equal(npsCategory(10), 'PROMOTER');
  });
  it('classifies 7-8 as PASSIVE', () => {
    assert.equal(npsCategory(7), 'PASSIVE');
    assert.equal(npsCategory(8), 'PASSIVE');
  });
  it('classifies 0-6 as DETRACTOR', () => {
    assert.equal(npsCategory(0), 'DETRACTOR');
    assert.equal(npsCategory(6), 'DETRACTOR');
  });
  it('returns null for non-numeric input', () => {
    assert.equal(npsCategory(null), null);
    assert.equal(npsCategory(undefined), null);
    assert.equal(npsCategory('abc'), null);
  });
});

describe('trainingEvaluation.scoring average', () => {
  it('averages numeric values and rounds to 2 decimals', () => {
    assert.equal(average([1, 2, 3]), 2);
    assert.equal(average([1, 2]), 1.5);
    assert.equal(average([5, 5, 4]), 4.67);
  });
  it('ignores null/undefined/non-numeric entries', () => {
    assert.equal(average([1, null, 3, undefined, NaN]), 2);
  });
  it('returns null when there is no numeric input', () => {
    assert.equal(average([]), null);
    assert.equal(average([null, undefined]), null);
  });
});

describe('trainingEvaluation.scoring filterQuestionsForDeliveryMode', () => {
  const onsiteOnly = { id: 'q1', delivery_modes_json: ['ONSITE'] };
  const virtualOnly = { id: 'q2', delivery_modes_json: ['VIRTUAL'] };
  const both = { id: 'q3', delivery_modes_json: ['ONSITE', 'VIRTUAL'] };
  const universal = { id: 'q4', delivery_modes_json: null };
  const questions = [onsiteOnly, virtualOnly, both, universal];

  it('keeps questions with no delivery mode restriction regardless of mode', () => {
    const out = filterQuestionsForDeliveryMode([universal], 'ONSITE');
    assert.deepEqual(out.map((q) => q.id), ['q4']);
  });

  it('filters to only questions matching the onsite delivery mode', () => {
    const out = filterQuestionsForDeliveryMode(questions, 'onsite');
    assert.deepEqual(
      out.map((q) => q.id).sort(),
      ['q1', 'q3', 'q4'].sort()
    );
  });

  it('filters to only questions matching the virtual delivery mode', () => {
    const out = filterQuestionsForDeliveryMode(questions, 'VIRTUAL');
    assert.deepEqual(
      out.map((q) => q.id).sort(),
      ['q2', 'q3', 'q4'].sort()
    );
  });

  it('returns every question when no delivery mode is given', () => {
    const out = filterQuestionsForDeliveryMode(questions, null);
    assert.equal(out.length, questions.length);
  });
});

describe('trainingEvaluation.scoring computeSectionScores', () => {
  const questions = [
    { id: 'trainer-1', code: 'TRAINER_CLARITY', question_type: 'RATING_SCALE', section_code: 'TRAINER' },
    { id: 'trainer-2', code: 'TRAINER_INTERACTION', question_type: 'RATING_SCALE', section_code: 'TRAINER' },
    { id: 'content-1', code: 'CONTENT_QUALITY', question_type: 'RATING_SCALE', section_code: 'CONTENT' },
    { id: 'activities-1', code: 'ACTIVITIES_USEFUL', question_type: 'RATING_SCALE', section_code: 'ACTIVITIES' },
    { id: 'venue-1', code: 'V_IP_1', question_type: 'RATING_SCALE', section_code: 'VENUE_ORG' },
    { id: 'tech-1', code: 'V_ON_1', question_type: 'RATING_SCALE', section_code: 'VENUE_ORG' },
    { id: 'org-1', code: 'V_HY_1', question_type: 'RATING_SCALE', section_code: 'VENUE_ORG' },
    { id: 'impact-1', code: 'IMPACT_JOB', question_type: 'RATING_SCALE', section_code: 'IMPACT' },
    { id: 'nps-1', code: 'NPS_RECOMMEND', question_type: 'NPS', section_code: 'NPS_FEEDBACK' },
    { id: 'open-1', code: 'OPEN_FEEDBACK', question_type: 'OPEN_TEXT', section_code: 'IMPACT' },
  ];

  const answers = {
    'trainer-1': { value: 5 },
    'trainer-2': { value: 4 },
    'content-1': { value: 4 },
    'activities-1': { value: 3 },
    'venue-1': { value: 4 },
    'tech-1': { value: 5 },
    'org-1': { value: 3 },
    'impact-1': { value: 4 },
    'nps-1': { value: 9 },
    'open-1': { text: 'كان تدريبًا مفيدًا' },
  };

  it('computes per-section averages using RATING_SCALE questions only', () => {
    const scores = computeSectionScores(questions, answers);
    assert.equal(scores.trainer_score, 4.5);
    assert.equal(scores.content_score, 4);
    assert.equal(scores.activities_score, 3);
    assert.equal(scores.immediate_impact_score, 4);
  });

  it('splits the VENUE_ORG section by code prefix into venue/technical/organization scores', () => {
    const scores = computeSectionScores(questions, answers);
    assert.equal(scores.venue_score, 4);
    assert.equal(scores.technical_environment_score, 5);
    assert.equal(scores.organization_score, 3);
  });

  it('computes an overall reaction score blended across all rating components', () => {
    const scores = computeSectionScores(questions, answers);
    assert.equal(
      scores.overall_reaction_score,
      average([4.5, 4, 3, 4, 5, 3, 4])
    );
  });

  it('derives NPS score and category from the NPS question', () => {
    const scores = computeSectionScores(questions, answers);
    assert.equal(scores.nps_score, 9);
    assert.equal(scores.nps_category, 'PROMOTER');
  });

  it('returns nulls when no answers are provided', () => {
    const scores = computeSectionScores(questions, {});
    assert.equal(scores.trainer_score, null);
    assert.equal(scores.nps_score, null);
    assert.equal(scores.nps_category, null);
  });

  it('exposes the Arabic rating labels for a 1-5 scale', () => {
    assert.equal(RATING_LABELS_AR[1], 'لا أوافق بشدة');
    assert.equal(RATING_LABELS_AR[5], 'أوافق بشدة');
    assert.equal(Object.keys(RATING_LABELS_AR).length, 5);
  });
});

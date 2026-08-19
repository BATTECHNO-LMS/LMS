'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  COURSE_CODE,
  COURSE_TITLE_AR,
  TEMPLATE_CODE,
  TEMPLATE_TITLE,
  ORG_CODE,
  RATING_LABELS,
  buildSectionsDef,
  validateVisibleSet,
} = require('../scripts/seed-cpf-linkedin-cv-evaluation');

const { computeSectionScores, buildRatingDistribution, KIRKPATRICK } = require('../src/modules/trainingPrograms/trainingEvaluation.scoring');
const { computeNps } = require('../src/modules/trainingPrograms/trainingReportMetrics.service');

describe('CPF LinkedIn & CV final evaluation seed spec', () => {
  it('uses the stable course and evaluation codes', () => {
    assert.equal(ORG_CODE, 'CROWN_PRINCE_FOUNDATION');
    assert.equal(COURSE_CODE, 'CPF-LINKEDIN-CV-2026');
    assert.equal(COURSE_TITLE_AR, 'LinkedIn وكتابة السيرة الذاتية CV');
    assert.equal(TEMPLATE_CODE, 'CPF-LINKEDIN-CV-2026-FINAL-EVALUATION');
    assert.equal(TEMPLATE_TITLE, 'التقييم النهائي – LinkedIn وكتابة السيرة الذاتية CV');
  });

  it('has exactly 28 visible questions per delivery mode', () => {
    const flat = buildSectionsDef().flatMap((s) => s.questions.map((q) => ({ ...q, section_code: s.code })));
    for (const mode of ['ONLINE', 'IN_PERSON', 'HYBRID']) {
      const vis = validateVisibleSet(flat, mode);
      assert.equal(vis.count, 28, mode);
      assert.equal(vis.ratingCount, 25, mode);
      assert.equal(vis.npsCount, 1, mode);
      assert.equal(vis.openCount, 2, mode);
      assert.equal(vis.openOptional, true, mode);
    }
  });

  it('uses a 1-5 rating scale with the specified Arabic labels', () => {
    assert.equal(RATING_LABELS[1], 'لا أوافق بشدة');
    assert.equal(RATING_LABELS[2], 'لا أوافق');
    assert.equal(RATING_LABELS[3], 'محايد');
    assert.equal(RATING_LABELS[4], 'أوافق');
    assert.equal(RATING_LABELS[5], 'أوافق بشدة');
  });

  it('computes trainer/content/activities/impact scores from the LinkedIn sections', () => {
    const sections = buildSectionsDef();
    const questions = [];
    const answers = {};
    let i = 0;
    for (const section of sections) {
      for (const q of section.questions) {
        if (q.delivery_modes_json && !q.delivery_modes_json.includes('ONLINE')) continue;
        const id = `q${i}`;
        i += 1;
        questions.push({
          id,
          code: q.code,
          question_type: q.question_type,
          section_code: section.code,
        });
        if (q.question_type === 'RATING_SCALE') answers[id] = { value: 5 };
        if (q.question_type === 'NPS') answers[id] = { value: 10 };
      }
    }
    const scores = computeSectionScores(questions, answers);
    assert.equal(scores.trainer_score, 5);
    assert.equal(scores.content_score, 5);
    assert.equal(scores.activities_score, 5);
    assert.equal(scores.technical_environment_score, 5);
    assert.equal(scores.immediate_impact_score, 5);
    assert.equal(scores.nps_score, 10);
    assert.equal(scores.nps_category, 'PROMOTER');
  });

  it('keeps Kirkpatrick Level 1 separate from Level 2', () => {
    assert.equal(KIRKPATRICK.FINAL_EVALUATION, 'LEVEL_1_REACTION');
    assert.equal(KIRKPATRICK.PRE_POST_TESTS, 'LEVEL_2_LEARNING');
    assert.equal(KIRKPATRICK.FOLLOW_UP_BEHAVIOR, 'LEVEL_3_RESERVED');
    assert.equal(KIRKPATRICK.FOLLOW_UP_RESULTS, 'LEVEL_4_RESERVED');
  });
});

describe('rating distribution and NPS formula', () => {
  it('reports counts and percentages for 1-5', () => {
    const dist = buildRatingDistribution([5, 5, 5, 4, 4, 3, 2, 1, 5, 5]);
    assert.equal(dist.n, 10);
    assert.equal(dist.counts[5], 5);
    assert.equal(dist.percentages[5], 50);
    assert.equal(dist.percentages[4], 20);
  });

  it('returns NPS 40 for 6 promoters, 2 passives, 2 detractors', () => {
    const out = computeNps([10, 9, 9, 9, 9, 9, 8, 7, 6, 0]);
    assert.equal(out.index, 40);
  });
});

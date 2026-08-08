'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  stripHtml,
  scoreArticle,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  TOUR_STEP_COUNT,
} = require('../src/modules/help/help.service');
const {
  onboardingProgressBodySchema,
  supportTicketBodySchema,
} = require('../src/modules/help/help.validation');
const { CATEGORIES, ARTICLES } = require('../scripts/seed-help-content');

test('guide version and tour step count are stable', () => {
  assert.strictEqual(FIELD_TRAINING_STUDENT_GUIDE_VERSION, 'FIELD_TRAINING_STUDENT_V1');
  assert.strictEqual(TOUR_STEP_COUNT, 8);
});

test('stripHtml removes script and javascript handlers', () => {
  const cleaned = stripHtml('<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>');
  assert.doesNotMatch(cleaned, /<script/i);
  assert.doesNotMatch(cleaned, /javascript:/i);
  assert.match(cleaned, /ok/);
});

test('scoreArticle ranks title and keywords higher', () => {
  const article = {
    title_ar: 'كيف أسجل الحضور برمز',
    summary_ar: 'شرح قصير',
    content_ar: 'تفاصيل الحضور في الجلسة',
    keywords: ['حضور', 'رمز'],
  };
  const high = scoreArticle(article, ['حضور', 'رمز']);
  const low = scoreArticle(article, ['شهادة']);
  assert.ok(high > low);
  assert.ok(high >= 10);
});

test('seed content has unique slugs and twelve categories', () => {
  assert.strictEqual(CATEGORIES.length, 12);
  const catSlugs = new Set(CATEGORIES.map((c) => c.slug));
  assert.strictEqual(catSlugs.size, CATEGORIES.length);
  const artSlugs = new Set(ARTICLES.map((a) => a.slug));
  assert.strictEqual(artSlugs.size, ARTICLES.length);
  for (const a of ARTICLES) {
    assert.ok(catSlugs.has(a.category_slug), `missing category ${a.category_slug}`);
  }
});

test('onboarding progress schema accepts last_step', () => {
  const parsed = onboardingProgressBodySchema.parse({ last_step: 3 });
  assert.strictEqual(parsed.last_step, 3);
});

test('support ticket schema requires title and description', () => {
  assert.throws(() =>
    supportTicketBodySchema.parse({
      category: 'ATTENDANCE',
      title: 'ab',
      description: 'short',
    })
  );
  const ok = supportTicketBodySchema.parse({
    category: 'ATTENDANCE',
    title: 'رمز الحضور لا يعمل',
    description: 'حاولت إدخال الرمز أكثر من مرة أثناء النافذة المفتوحة.',
  });
  assert.strictEqual(ok.category, 'ATTENDANCE');
});

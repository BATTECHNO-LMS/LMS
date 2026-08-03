import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING_LABELS_AR,
  npsCategory,
  ratingScaleOptions,
  resolveRatingLabel,
} from '../src/features/training/components/evaluation/ratingLabels.js';

describe('ratingLabels', () => {
  it('exposes the standard 1-5 Arabic Likert labels', () => {
    assert.equal(RATING_LABELS_AR[1], 'لا أوافق بشدة');
    assert.equal(RATING_LABELS_AR[3], 'محايد');
    assert.equal(RATING_LABELS_AR[5], 'أوافق بشدة');
  });

  it('resolves default labels for numeric and string keys', () => {
    assert.equal(resolveRatingLabel(1), 'لا أوافق بشدة');
    assert.equal(resolveRatingLabel('4'), 'أوافق');
    assert.equal(resolveRatingLabel(null), '');
    assert.equal(resolveRatingLabel(undefined), '');
  });

  it('prefers custom scale labels when provided, falling back for missing keys', () => {
    const custom = { 1: 'ضعيف جدًا', 5: 'ممتاز' };
    assert.equal(resolveRatingLabel(1, custom), 'ضعيف جدًا');
    assert.equal(resolveRatingLabel(5, custom), 'ممتاز');
    // Falls back to the default Arabic label when the custom map omits a key.
    assert.equal(resolveRatingLabel(3, custom), 'محايد');
  });

  it('builds an inclusive numeric range for the rating scale', () => {
    assert.deepEqual(ratingScaleOptions(), [1, 2, 3, 4, 5]);
    assert.deepEqual(ratingScaleOptions(1, 3), [1, 2, 3]);
    assert.deepEqual(ratingScaleOptions(0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('buckets NPS scores using the classic 0-10 thresholds', () => {
    assert.equal(npsCategory(10), 'PROMOTER');
    assert.equal(npsCategory(9), 'PROMOTER');
    assert.equal(npsCategory(8), 'PASSIVE');
    assert.equal(npsCategory(7), 'PASSIVE');
    assert.equal(npsCategory(6), 'DETRACTOR');
    assert.equal(npsCategory(0), 'DETRACTOR');
    assert.equal(npsCategory(null), null);
    assert.equal(npsCategory(''), null);
  });
});

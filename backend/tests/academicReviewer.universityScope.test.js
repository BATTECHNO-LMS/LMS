'use strict';

/**
 * Characterization: university scope must resolve from primary_university_id
 * even when camelCase universityId is absent (frontend mapper contract).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function resolveAuthUniversityId(user) {
  if (!user || typeof user !== 'object') return null;
  const candidates = [
    user.universityId,
    user.primary_university_id,
    user.primaryUniversityId,
    user.scope?.universityId,
    user.university?.id,
    user.primary_university?.id,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

describe('academic reviewer university scope contract', () => {
  it('resolves university from primary_university_id when universityId missing', () => {
    const uni = '00ae388d-4f99-4855-a1cc-42f6cd417e63';
    assert.equal(
      resolveAuthUniversityId({
        roles: ['academic_reviewer'],
        primary_university_id: uni,
        university: { id: uni, name: 'جامعة باتيوني' },
      }),
      uni
    );
  });

  it('prefers universityId when present', () => {
    assert.equal(
      resolveAuthUniversityId({
        universityId: 'aaa',
        primary_university_id: 'bbb',
      }),
      'aaa'
    );
  });

  it('returns null when no university fields', () => {
    assert.equal(resolveAuthUniversityId({ roles: ['academic_reviewer'] }), null);
  });
});

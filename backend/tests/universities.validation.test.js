const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmailDomain } = require('../src/utils/normalizeEmailDomain');
const {
  createUniversityBodySchema,
  updateUniversityBodySchema,
} = require('../src/modules/universities/universities.validation');

describe('normalizeEmailDomain', () => {
  test('strips protocol, www, path, and lowercases', () => {
    assert.equal(normalizeEmailDomain('HTTPS://WWW.Mutah.edu.jo/path'), 'mutah.edu.jo');
  });

  test('rejects empty / invalid', () => {
    assert.equal(normalizeEmailDomain(''), null);
    assert.equal(normalizeEmailDomain('not a domain'), null);
    assert.equal(normalizeEmailDomain('localhost'), null);
  });
});

describe('universities validation', () => {
  test('accepts create with domains and specialties', () => {
    const parsed = createUniversityBodySchema.safeParse({
      name: 'جامعة مؤتة',
      name_en: 'Mutah University',
      code: 'MUT',
      email_domains: [
        { domain: 'https://mutah.edu.jo/', is_active: true, is_primary: true },
        { domain: 'ttu.edu.jo', is_active: true, is_primary: false },
      ],
      specialties: [
        { name_ar: 'هندسة برمجيات', name_en: 'Software Engineering', code: 'se', status: 'active' },
      ],
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.email_domains[0].domain, 'mutah.edu.jo');
    assert.equal(parsed.data.specialties[0].code, 'SE');
  });

  test('rejects duplicate domains in same payload', () => {
    const parsed = createUniversityBodySchema.safeParse({
      name: 'جامعة تجريبية',
      email_domains: [
        { domain: 'htu.edu.jo', is_active: true },
        { domain: 'HTU.EDU.JO', is_active: true },
      ],
    });
    assert.equal(parsed.success, false);
  });

  test('rejects two primary domains', () => {
    const parsed = updateUniversityBodySchema.safeParse({
      email_domains: [
        { domain: 'a.edu.jo', is_primary: true, is_active: true },
        { domain: 'b.edu.jo', is_primary: true, is_active: true },
      ],
    });
    assert.equal(parsed.success, false);
  });
});

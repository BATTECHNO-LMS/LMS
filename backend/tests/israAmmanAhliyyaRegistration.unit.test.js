'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  REAL_UNIVERSITIES,
  SPECIALTY_CATALOG,
  UNIVERSITY_SPECIALTY_CATALOG,
} = require('../scripts/lib/baselineCatalog');

describe('Isra + Amman Ahliyya registration catalog', () => {
  it('includes both universities with student email domains', () => {
    const isra = REAL_UNIVERSITIES.find((u) => u.domain === 'iu.edu.jo');
    const ahliyya = REAL_UNIVERSITIES.find((u) => u.domain === 'ammanu.edu.jo');
    assert.ok(isra, 'Isra must be in REAL_UNIVERSITIES');
    assert.equal(isra.name, 'جامعة الإسراء');
    assert.ok(ahliyya, 'Amman Ahliyya must be in REAL_UNIVERSITIES');
    assert.equal(ahliyya.name, 'جامعة عمان الأهلية');
  });

  it('registers Isra Faculty of Business and Faculty of IT bachelor majors', () => {
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'iu.edu.jo');
    assert.equal(blocks.length, 2);
    const business = blocks.find((b) => b.collegeNameAr === 'كلية الأعمال');
    const it = blocks.find((b) => b.collegeNameAr === 'كلية تكنولوجيا المعلومات');
    assert.ok(business);
    assert.ok(it);
    assert.deepEqual(business.programs.map((p) => p.code).sort(), [
      'ACCOUNTING',
      'BUSINESS_ADMINISTRATION',
      'DIGITAL_LOGISTICS',
      'DIGITAL_MARKETING',
      'FINANCE_BANKING',
      'MANAGEMENT_INFORMATION_SYSTEMS',
    ]);
    assert.deepEqual(it.programs.map((p) => p.code).sort(), [
      'COMPUTER_INFORMATION_SYSTEMS',
      'COMPUTER_SCIENCE',
      'COMPUTER_SCIENCE_MULTIMEDIA',
      'COMPUTER_SCIENCE_NETWORKS',
      'CYBERSECURITY',
      'DATA_SCIENCE_AI',
      'SOFTWARE_ENGINEERING',
    ]);
  });

  it('does not attach Amman Ahliyya specialties until requested', () => {
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'ammanu.edu.jo');
    assert.equal(blocks.length, 0);
  });

  it('links Isra programs to global specialty codes', () => {
    const global = new Set(SPECIALTY_CATALOG.map((s) => s.code));
    for (const code of ['BA', 'ACC', 'FIN', 'MIS', 'DMKT', 'DLOG', 'CS', 'CIS', 'SWE', 'CYB', 'DS_AI', 'NET']) {
      assert.ok(global.has(code), `missing global specialty ${code}`);
    }
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'iu.edu.jo');
    for (const block of blocks) {
      for (const program of block.programs) {
        assert.ok(global.has(program.canonicalCode), `${program.code} → ${program.canonicalCode}`);
      }
    }
  });
});

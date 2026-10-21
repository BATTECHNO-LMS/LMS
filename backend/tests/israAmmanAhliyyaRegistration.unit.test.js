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

  it('registers only Isra Faculty of Business bachelor majors', () => {
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'iu.edu.jo');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].collegeNameAr, 'كلية الأعمال');
    const codes = blocks[0].programs.map((p) => p.code).sort();
    assert.deepEqual(codes, [
      'ACCOUNTING',
      'BUSINESS_ADMINISTRATION',
      'DIGITAL_LOGISTICS',
      'DIGITAL_MARKETING',
      'FINANCE_BANKING',
      'MANAGEMENT_INFORMATION_SYSTEMS',
    ]);
    const names = blocks[0].programs.map((p) => p.name_ar);
    assert.ok(names.includes('إدارة الأعمال'));
    assert.ok(names.includes('المحاسبة'));
    assert.ok(names.includes('الإدارة المالية والمصرفية'));
    assert.ok(names.includes('نظم المعلومات الإدارية'));
    assert.ok(names.includes('التسويق الرقمي'));
    assert.ok(names.includes('الإدارة اللوجستية والرقمية'));
    // No IT majors under Isra in this phase
    assert.ok(!names.some((n) => /حاسوب|سيبراني|برمجيات/.test(n)));
  });

  it('does not attach Amman Ahliyya specialties until requested', () => {
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'ammanu.edu.jo');
    assert.equal(blocks.length, 0);
  });

  it('links Isra business programs to global specialty codes', () => {
    const global = new Set(SPECIALTY_CATALOG.map((s) => s.code));
    for (const code of ['BA', 'ACC', 'FIN', 'MIS', 'DMKT', 'DLOG']) {
      assert.ok(global.has(code), `missing global specialty ${code}`);
    }
    const isra = UNIVERSITY_SPECIALTY_CATALOG.find((b) => b.universityDomain === 'iu.edu.jo');
    for (const program of isra.programs) {
      assert.ok(global.has(program.canonicalCode), `${program.code} → ${program.canonicalCode}`);
    }
  });
});

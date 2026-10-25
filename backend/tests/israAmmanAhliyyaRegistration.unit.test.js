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

  it('registers Amman Ahliyya Faculty of IT bachelor majors only', () => {
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'ammanu.edu.jo');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].collegeNameAr, 'كلية تقنية المعلومات');
    assert.equal(blocks[0].collegeNameEn, 'Faculty of Information Technology');
    assert.deepEqual(blocks[0].programs.map((p) => p.code).sort(), [
      'COMPUTER_SCIENCE',
      'DATA_SCIENCE_AI',
      'NETWORKS_AND_CYBERSECURITY',
      'SOFTWARE_ENGINEERING',
    ]);
    const byCode = Object.fromEntries(blocks[0].programs.map((p) => [p.code, p]));
    assert.equal(byCode.COMPUTER_SCIENCE.name_ar, 'علم الحاسوب');
    assert.equal(byCode.SOFTWARE_ENGINEERING.name_ar, 'هندسة البرمجيات');
    assert.equal(byCode.NETWORKS_AND_CYBERSECURITY.name_ar, 'الشبكات والأمن السيبراني');
    assert.equal(byCode.DATA_SCIENCE_AI.name_ar, 'علم البيانات والذكاء الاصطناعي');
    assert.equal(byCode.NETWORKS_AND_CYBERSECURITY.canonicalCode, 'CYB');
    assert.equal(byCode.DATA_SCIENCE_AI.canonicalCode, 'DS_AI');
  });

  it('includes Middle East University IT faculty majors', () => {
    const meu = REAL_UNIVERSITIES.find((u) => u.domain === 'meu.edu.jo');
    assert.ok(meu, 'MEU must be in REAL_UNIVERSITIES');
    assert.equal(meu.name, 'جامعة الشرق الأوسط');
    const blocks = UNIVERSITY_SPECIALTY_CATALOG.filter((b) => b.universityDomain === 'meu.edu.jo');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].collegeNameAr, 'كلية تكنولوجيا المعلومات');
    assert.deepEqual(blocks[0].programs.map((p) => p.code).sort(), [
      'COMPUTER_SCIENCE',
      'CYBERSECURITY',
      'DATA_SCIENCE_AI',
      'SOFTWARE_ENGINEERING',
    ]);
    const names = blocks[0].programs.map((p) => p.name_ar);
    assert.ok(names.includes('علم الحاسوب'));
    assert.ok(names.includes('هندسة البرمجيات'));
    assert.ok(names.includes('الأمن السيبراني'));
    assert.ok(names.includes('علم البيانات والذكاء الاصطناعي'));
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

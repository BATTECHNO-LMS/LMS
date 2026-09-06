'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  REAL_UNIVERSITIES,
  UNIVERSITY_SPECIALTY_CATALOG,
} = require('../scripts/lib/baselineCatalog');
const {
  universityLabelsMatch,
  universityLabelCanonicalKey,
  normalizeUniversityLabel,
} = require('../src/utils/universityNameNormalize');
const {
  resolveEvaluationTemplate,
  templateBelongsToUniversity,
  isMutahUniversity,
  assertMutahOfficialTemplateV11,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.resolve');
const { resolveUniversityIdFilter, assertUniversityRecordAccess } = require('../src/utils/universityScope');
const { requireOrganizationType } = require('../src/middlewares/authorization.middleware');
const { ApiError } = require('../src/utils/apiError');

const ZARQA_NAME_AR = 'جامعة الزرقاء الخاصة';
const ZARQA_NAME_EN = 'Zarqa Private University';
const ZARQA_CODE = 'zarqa-private-university';
const ZARQA_DOMAIN = 'zu.edu.jo';
const ZARQA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MUTAH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TAFILA_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('Zarqa Private University baseline catalog', () => {
  const zarqa = REAL_UNIVERSITIES.find((u) => u.code === ZARQA_CODE || u.name === ZARQA_NAME_AR);

  it('includes Zarqa Private University with UNIVERSITY identity fields', () => {
    assert.ok(zarqa, 'Zarqa must be in REAL_UNIVERSITIES');
    assert.equal(zarqa.name, ZARQA_NAME_AR);
    assert.equal(zarqa.nameEn, ZARQA_NAME_EN);
    assert.equal(zarqa.code, ZARQA_CODE);
    assert.equal(zarqa.domain, ZARQA_DOMAIN);
    assert.equal(zarqa.country, 'Jordan');
    assert.equal(zarqa.status, undefined); // status applied by ensureBaselineUniversity as active
  });

  it('does not duplicate Zarqa entries in the catalog', () => {
    const matches = REAL_UNIVERSITIES.filter(
      (u) =>
        u.code === ZARQA_CODE ||
        u.domain === ZARQA_DOMAIN ||
        u.name === ZARQA_NAME_AR ||
        (u.nameAliases || []).includes('جامعة الزرقاء')
    );
    assert.equal(matches.length, 1);
  });

  it('lists Zarqa specialty programs under zu.edu.jo for Field Training eligibility', () => {
    const entry = UNIVERSITY_SPECIALTY_CATALOG.find((e) => e.universityDomain === ZARQA_DOMAIN);
    assert.ok(entry);
    assert.ok(entry.programs.length >= 1);
    assert.ok(entry.programs.every((p) => p.canonicalCode));
  });
});

describe('Zarqa Excel university name normalization', () => {
  it('resolves Arabic and English aliases to one canonical key', () => {
    const key = universityLabelCanonicalKey(ZARQA_NAME_AR);
    assert.equal(key, ZARQA_CODE);
    assert.equal(universityLabelCanonicalKey('جامعة الزرقاء'), ZARQA_CODE);
    assert.equal(universityLabelCanonicalKey('Zarqa Private University'), ZARQA_CODE);
    assert.equal(universityLabelCanonicalKey('Zarqa University'), ZARQA_CODE);
  });

  it('matches alias labels to the canonical Zarqa name', () => {
    assert.equal(universityLabelsMatch('جامعة الزرقاء', ZARQA_NAME_AR), true);
    assert.equal(universityLabelsMatch('Zarqa University', ZARQA_NAME_AR), true);
    assert.equal(universityLabelsMatch('Zarqa Private University', ZARQA_NAME_AR), true);
  });

  it('does not merge unrelated universities', () => {
    assert.equal(universityLabelsMatch('جامعة مؤتة', ZARQA_NAME_AR), false);
    assert.equal(universityLabelsMatch('جامعة الطفيلة التقنية', ZARQA_NAME_AR), false);
    assert.equal(universityLabelsMatch('Mutah University', 'Zarqa University'), false);
    assert.equal(
      universityLabelCanonicalKey('جامعة مؤتة'),
      normalizeUniversityLabel('جامعة مؤتة')
    );
  });
});

describe('Zarqa template resolution isolation', () => {
  const mutahDefault = {
    id: 'mutah-v11',
    university_id: MUTAH_ID,
    version: 11,
    is_active: true,
    is_default: true,
  };
  const tafilaDefault = {
    id: 'tafila-xlsx',
    university_id: TAFILA_ID,
    version: 1,
    is_active: true,
    is_default: true,
  };

  it('does not borrow Mutah or Tafila templates for Zarqa (fail closed)', () => {
    const fromMutah = resolveEvaluationTemplate({
      opportunity: { university_id: ZARQA_ID },
      universityDefault: mutahDefault,
    });
    assert.equal(fromMutah.source, 'missing');
    assert.equal(fromMutah.template, null);

    const fromTafila = resolveEvaluationTemplate({
      opportunity: { university_id: ZARQA_ID },
      universityDefault: tafilaDefault,
    });
    assert.equal(fromTafila.source, 'missing');
    assert.equal(fromTafila.template, null);
  });

  it('uses Zarqa university default when present', () => {
    const zarqaDefault = {
      id: 'zarqa-default',
      university_id: ZARQA_ID,
      is_active: true,
      is_default: true,
    };
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: ZARQA_ID },
      universityDefault: zarqaDefault,
    });
    assert.equal(resolved.source, 'university_default');
    assert.equal(resolved.template.id, 'zarqa-default');
    assert.equal(templateBelongsToUniversity(resolved.template, ZARQA_ID), true);
    assert.equal(templateBelongsToUniversity(mutahDefault, ZARQA_ID), false);
  });

  it('does not treat Zarqa as Mutah for V11 enforcement', () => {
    assert.equal(isMutahUniversity({ name: ZARQA_NAME_AR, name_en: ZARQA_NAME_EN }), false);
    assert.equal(isMutahUniversity({ domain: ZARQA_DOMAIN }), false);
    const check = assertMutahOfficialTemplateV11({
      isMutah: isMutahUniversity({ name: ZARQA_NAME_AR }),
      template: null,
    });
    assert.equal(check.ok, true);
  });
});

describe('Zarqa admin scoping', () => {
  it('super admin may filter to Zarqa without restriction', () => {
    assert.equal(
      resolveUniversityIdFilter({ isGlobal: true, universityId: null }, ZARQA_ID),
      ZARQA_ID
    );
  });

  it('Zarqa admin is scoped only to Zarqa', () => {
    const zarqaAdmin = { isGlobal: false, universityId: ZARQA_ID, roles: ['admin'] };
    assert.equal(resolveUniversityIdFilter(zarqaAdmin, null), ZARQA_ID);
    assert.equal(resolveUniversityIdFilter(zarqaAdmin, ZARQA_ID), ZARQA_ID);
    assert.throws(
      () => resolveUniversityIdFilter(zarqaAdmin, MUTAH_ID),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.throws(
      () => assertUniversityRecordAccess(zarqaAdmin, MUTAH_ID),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.doesNotThrow(() => assertUniversityRecordAccess(zarqaAdmin, ZARQA_ID));
  });

  it('institution users cannot access UNIVERSITY portal (Field Training)', () => {
    const mw = requireOrganizationType('UNIVERSITY');
    const req = {
      user: {
        isGlobal: false,
        organizationType: 'INSTITUTION',
        universityId: null,
      },
    };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    let nextCalled = false;
    mw(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it('missing university assignment never implies global access', () => {
    assert.equal(
      resolveUniversityIdFilter({ isGlobal: false, universityId: null, roles: ['admin'] }, null),
      undefined
    );
    assert.throws(
      () =>
        assertUniversityRecordAccess(
          { isGlobal: false, universityId: null, roles: ['admin'] },
          ZARQA_ID
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

describe('Zarqa academic supervisor text model', () => {
  it('keeps academic supervisor as a text field (no required LMS account)', () => {
    // Architecture check: supervisor Excel / letter flows use academic_supervisor_name text.
    const parse = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
    assert.equal(typeof parse.normalizePersonLabel, 'function');
    assert.equal(typeof parse.groupRowsBySupervisor, 'function');
    const { classifyStudent } = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
    assert.equal(typeof classifyStudent, 'function');
  });
});

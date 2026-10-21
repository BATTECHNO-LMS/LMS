const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { HOURS_OPTIONS, isSupportedHours, allocateHours } = require('../src/modules/public/internshipJourney.constants');
const { academicProfileBodySchema } = require('../src/modules/public/internshipJourney.validation');
const internshipJourneyService = require('../src/modules/public/internshipJourney.service');
const {
  isMajorAllowedForFaculty,
  getMajorsForFaculty,
  MAJOR_TO_TRACK,
  TRACK_NOT_CONFIGURED,
} = require('../src/modules/public/internshipJourney.taxonomy');
const { getActiveJordanUniversities, countByCategory } = require('../src/modules/public/internshipJourney.universities');
const { buildInternshipPlanPdfHtml } = require('../src/modules/public/internshipJourney.pdfTemplate');
const fs = require('fs');
const path = require('path');

describe('Jordan directory API payload', () => {
  it('returns full Jordan directory categories, not tenant DB rows', () => {
    const data = internshipJourneyService.listPublicUniversities();
    assert.equal(data.source, 'jordan_directory');
    assert.ok(data.universities.length >= 30);
    assert.ok(data.universities.every((u) => u.code && u.category && u.nameAr));
    const counts = countByCategory();
    assert.ok(counts.PUBLIC >= 10);
    assert.ok(counts.PRIVATE >= 15);
    assert.ok(counts.SPECIAL_LAW >= 2);
    assert.ok(counts.REGIONAL >= 1);
    assert.equal(getActiveJordanUniversities().length, data.universities.length);
  });
});

describe('Faculty → Major server enforcement', () => {
  it('rejects IT + Finance and Business + Cybersecurity', async () => {
    const itFinance = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'ISRA',
      universityName: 'جامعة الإسراء',
      facultyCode: 'INFORMATION_TECHNOLOGY',
      facultyName: 'كلية تكنولوجيا المعلومات والحوسبة',
      majorCode: 'FINANCE_BANKING',
      trainingHours: 160,
    });
    assert.equal(itFinance.valid, false);
    assert.match(itFinance.errors.major, /لا ينتمي/);

    const bizCyber = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'MU',
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال والعلوم الإدارية',
      majorCode: 'CYBERSECURITY',
      trainingHours: 160,
    });
    assert.equal(bizCyber.valid, false);
    assert.match(bizCyber.errors.major, /لا ينتمي/);
  });

  it('accepts Business+MIS and IT+Cybersecurity and derives track', async () => {
    const mis = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'MU',
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال والعلوم الإدارية',
      majorCode: 'MIS',
      trainingHours: 160,
      trackCode: 'MIS',
    });
    assert.equal(mis.valid, true);
    assert.equal(mis.profile.trackCode, 'MIS');
    assert.equal(mis.persisted, false);

    const cyber = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'PSUT',
      universityName: 'جامعة الأميرة سمية للتكنولوجيا',
      facultyCode: 'INFORMATION_TECHNOLOGY',
      facultyName: 'كلية تكنولوجيا المعلومات والحوسبة',
      majorCode: 'CYBERSECURITY',
      trainingHours: 120,
    });
    assert.equal(cyber.valid, true);
    assert.equal(cyber.profile.trackCode, 'CYBERSECURITY');
  });

  it('rejects client trackCode tampering', async () => {
    const result = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'MU',
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال والعلوم الإدارية',
      majorCode: 'MIS',
      trainingHours: 160,
      trackCode: 'DIGITAL_MARKETING',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.track);
  });

  it('does not invent Business Administration for Accounting', () => {
    assert.equal(MAJOR_TO_TRACK.ACCOUNTING, TRACK_NOT_CONFIGURED);
    assert.equal(isMajorAllowedForFaculty('BUSINESS', 'ACCOUNTING'), true);
    assert.ok(!getMajorsForFaculty('INFORMATION_TECHNOLOGY').some((m) => m.code === 'FINANCE_BANKING'));
  });
});

describe('Hours and zod', () => {
  it('supports 80–300 / 10 and rejects 85', () => {
    assert.equal(isSupportedHours(80), true);
    assert.equal(isSupportedHours(300), true);
    assert.equal(isSupportedHours(85), false);
    assert.equal(HOURS_OPTIONS.length, 23);
    assert.equal(allocateHours(100).foundation, 20);
  });

  it('zod accepts valid body and rejects bad hours', () => {
    const ok = academicProfileBodySchema.safeParse({
      universityCode: 'MU',
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال والعلوم الإدارية',
      majorCode: 'MIS',
      trainingHours: 160,
    });
    assert.equal(ok.success, true);
    assert.equal(
      academicProfileBodySchema.safeParse({
        universityCode: 'MU',
        universityName: 'جامعة مؤتة',
        facultyCode: 'BUSINESS',
        facultyName: 'كلية الأعمال',
        majorCode: 'MIS',
        trainingHours: 85,
      }).success,
      false
    );
  });
});

describe('Plan PDF template', () => {
  it('renders branded Arabic HTML with plan fields escaped', async () => {
    const validated = await internshipJourneyService.validateAcademicProfile({
      universityCode: 'MU',
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال والعلوم الإدارية',
      majorCode: 'MIS',
      trainingHours: 160,
    });
    assert.equal(validated.valid, true);
    const html = buildInternshipPlanPdfHtml({
      profile: { ...validated.profile, finalProject: '<script>x</script>' },
      allocation: validated.allocation,
      intensity: validated.intensity,
    });
    assert.match(html, /dir="rtl"/);
    assert.match(html, /جامعة مؤتة/);
    assert.match(html, /نظم المعلومات الإدارية/);
    assert.match(html, /160/);
    assert.match(html, /#132d4a/);
    assert.match(html, /#c9a227/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>x<\/script>/);
  });

  it('registers public plan-pdf route', () => {
    const routesSrc = fs.readFileSync(
      path.join(__dirname, '../src/modules/public/public.routes.js'),
      'utf8'
    );
    assert.match(routesSrc, /internship-journey\/plan-pdf/);
    assert.match(routesSrc, /downloadPlanPdf/);
  });
});

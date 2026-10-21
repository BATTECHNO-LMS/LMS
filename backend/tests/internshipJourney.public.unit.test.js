const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  HOURS_OPTIONS,
  MIN_HOURS,
  MAX_HOURS,
  HOURS_STEP,
  MAJOR_TO_TRACK,
  TRACK_SUMMARIES,
  isSupportedHours,
  allocateHours,
  getIntensityBand,
} = require('../src/modules/public/internshipJourney.constants');
const { academicProfileBodySchema } = require('../src/modules/public/internshipJourney.validation');
const internshipJourneyService = require('../src/modules/public/internshipJourney.service');

describe('Internship journey public constants', () => {
  it('supports hours 80–300 in steps of 10', () => {
    assert.equal(MIN_HOURS, 80);
    assert.equal(MAX_HOURS, 300);
    assert.equal(HOURS_STEP, 10);
    assert.equal(isSupportedHours(80), true);
    assert.equal(isSupportedHours(90), true);
    assert.equal(isSupportedHours(300), true);
    assert.equal(isSupportedHours(75), false);
    assert.equal(isSupportedHours(85), false);
    assert.equal(isSupportedHours(310), false);
    assert.equal(HOURS_OPTIONS.length, 23);
  });

  it('allocates 20/45/20/15 without floating remainder drift', () => {
    for (const h of HOURS_OPTIONS) {
      const a = allocateHours(h);
      assert.equal(a.foundation + a.specialization + a.tasks + a.finalProject, h);
    }
    assert.deepEqual(allocateHours(100), {
      total: 100,
      foundation: 20,
      specialization: 45,
      tasks: 20,
      finalProject: 15,
    });
  });

  it('maps the four majors to dedicated track summaries', () => {
    assert.deepEqual(Object.keys(MAJOR_TO_TRACK).sort(), [
      'BUSINESS_ADMINISTRATION',
      'DIGITAL_MARKETING',
      'FINANCE_BANKING',
      'MIS',
    ]);
    assert.equal(TRACK_SUMMARIES.MIS.finalProject, 'Business Management Information System');
    assert.equal(TRACK_SUMMARIES.DIGITAL_MARKETING.finalProject, 'Complete Digital Marketing Campaign');
    assert.equal(TRACK_SUMMARIES.FINANCE_BANKING.finalProject, 'Financial Performance & Banking Analysis');
    assert.equal(TRACK_SUMMARIES.BUSINESS_ADMINISTRATION.finalProject, 'Business Improvement Project');
    assert.equal(getIntensityBand(160).id, 'standard');
  });
});

describe('Internship journey Zod validation', () => {
  const base = {
    universityName: 'جامعة مؤتة',
    facultyCode: 'BUSINESS',
    facultyName: 'كلية الأعمال',
    majorCode: 'MIS',
    trainingHours: 160,
    trackCode: 'MIS',
  };

  it('accepts a valid academic profile body', () => {
    const parsed = academicProfileBodySchema.safeParse(base);
    assert.equal(parsed.success, true);
  });

  it('rejects invalid hours and unknown majors', () => {
    assert.equal(academicProfileBodySchema.safeParse({ ...base, trainingHours: 85 }).success, false);
    assert.equal(academicProfileBodySchema.safeParse({ ...base, trainingHours: 75 }).success, false);
    assert.equal(academicProfileBodySchema.safeParse({ ...base, trainingHours: 310 }).success, false);
    assert.equal(academicProfileBodySchema.safeParse({ ...base, majorCode: 'CS' }).success, false);
    assert.equal(academicProfileBodySchema.safeParse({ ...base, universityName: '' }).success, false);
  });
});

describe('Internship journey validateAcademicProfile service', () => {
  it('returns valid=false with Arabic field errors without persisting', async () => {
    const result = await internshipJourneyService.validateAcademicProfile({
      universityName: '',
      facultyCode: '',
      facultyName: '',
      majorCode: 'NOPE',
      trainingHours: 85,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.university);
    assert.ok(result.errors.faculty);
    assert.ok(result.errors.major);
    assert.ok(result.errors.hours);
  });

  it('accepts other-university intake metadata without creating a university row', async () => {
    const result = await internshipJourneyService.validateAcademicProfile({
      universityName: 'جامعة تجريبية غير مسجلة',
      isOtherUniversity: true,
      facultyCode: 'other',
      facultyName: 'كلية تجريبية',
      isOtherFaculty: true,
      majorCode: 'DIGITAL_MARKETING',
      trainingHours: 120,
      trackCode: 'DIGITAL_MARKETING',
    });
    assert.equal(result.valid, true);
    assert.equal(result.persisted, false);
    assert.equal(result.profile.universityId, null);
    assert.equal(result.profile.trackCode, 'DIGITAL_MARKETING');
    assert.equal(result.allocation.total, 120);
  });

  it('rejects mismatched trackCode for a major', async () => {
    const result = await internshipJourneyService.validateAcademicProfile({
      universityName: 'جامعة مؤتة',
      facultyCode: 'BUSINESS',
      facultyName: 'كلية الأعمال',
      majorCode: 'MIS',
      trainingHours: 160,
      trackCode: 'DIGITAL_MARKETING',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.track);
  });

  it('exposes public track catalog without private fields', () => {
    const data = internshipJourneyService.listPublicTracks();
    assert.equal(data.tracks.length, 4);
    assert.equal(data.majors.length, 4);
    for (const track of data.tracks) {
      assert.ok(track.code);
      assert.ok(track.nameAr);
      assert.ok(track.nameEn);
      assert.ok(!('email' in track));
      assert.ok(!('adminNotes' in track));
    }
  });
});

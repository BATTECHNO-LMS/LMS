import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ACADEMIC_MAJORS,
  ALLOCATION_PERCENT,
  COMPANY_MAP_URL,
  ENROLLMENT_PHONES,
  EVALUATION_WEIGHTS,
  FACULTY_OPTIONS,
  FALLBACK_UNIVERSITIES,
  HOURS_OPTIONS,
  MAJOR_TO_TRACK,
  OTHER_FACULTY,
  OTHER_UNIVERSITY,
  PASS_SCORE,
  TRACK_CATALOG,
  allocateHours,
  buildEnrollmentWhatsAppMessage,
  buildJourneyPlan,
  getIntensityBand,
  getTrackForMajor,
  phoneHref,
  validateAcademicProfile,
  whatsappHref,
} from '../src/features/internshipJourney/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const BASE_SELECTION = {
  universityValue: 'جامعة مؤتة',
  universityName: 'جامعة مؤتة',
  universityId: null,
  facultyCode: 'BUSINESS',
  facultyName: 'كلية الأعمال',
  majorCode: 'MIS',
  trainingHours: 160,
};

describe('Internship journey public route and navigation', () => {
  test('route is registered outside ProtectedRoute', () => {
    const router = read('src/app/router/index.jsx');
    const routeIdx = router.indexOf('path={INTERNSHIP_JOURNEY_PATH}');
    const protectedIdx = router.indexOf('<ProtectedRoute');
    assert.ok(routeIdx > 0, 'route registered');
    assert.ok(routeIdx < protectedIdx, 'route must be public');
    assert.match(read('src/constants/publicRoutes.js'), /INTERNSHIP_JOURNEY_PATH = '\/internship-journey'/);
  });

  test('homepage navbar links to the journey on desktop and mobile', () => {
    const nav = read('src/components/landing/hero/HeroFloatingNav.jsx');
    const links = nav.match(/<NavLink\s+to=\{INTERNSHIP_JOURNEY_PATH\}/g) || [];
    assert.equal(links.length, 2);
  });

  test('styles are scoped so they cannot leak into the rest of EPROJECTO', () => {
    const css = read('src/components/internshipJourney/internship-journey.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = css
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
      .replace(/@media[^{]+\{/g, '')
      .match(/[^{}]+(?=\{)/g)
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    for (const selector of selectors) {
      assert.match(selector, /^\.ij-root\b/, `unscoped selector: ${selector}`);
    }
    for (const name of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
      assert.match(name[1], /^ij-/, `unprefixed keyframes: ${name[1]}`);
    }
  });

  test('page components do not use auth or private admin APIs', () => {
    const files = [
      'src/pages/public/InternshipJourneyPage.jsx',
      ...fs
        .readdirSync(path.join(root, 'src/components/internshipJourney'))
        .filter((f) => f.endsWith('.jsx') || f.endsWith('.js'))
        .map((f) => `src/components/internshipJourney/${f}`),
    ];
    for (const file of files) {
      const src = read(file);
      assert.doesNotMatch(src, /useAuth|features\/auth|dangerouslySetInnerHTML/, file);
      assert.doesNotMatch(src, /admin\/field-training|adminFieldTraining/, file);
    }
  });
});

describe('Academic profile validation and dependencies', () => {
  test('university, faculty, major, and hours are required', () => {
    const empty = validateAcademicProfile({});
    assert.equal(empty.ok, false);
    assert.equal(empty.errors.university, 'يرجى اختيار الجامعة.');
    assert.equal(empty.errors.faculty, 'يرجى اختيار الكلية.');
    assert.equal(empty.errors.major, 'يرجى اختيار التخصص.');
    assert.equal(empty.errors.hours, 'يرجى تحديد عدد ساعات التدريب.');
  });

  test('other university and other faculty require free-text names', () => {
    const otherUni = validateAcademicProfile({
      ...BASE_SELECTION,
      universityValue: OTHER_UNIVERSITY,
      otherUniversityName: '',
    });
    assert.equal(otherUni.ok, false);
    assert.equal(otherUni.errors.university, 'يرجى اختيار الجامعة.');

    const otherFac = validateAcademicProfile({
      ...BASE_SELECTION,
      facultyCode: OTHER_FACULTY,
      otherFacultyName: '',
      facultyName: '',
    });
    assert.equal(otherFac.ok, false);
    assert.match(otherFac.errors.faculty, /الكلية/);
  });

  test('hours 80 / 90 / 300 accepted; 75 / 85 / 310 rejected', () => {
    for (const h of [80, 90, 300]) {
      const ok = validateAcademicProfile({ ...BASE_SELECTION, trainingHours: h });
      assert.equal(ok.ok, true, String(h));
    }
    for (const h of [75, 85, 310]) {
      const bad = validateAcademicProfile({ ...BASE_SELECTION, trainingHours: h });
      assert.equal(bad.ok, false, String(h));
    }
  });

  test('configurator resets dependent fields when university or faculty changes', () => {
    const configurator = read('src/components/internshipJourney/JourneyConfigurator.jsx');
    assert.match(configurator, /function resetFromUniversity/);
    assert.match(configurator, /function resetFromFaculty/);
    assert.match(configurator, /resetFromUniversity\(\)/);
    assert.match(configurator, /resetFromFaculty\(\)/);
    assert.match(configurator, /disabled=\{!facultyEnabled\}/);
    assert.match(configurator, /disabled=\{!majorEnabled\}/);
    assert.match(configurator, /disabled=\{!hoursEnabled\}/);
  });
});

describe('Internship journey hours and allocation', () => {
  test('hours range from 80 to 300 in steps of 10', () => {
    assert.equal(HOURS_OPTIONS.length, 23);
    assert.equal(HOURS_OPTIONS[0], 80);
    assert.equal(HOURS_OPTIONS.at(-1), 300);
    HOURS_OPTIONS.forEach((h, i) => assert.equal(h, 80 + i * 10));
  });

  test('allocation is 20% / 45% / 20% / 15% and always sums exactly to the total', () => {
    assert.deepEqual(ALLOCATION_PERCENT, {
      foundation: 20,
      specialization: 45,
      tasks: 20,
      finalProject: 15,
    });
    for (const h of HOURS_OPTIONS) {
      const a = allocateHours(h);
      assert.equal(a.foundation + a.specialization + a.tasks + a.finalProject, h, `buckets for ${h}`);
      for (const value of [a.foundation, a.specialization, a.tasks, a.finalProject]) {
        assert.ok(Number.isInteger(value));
      }
    }
  });

  test('sample hour allocations match the percentage architecture', () => {
    assert.deepEqual(allocateHours(100), {
      total: 100,
      foundation: 20,
      specialization: 45,
      tasks: 20,
      finalProject: 15,
      softSkills: 20,
      commonIt: 0,
      specialized: 45,
      modules: [45],
    });
    assert.deepEqual(allocateHours(200), {
      total: 200,
      foundation: 40,
      specialization: 90,
      tasks: 40,
      finalProject: 30,
      softSkills: 40,
      commonIt: 0,
      specialized: 90,
      modules: [90],
    });
    assert.deepEqual(allocateHours(160), {
      total: 160,
      foundation: 32,
      specialization: 72,
      tasks: 32,
      finalProject: 24,
      softSkills: 32,
      commonIt: 0,
      specialized: 72,
      modules: [72],
    });
  });

  test('intensity bands scale with hours without inventing separate curricula', () => {
    assert.equal(getIntensityBand(100).id, 'foundation');
    assert.equal(getIntensityBand(160).id, 'standard');
    assert.equal(getIntensityBand(200).id, 'extended');
    assert.equal(getIntensityBand(280).id, 'advanced');
  });

  test('plan stages sum to selected hours and expose track preview data', () => {
    const plan = buildJourneyPlan(BASE_SELECTION);
    assert.equal(plan.stages.length, 4);
    assert.equal(plan.stages.reduce((sum, s) => sum + s.hours, 0), 160);
    assert.equal(plan.track.code, 'MIS');
    assert.equal(plan.structureSummary.length, 4);
    assert.equal(plan.weeks, 8);
    assert.throws(() => buildJourneyPlan({ ...BASE_SELECTION, trainingHours: 85 }));
    assert.throws(() => buildJourneyPlan({ ...BASE_SELECTION, majorCode: 'unknown' }));
  });
});

describe('Specialized field training tracks', () => {
  test('four active majors map to dedicated tracks with stable codes', () => {
    assert.equal(ACADEMIC_MAJORS.length, 4);
    assert.deepEqual(
      ACADEMIC_MAJORS.map((m) => m.value),
      ['MIS', 'DIGITAL_MARKETING', 'FINANCE_BANKING', 'BUSINESS_ADMINISTRATION']
    );
    for (const major of ACADEMIC_MAJORS) {
      assert.equal(MAJOR_TO_TRACK[major.value], major.trackCode);
      assert.ok(TRACK_CATALOG[major.trackCode]);
      assert.equal(TRACK_CATALOG[major.trackCode].active, true);
    }
  });

  test('MIS / Digital Marketing / Finance / Business Administration mappings', () => {
    assert.equal(getTrackForMajor('MIS').finalProject, 'Business Management Information System');
    assert.equal(getTrackForMajor('DIGITAL_MARKETING').finalProject, 'Complete Digital Marketing Campaign');
    assert.equal(getTrackForMajor('FINANCE_BANKING').finalProject, 'Financial Performance & Banking Analysis');
    assert.equal(getTrackForMajor('BUSINESS_ADMINISTRATION').finalProject, 'Business Improvement Project');
    assert.ok(getTrackForMajor('MIS').skills.includes('Power BI'));
    assert.ok(getTrackForMajor('DIGITAL_MARKETING').skills.includes('SEO'));
    assert.ok(getTrackForMajor('FINANCE_BANKING').skills.includes('KYC / AML Awareness'));
    assert.ok(getTrackForMajor('BUSINESS_ADMINISTRATION').skills.includes('Project Management'));
  });

  test('architecture remains extensible for future majors', () => {
    assert.ok(!('CYBERSECURITY' in MAJOR_TO_TRACK));
    // Adding a future major only requires catalog + mapping entries — no hardcoded page branches for the four.
    const configurator = read('src/components/internshipJourney/JourneyConfigurator.jsx');
    assert.match(configurator, /getActiveMajors\(\)/);
    assert.doesNotMatch(configurator, /if \(majorCode === 'MIS'\)/);
  });

  test('faculty options include other faculty; universities fallback preserved', () => {
    assert.ok(FACULTY_OPTIONS.some((f) => f.code === OTHER_FACULTY));
    assert.ok(FALLBACK_UNIVERSITIES.includes('جامعة الطفيلة التقنية'));
    assert.ok(FALLBACK_UNIVERSITIES.includes('جامعة الزرقاء'));
  });
});

describe('Registration handoff and evaluation', () => {
  test('WhatsApp enrollment message carries academic profile without requiring re-entry', () => {
    const profile = validateAcademicProfile(BASE_SELECTION).profile;
    const msg = buildEnrollmentWhatsAppMessage(profile);
    assert.match(msg, /جامعة مؤتة/);
    assert.match(msg, /كلية الأعمال/);
    assert.match(msg, /160/);
    assert.match(msg, /MIS|نظم المعلومات/);
    assert.match(whatsappHref(undefined, msg), /wa\.me\/962791433341/);
  });

  test('contact numbers and map link remain canonical', () => {
    assert.deepEqual(
      ENROLLMENT_PHONES.map((p) => [p.display, phoneHref(p.international)]),
      [
        ['0791433341', 'tel:+962791433341'],
        ['0798040280', 'tel:+962798040280'],
      ]
    );
    assert.equal(COMPANY_MAP_URL, 'https://maps.app.goo.gl/dGpq6DDF6xymechq7');
  });

  test('EPROJECTO evaluation weights and pass score are unchanged', () => {
    assert.deepEqual(
      EVALUATION_WEIGHTS.map((w) => [w.key, w.percent]),
      [
        ['attendance', 20],
        ['postAssessment', 20],
        ['practicalTasks', 40],
        ['professionalBehavior', 20],
      ]
    );
    assert.equal(EVALUATION_WEIGHTS.reduce((s, w) => s + w.percent, 0), 100);
    assert.equal(PASS_SCORE, 80);
  });

  test('CTA and track preview are wired on the page', () => {
    const page = read('src/pages/public/InternshipJourneyPage.jsx');
    assert.match(page, /TrackPreview/);
    assert.match(page, /saveAcademicProfile/);
    assert.match(page, /EnrollmentSteps profile=\{plan\}/);
    assert.match(read('src/components/internshipJourney/TrackPreview.jsx'), /ابدأ التسجيل في التدريب/);
  });
});

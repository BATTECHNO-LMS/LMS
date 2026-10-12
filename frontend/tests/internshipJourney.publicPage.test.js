import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ACADEMIC_MAJORS,
  ALLOCATION_PERCENT,
  COMPANY_MAP_URL,
  DEFAULT_HOURS,
  ENROLLMENT_PHONES,
  EVALUATION_WEIGHTS,
  HOURS_OPTIONS,
  MAJOR_TO_TRACK,
  PASS_SCORE,
  TRACK_CATALOG,
  UNIVERSITIES,
  allocateHours,
  buildJourneyPlan,
  getTrackForMajor,
  phoneHref,
  whatsappHref,
} from '../src/features/internshipJourney/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Exact WhatsApp link from BATMAN_TECHNOLOGY_Internship_Journey_V4.html. */
const V4_WHATSAPP_URL =
  'https://wa.me/962791433341?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D8%8C%20%D8%A3%D8%B1%D8%BA%D8%A8%20%D8%A8%D8%A7%D9%84%D8%A7%D9%84%D8%AA%D8%AD%D8%A7%D9%82%20%D8%A8%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8%20%D8%A7%D9%84%D9%85%D9%8A%D8%AF%D8%A7%D9%86%D9%8A';

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
    assert.equal((nav.match(/header\.navInternshipJourney/g) || []).length, 2);
    assert.equal(JSON.parse(read('src/i18n/locales/ar/landing.json')).header.navInternshipJourney, 'خطة التدريب الميداني');
    assert.equal(JSON.parse(read('src/i18n/locales/en/landing.json')).header.navInternshipJourney, 'Internship Journey');
  });

  test('page and components never touch auth, API clients, or private services', () => {
    const files = [
      'src/pages/public/InternshipJourneyPage.jsx',
      ...fs
        .readdirSync(path.join(root, 'src/components/internshipJourney'))
        .filter((f) => f.endsWith('.jsx') || f.endsWith('.js'))
        .map((f) => `src/components/internshipJourney/${f}`),
    ];
    for (const file of files) {
      const src = read(file);
      assert.doesNotMatch(src, /services\/|apiClient|useAuth|features\/auth|axios|fetch\(/, file);
      assert.doesNotMatch(src, /dangerouslySetInnerHTML/, file);
    }
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
});

describe('Internship journey hours and allocation', () => {
  test('hours range from 80 to 300 in steps of 10, defaulting to 160', () => {
    assert.equal(HOURS_OPTIONS.length, 23);
    assert.equal(HOURS_OPTIONS[0], 80);
    assert.equal(HOURS_OPTIONS.at(-1), 300);
    HOURS_OPTIONS.forEach((h, i) => assert.equal(h, 80 + i * 10));
    assert.equal(DEFAULT_HOURS, 160);
  });

  test('allocation is 10% / 15% / 75% and always sums exactly to the total', () => {
    assert.deepEqual(ALLOCATION_PERCENT, { softSkills: 10, commonIt: 15, specialized: 75 });
    for (const h of HOURS_OPTIONS) {
      const a = allocateHours(h);
      assert.equal(a.softSkills + a.commonIt + a.specialized, h, `buckets for ${h}`);
      assert.equal(a.modules.reduce((x, y) => x + y, 0), a.specialized, `modules for ${h}`);
      for (const value of [a.softSkills, a.commonIt, ...a.modules]) assert.ok(Number.isInteger(value));
    }
  });

  test('matches the V4 numbers for the QA sample hours', () => {
    const expected = {
      80: [8, 12, 60, [17, 19, 24]],
      120: [12, 18, 90, [26, 28, 36]],
      160: [16, 24, 120, [34, 38, 48]],
      240: [24, 36, 180, [52, 57, 71]],
      300: [30, 45, 225, [65, 72, 88]],
    };
    for (const [hours, [soft, core, spec, modules]] of Object.entries(expected)) {
      const a = allocateHours(Number(hours));
      assert.deepEqual([a.softSkills, a.commonIt, a.specialized, a.modules], [soft, core, spec, modules], hours);
    }
  });

  test('fractional 15% buckets round half up, as in V4', () => {
    assert.deepEqual(allocateHours(90), { total: 90, softSkills: 9, commonIt: 14, specialized: 67, modules: [19, 21, 27] });
    assert.equal(allocateHours(110).commonIt, 17);
  });

  test('plan stages sum to the selected hours and expose V4 dashboard metrics', () => {
    for (const h of HOURS_OPTIONS) {
      const plan = buildJourneyPlan({ university: 'جامعة مؤتة', hours: h, majorKey: 'cs' });
      assert.equal(plan.stages.length, 6);
      assert.equal(plan.stages.reduce((sum, s) => sum + s.hours, 0), h);
      assert.equal(plan.stages.at(-1).hours, 0);
      assert.equal(plan.weeks, Math.ceil(h / 20));
      assert.equal(plan.previewTasks.length, 7);
    }
    assert.throws(() => buildJourneyPlan({ university: 'x', hours: 85, majorKey: 'cs' }));
    assert.throws(() => buildJourneyPlan({ university: 'x', hours: 160, majorKey: 'unknown' }));
  });
});

describe('Internship journey specializations and career pathways', () => {
  test('all 25 V4 academic majors map to one of 13 career track families', () => {
    assert.equal(ACADEMIC_MAJORS.length, 25);
    assert.equal(Object.keys(TRACK_CATALOG).length, 13);
    const reachable = new Set();
    for (const major of ACADEMIC_MAJORS) {
      const familyKey = MAJOR_TO_TRACK[major.value];
      assert.ok(TRACK_CATALOG[familyKey], `${major.value} -> ${familyKey}`);
      reachable.add(familyKey);
    }
    assert.equal(reachable.size, 13, 'every track family is reachable from some major');
    for (const [key, track] of Object.entries(TRACK_CATALOG)) {
      assert.equal(track.modules.length, 3, key);
      for (const m of track.modules) assert.equal(m.tasks.length, 5, `${key}/${m.title}`);
    }
  });

  test('key majors map to their employability pathways', () => {
    const titles = (major) => getTrackForMajor(major).modules.map((m) => m.title);
    const tags = (major) => getTrackForMajor(major).modules.flatMap((m) => m.tags);
    assert.deepEqual(titles('cs'), ['Backend Engineering', 'Database & Data Modeling', 'API Delivery & Integration']);
    assert.deepEqual(titles('se'), ['Product & Requirements', 'Full-Stack Feature Delivery', 'Quality & Release']);
    assert.deepEqual(titles('cy'), ['Recon & Scope', 'Web Pentesting Labs', 'Reporting & Retesting']);
    assert.deepEqual(titles('ai'), ['Python & LLM API Integration', 'RAG & Retrieval', 'AI Evaluation & Production']);
    assert.ok(tags('ds').includes('Power BI'));
    assert.ok(tags('ds').includes('Scikit-learn'));
  });

  test('cybersecurity tracks are restricted to authorized environments', () => {
    for (const major of ['cy', 'pen', 'netsec']) {
      const track = getTrackForMajor(major);
      assert.match(track.note, /تفويض صريح/);
      assert.match(track.artifacts, /Written Authorization/);
    }
  });

  test('university list is preserved and does not imply hour requirements', () => {
    assert.equal(UNIVERSITIES.length, 20);
    assert.ok(UNIVERSITIES.includes('جامعة الطفيلة التقنية'));
    const configurator = read('src/components/internshipJourney/JourneyConfigurator.jsx');
    assert.match(configurator, /اسم الجامعة لا يحدد الساعات تلقائياً/);
  });
});

describe('Internship journey evaluation and enrollment', () => {
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
    assert.ok(!EVALUATION_WEIGHTS.some((w) => /pre/i.test(w.key)), 'pre-assessment is diagnostic only');
    assert.match(read('src/components/internshipJourney/EvaluationExplainer.jsx'), /Pre-Assessment لقياس المستوى \(غير محسوب في العلامة\)/);
  });

  test('contact numbers, WhatsApp and map link match V4 exactly', () => {
    assert.deepEqual(
      ENROLLMENT_PHONES.map((p) => [p.display, phoneHref(p.international)]),
      [
        ['0791433341', 'tel:+962791433341'],
        ['0798040280', 'tel:+962798040280'],
      ]
    );
    assert.equal(whatsappHref(), V4_WHATSAPP_URL);
    assert.equal(COMPANY_MAP_URL, 'https://maps.app.goo.gl/dGpq6DDF6xymechq7');
  });
});

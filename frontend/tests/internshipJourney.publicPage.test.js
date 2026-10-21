import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ALLOCATION_PERCENT,
  FACULTIES,
  HOURS_OPTIONS,
  JORDAN_UNIVERSITIES,
  MAJOR_TO_TRACK,
  OTHER_FACULTY,
  OTHER_UNIVERSITY,
  TRACK_CATALOG,
  TRACK_NOT_CONFIGURED,
  allocateHours,
  buildJourneyPlan,
  getMajorsForFaculty,
  getTrackForMajor,
  isMajorAllowedForFaculty,
  validateAcademicProfile,
} from '../src/features/internshipJourney/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const BASE = {
  universityCode: 'MU',
  universityName: 'جامعة مؤتة',
  facultyCode: 'BUSINESS',
  facultyName: 'كلية الأعمال والعلوم الإدارية',
  majorCode: 'MIS',
  trainingHours: 160,
};

describe('Jordan university directory', () => {
  test('directory is complete and not limited to eprojecto tenants', () => {
    const active = JORDAN_UNIVERSITIES.filter((u) => u.active !== false);
    assert.ok(active.length >= 30, `expected >=30 universities, got ${active.length}`);
    const names = active.map((u) => u.nameAr);
    for (const required of [
      'الجامعة الأردنية',
      'جامعة اليرموك',
      'جامعة مؤتة',
      'جامعة العلوم والتكنولوجيا الأردنية',
      'الجامعة الهاشمية',
      'جامعة آل البيت',
      'جامعة البلقاء التطبيقية',
      'جامعة الحسين بن طلال',
      'جامعة الطفيلة التقنية',
      'الجامعة الألمانية الأردنية',
      'جامعة عمان العربية',
      'جامعة الشرق الأوسط',
      'جامعة جدارا',
      'جامعة عمان الأهلية',
      'جامعة العلوم التطبيقية الخاصة',
      'جامعة فيلادلفيا',
      'جامعة الإسراء',
      'جامعة البترا',
      'جامعة الزيتونة الأردنية',
      'جامعة الزرقاء',
      'جامعة إربد الأهلية',
      'جامعة جرش',
      'جامعة الأميرة سمية للتكنولوجيا',
      'الجامعة الأمريكية في مادبا',
      'جامعة عجلون الوطنية',
      'جامعة العقبة للتكنولوجيا',
      'جامعة العقبة للعلوم الطبية',
      'جامعة ابن سينا للعلوم الطبية',
      'جامعة العلوم الإسلامية العالمية',
      'جامعة الحسين التقنية',
      'الجامعة العربية المفتوحة - الأردن',
    ]) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
    const byCat = active.reduce((a, u) => {
      a[u.category] = (a[u.category] || 0) + 1;
      return a;
    }, {});
    assert.ok(byCat.PUBLIC >= 10);
    assert.ok(byCat.PRIVATE >= 15);
    assert.ok(byCat.SPECIAL_LAW >= 2);
    assert.ok(byCat.REGIONAL >= 1);
    assert.ok(active.every((u) => u.code && u.nameAr && u.category));
  });

  test('configurator loads Jordan directory, not tenant-only wording', () => {
    const cfg = read('src/components/internshipJourney/JourneyConfigurator.jsx');
    assert.match(cfg, /دليل جامعات الأردن/);
    assert.doesNotMatch(cfg, /تم تحميل الجامعات من دليل eprojecto/);
  });
});

describe('Faculty → Major dependency', () => {
  test('Business majors only under BUSINESS; Cybersecurity excluded', () => {
    const majors = getMajorsForFaculty('BUSINESS').map((m) => m.code);
    assert.ok(majors.includes('BUSINESS_ADMINISTRATION'));
    assert.ok(majors.includes('DIGITAL_MARKETING'));
    assert.ok(majors.includes('FINANCE_BANKING'));
    assert.ok(majors.includes('MIS'));
    assert.ok(!majors.includes('CYBERSECURITY'));
    assert.ok(!majors.includes('SOFTWARE_ENGINEERING'));
    assert.equal(isMajorAllowedForFaculty('BUSINESS', 'CYBERSECURITY'), false);
    assert.equal(isMajorAllowedForFaculty('BUSINESS', 'MIS'), true);
  });

  test('IT majors only under INFORMATION_TECHNOLOGY; Finance excluded', () => {
    const majors = getMajorsForFaculty('INFORMATION_TECHNOLOGY').map((m) => m.code);
    assert.ok(majors.includes('COMPUTER_SCIENCE'));
    assert.ok(majors.includes('SOFTWARE_ENGINEERING'));
    assert.ok(majors.includes('CYBERSECURITY'));
    assert.ok(majors.includes('ARTIFICIAL_INTELLIGENCE'));
    assert.ok(majors.includes('DATA_SCIENCE'));
    assert.ok(!majors.includes('FINANCE_BANKING'));
    assert.ok(!majors.includes('BUSINESS_ADMINISTRATION'));
    assert.equal(isMajorAllowedForFaculty('INFORMATION_TECHNOLOGY', 'FINANCE_BANKING'), false);
  });

  test('faculty change clears incompatible major in validation', () => {
    const ok = validateAcademicProfile({ ...BASE, majorCode: 'BUSINESS_ADMINISTRATION' });
    assert.equal(ok.ok, true);
    const bad = validateAcademicProfile({
      ...BASE,
      facultyCode: 'INFORMATION_TECHNOLOGY',
      facultyName: FACULTIES.INFORMATION_TECHNOLOGY.labelAr,
      majorCode: 'BUSINESS_ADMINISTRATION',
    });
    assert.equal(bad.ok, false);
    assert.match(bad.errors.major, /لا ينتمي/);
  });

  test('configurator resets major when faculty changes', () => {
    const cfg = read('src/components/internshipJourney/JourneyConfigurator.jsx');
    assert.match(cfg, /function resetFromFaculty/);
    assert.match(cfg, /resetFromFaculty\(\)/);
    assert.match(cfg, /getMajorsForFaculty\(facultyCode\)/);
  });
});

describe('Tracks and hours', () => {
  test('four main business tracks remain mapped', () => {
    assert.equal(MAJOR_TO_TRACK.BUSINESS_ADMINISTRATION, 'BUSINESS_ADMINISTRATION');
    assert.equal(MAJOR_TO_TRACK.DIGITAL_MARKETING, 'DIGITAL_MARKETING');
    assert.equal(MAJOR_TO_TRACK.MARKETING, 'DIGITAL_MARKETING');
    assert.equal(MAJOR_TO_TRACK.FINANCE_BANKING, 'FINANCE_BANKING');
    assert.equal(MAJOR_TO_TRACK.MIS, 'MIS');
    assert.ok(TRACK_CATALOG.MIS.configured);
    assert.ok(TRACK_CATALOG.DIGITAL_MARKETING.configured);
    assert.ok(TRACK_CATALOG.FINANCE_BANKING.configured);
    assert.ok(TRACK_CATALOG.BUSINESS_ADMINISTRATION.configured);
  });

  test('unsupported business majors are not mapped to Business Administration', () => {
    assert.equal(MAJOR_TO_TRACK.ACCOUNTING, TRACK_NOT_CONFIGURED);
    assert.equal(MAJOR_TO_TRACK.HUMAN_RESOURCES, TRACK_NOT_CONFIGURED);
    assert.notEqual(MAJOR_TO_TRACK.ACCOUNTING, 'BUSINESS_ADMINISTRATION');
  });

  test('IT majors map to technology tracks, never Digital Marketing', () => {
    assert.equal(MAJOR_TO_TRACK.CYBERSECURITY, 'CYBERSECURITY');
    assert.equal(MAJOR_TO_TRACK.COMPUTER_SCIENCE, 'SOFTWARE_DEVELOPMENT');
    assert.equal(MAJOR_TO_TRACK.ARTIFICIAL_INTELLIGENCE, 'DATA_AI');
    assert.notEqual(MAJOR_TO_TRACK.CYBERSECURITY, 'DIGITAL_MARKETING');
  });

  test('hours 80–300 step 10; allocation 20/45/20/15', () => {
    assert.equal(HOURS_OPTIONS[0], 80);
    assert.equal(HOURS_OPTIONS.at(-1), 300);
    assert.deepEqual(ALLOCATION_PERCENT, { foundation: 20, specialization: 45, tasks: 20, finalProject: 15 });
    assert.equal(allocateHours(100).finalProject, 15);
    assert.equal(validateAcademicProfile({ ...BASE, trainingHours: 85 }).ok, false);
    assert.equal(validateAcademicProfile({ ...BASE, trainingHours: 80 }).ok, true);
  });

  test('plan builds for MIS and Cybersecurity under correct faculties', () => {
    const mis = buildJourneyPlan(BASE);
    assert.equal(mis.track.code, 'MIS');
    assert.equal(mis.stages.reduce((s, x) => s + x.hours, 0), 160);

    const cyber = buildJourneyPlan({
      universityCode: 'PSUT',
      facultyCode: 'INFORMATION_TECHNOLOGY',
      facultyName: FACULTIES.INFORMATION_TECHNOLOGY.labelAr,
      majorCode: 'CYBERSECURITY',
      trainingHours: 120,
    });
    assert.equal(cyber.track.code, 'CYBERSECURITY');
    assert.equal(getTrackForMajor('CYBERSECURITY', 'INFORMATION_TECHNOLOGY').code, 'CYBERSECURITY');
  });
});

describe('Route and scoped CSS', () => {
  test('public route remains registered', () => {
    const router = read('src/app/router/index.jsx');
    assert.ok(router.indexOf('path={INTERNSHIP_JOURNEY_PATH}') < router.indexOf('<ProtectedRoute'));
  });

  test('styles remain scoped to .ij-root', () => {
    const css = read('src/components/internshipJourney/internship-journey.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = css
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
      .replace(/@media[^{]+\{/g, '')
      .match(/[^{}]+(?=\{)/g)
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    for (const selector of selectors) {
      assert.match(selector, /^\.ij-root\b/, `unscoped: ${selector}`);
    }
  });

  test('plan PDF download is wired (not browser print-only)', () => {
    const page = read('src/pages/public/InternshipJourneyPage.jsx');
    const api = read('src/features/internshipJourney/internshipJourney.api.js');
    const endpoints = read('src/services/endpoints.js');
    const preview = read('src/components/internshipJourney/TrackPreview.jsx');
    assert.match(endpoints, /internshipJourneyPlanPdf/);
    assert.match(api, /downloadInternshipPlanPdf/);
    assert.match(page, /downloadInternshipPlanPdf/);
    assert.match(page, /حفظ الخطة PDF/);
    assert.doesNotMatch(page, /window\.print\(/);
    assert.match(preview, /حفظ الخطة PDF/);
  });
});

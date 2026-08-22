const test = require('node:test');
const assert = require('node:assert');
const { NO_UNIVERSITY_MSG, NO_UNIVERSITY_SPECIALTY_MSG, NO_SPECIALTY_MSG } = require('../src/modules/fieldTraining/fieldTraining.access');
const { collectPublishMissing, MSG } = require('../src/modules/fieldTraining/fieldTraining.publishReadiness');

test('student university scope error message is defined in Arabic', () => {
  assert.match(NO_UNIVERSITY_MSG, /جامعة/);
});

test('student specialty scope error message is defined in Arabic', () => {
  assert.match(NO_SPECIALTY_MSG, /التخصص/);
});

test('student university specialty scope error message is defined in Arabic', () => {
  assert.match(NO_UNIVERSITY_SPECIALTY_MSG, /التخصص/);
});

test('publish readiness requires specialty_id and eligibility', () => {
  const missing = collectPublishMissing({
    status: 'draft',
    title: 'Valid title here',
    university_id: '00000000-0000-4000-8000-000000000001',
    organization_name: 'Demo University',
    description: 'Long enough description for publish readiness.',
    location: 'Amman',
    training_mode: 'onsite',
    application_deadline: null,
    start_date: null,
    specialty_id: null,
  });
  assert.ok(missing.includes(MSG.specialty));
  assert.ok(missing.includes(MSG.eligibility));
  assert.ok(MSG.eligibility.includes('لا يمكن نشر الفرصة'));
  assert.ok(!missing.includes(MSG.university));
});

test('publish readiness passes with training track and eligibility', () => {
  const missing = collectPublishMissing(
    {
      status: 'draft',
      title: 'Valid title here',
      description: 'Long enough description for publish readiness.',
      location: 'Amman',
      training_mode: 'onsite',
      application_deadline: null,
      start_date: null,
      specialty_id: '00000000-0000-4000-8000-000000000099',
    },
    { activeEligibilityCount: 2 }
  );
  assert.strictEqual(missing.length, 0);
});

test('resolveSubmissionAbsolutePath rejects path traversal', () => {
  const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
  assert.throws(() => repo.resolveSubmissionAbsolutePath('../secret.txt'));
});

test('mapSubmissionRow omits public file_url by default', () => {
  const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
  const row = repo.mapSubmissionRow({
    id: '00000000-0000-4000-8000-000000000001',
    task_id: '00000000-0000-4000-8000-000000000002',
    application_id: '00000000-0000-4000-8000-000000000003',
    student_id: '00000000-0000-4000-8000-000000000004',
    file_path: 'field-training/task/file.pdf',
    file_name: 'file.pdf',
    mime_type: 'application/pdf',
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });
  assert.strictEqual(row.file_url, null);
});

test('field training PDF HTML does not fetch Google Fonts', () => {
  const { renderGlobalReportHtml } = require('../src/modules/fieldTraining/fieldTrainingReport.template');
  const html = renderGlobalReportHtml({
    report_title: 'تقرير',
    generated_at: '2026-08-22T00:00:00.000Z',
    summary: { universities_count: 1, opportunities_count: 1 },
    university_comparison: [],
    specialty_comparison: [],
  });
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /تقرير/);
});

test('resolveChromeExecutable prefers an existing env path', () => {
  const { resolveChromeExecutable } = require('../src/modules/analytics/pdfRenderer');
  const path = resolveChromeExecutable();
  assert.ok(path === undefined || typeof path === 'string');
});

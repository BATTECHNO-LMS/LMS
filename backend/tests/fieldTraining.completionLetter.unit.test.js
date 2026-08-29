'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const letter = require('../src/modules/fieldTraining/fieldTraining.completionLetter');

test('Sakkal Majalla font files and official brand assets exist in the project', () => {
  assert.ok(fs.existsSync(letter.FONT_REGULAR), 'SakkalMajalla.ttf missing');
  assert.ok(fs.existsSync(letter.FONT_BOLD), 'SakkalMajalla-Bold.ttf missing');
  assert.ok(fs.existsSync(letter.LOGO_PATH), 'company logo missing');
  assert.ok(fs.existsSync(letter.STAMP_PATH), 'official stamp missing');
  const assets = letter.loadLetterAssets();
  assert.equal(assets.ready, true);
  assert.ok(assets.fontRegular.startsWith('data:font/ttf;base64,'));
  assert.ok(assets.logo.startsWith('data:image/png;base64,'));
  assert.ok(assets.stamp.startsWith('data:image/png;base64,'));
});

test('letter eligibility requires مؤهل and at least 140 completed hours', () => {
  const ok = letter.evaluateLetterEligibility(
    { completion_eligibility_status: 'eligible' },
    140
  );
  assert.equal(ok.allowed, true);
  assert.equal(ok.eligibility_label, 'مؤهل');

  const notEligible = letter.evaluateLetterEligibility(
    { completion_eligibility_status: 'pending' },
    180
  );
  assert.equal(notEligible.allowed, false);
  assert.match(notEligible.reasons.join(' '), /مؤهل/);

  const shortHours = letter.evaluateLetterEligibility(
    { completion_eligibility_status: 'eligible' },
    139
  );
  assert.equal(shortHours.allowed, false);
  assert.match(shortHours.reasons.join(' '), /140/);

  assert.throws(
    () => letter.assertLetterEligible({ completion_eligibility_status: 'eligible' }, 20),
    (err) => err.code === 'COMPLETION_LETTER_NOT_ELIGIBLE'
  );
});

test('university number is required and never falls back to a UUID', () => {
  assert.throws(
    () =>
      letter.resolveLetterUniversityNumber({
        id: '3caf0fcc-976a-474c-b499-3d2afaad4a54',
        university_student_number: '3caf0fcc-976a-474c-b499-3d2afaad4a54',
        email: 'name@st.ahu.edu.jo',
      }),
    (err) => err.code === 'STUDENT_NUMBER_UNRESOLVED'
  );

  const resolved = letter.resolveLetterUniversityNumber({
    university_student_number: '202312345',
  });
  assert.equal(resolved.number, '202312345');
});

test('download filename uses student name and university number', () => {
  const filename = letter.buildDownloadFilename('أحمد محمد', '202312345');
  assert.equal(filename, 'أحمد_محمد_202312345_كتاب_إنهاء_التدريب.pdf');
  const header = letter.buildContentDisposition(filename);
  assert.match(header, /filename="[^"]+\.pdf"/);
  assert.match(header, /filename\*=UTF-8''/);
  assert.ok(header.includes(encodeURIComponent('أحمد_محمد_202312345_كتاب_إنهاء_التدريب.pdf')));
  assert.equal(header.includes('completion-letter.pdf'), false);
});

test('generation identity is unique per enrollment and is not a shared temp name', () => {
  const a = letter.buildGenerationIdentity({
    applicationId: 'app-1',
    studentId: 'stu-1',
    opportunityId: 'opp-1',
    updatedAt: '2026-08-30T00:00:00.000Z',
  });
  const b = letter.buildGenerationIdentity({
    applicationId: 'app-2',
    studentId: 'stu-2',
    opportunityId: 'opp-1',
    updatedAt: '2026-08-30T00:00:00.000Z',
  });
  assert.notEqual(a, b);
  assert.equal(a.length, 24);
});

test('HTML template embeds Sakkal Majalla, officer name, and isolated student fields', () => {
  const payloadA = letter.buildLetterPayload({
    app: {
      id: 'app-a',
      student_id: 'stu-a',
      opportunity_id: 'opp-a',
      updated_at: new Date('2026-08-01T00:00:00Z'),
      completion_eligibility_status: 'eligible',
      completed_training_hours: 140,
    },
    opportunity: {
      id: 'opp-a',
      title: 'تدريب الويب - مؤتة',
      start_date: '2026-07-01',
      end_date: '2026-08-20',
    },
    student: {
      full_name: 'آية تركي محمد الخوالده',
      university_student_number: '120220612060',
      university: { name: 'جامعة الحسين بن طلال' },
      specialty: { name_ar: 'علم الحاسوب' },
    },
    hoursProgress: { completed_training_hours: 140 },
    letter: { letter_no: 'FT-TEST-A', issued_at: new Date('2026-08-30') },
  });

  const payloadB = letter.buildLetterPayload({
    app: {
      id: 'app-b',
      student_id: 'stu-b',
      opportunity_id: 'opp-b',
      updated_at: new Date('2026-08-02T00:00:00Z'),
      completion_eligibility_status: 'eligible',
      completed_training_hours: 160,
    },
    opportunity: {
      id: 'opp-b',
      title: 'تدريب الشبكات - الطفيلة',
      start_date: '2026-06-01',
      end_date: '2026-08-01',
    },
    student: {
      full_name: 'محمد علي حسين القضاة الطويل جداً للاختبار',
      university_student_number: '2021987654',
      university: { name: 'جامعة الطفيلة التقنية' },
      specialty: { name_ar: 'هندسة البرمجيات' },
    },
    hoursProgress: { completed_training_hours: 160 },
    letter: { letter_no: 'FT-TEST-B', issued_at: new Date('2026-08-30') },
  });

  const htmlA = letter.buildCompletionLetterHtml(payloadA);
  const htmlB = letter.buildCompletionLetterHtml(payloadB);

  assert.match(htmlA, /font-family: 'Sakkal Majalla'/);
  assert.match(htmlA, /@font-face/);
  assert.match(htmlA, /مسؤول التدريب/);
  assert.match(htmlA, /عاصم القيسي/);
  assert.match(htmlA, /كتاب إنهاء تدريب ميداني/);
  assert.match(htmlA, /إلى من يهمه الأمر/);
  assert.match(htmlA, /آية تركي محمد الخوالده/);
  assert.match(htmlA, /120220612060/);
  assert.match(htmlA, /جامعة الحسين بن طلال/);
  assert.match(htmlA, /تدريب الويب - مؤتة/);
  assert.doesNotMatch(htmlA, /Arial|Times New Roman|Tajawal/i);
  assert.doesNotMatch(htmlA, /محمد علي حسين/);
  assert.doesNotMatch(htmlA, /2021987654/);

  assert.match(htmlB, /محمد علي حسين القضاة الطويل جداً للاختبار/);
  assert.match(htmlB, /2021987654/);
  assert.match(htmlB, /جامعة الطفيلة التقنية/);
  assert.doesNotMatch(htmlB, /آية تركي/);
  assert.doesNotMatch(htmlB, /120220612060/);
});

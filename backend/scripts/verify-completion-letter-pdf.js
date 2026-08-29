'use strict';

const fs = require('fs');
const path = require('path');
const letter = require('../src/modules/fieldTraining/fieldTraining.completionLetter');
const { renderHtmlToPdf, resolveChromeExecutable } = require('../src/modules/analytics/pdfRenderer');

const outDir = path.join(__dirname, '../tmp/completion-letter-verify');
fs.mkdirSync(outDir, { recursive: true });

function payload(overrides) {
  return letter.buildLetterPayload({
    app: {
      id: overrides.applicationId,
      student_id: overrides.studentId,
      opportunity_id: overrides.opportunityId,
      updated_at: new Date(),
      completion_eligibility_status: 'eligible',
      completed_training_hours: overrides.hours,
    },
    opportunity: {
      id: overrides.opportunityId,
      title: overrides.opportunityTitle,
      start_date: '2026-07-01',
      end_date: '2026-08-20',
    },
    student: {
      full_name: overrides.studentName,
      university_student_number: overrides.universityNumber,
      university: { name: overrides.universityName },
      specialty: { name_ar: overrides.specialty },
    },
    hoursProgress: { completed_training_hours: overrides.hours },
    letter: { letter_no: overrides.letterNo, issued_at: new Date('2026-08-30') },
  });
}

async function screenshotHtml(html, pngPath) {
  const puppeteer = require('puppeteer');
  const executablePath = resolveChromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=medium'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({ path: pngPath, fullPage: false, type: 'png' });
  } finally {
    await browser.close();
  }
}

async function main() {
  const a = payload({
    applicationId: '11111111-1111-4111-8111-111111111111',
    studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    opportunityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    studentName: 'آية تركي محمد الخوالده',
    universityNumber: '120220612060',
    universityName: 'جامعة الحسين بن طلال',
    specialty: 'علم الحاسوب',
    opportunityTitle: 'التدريب الميداني — تطوير الويب',
    hours: 140,
    letterNo: 'FT-VERIFY-A',
  });
  const b = payload({
    applicationId: '22222222-2222-4222-8222-222222222222',
    studentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    opportunityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    studentName: 'محمد علي حسين القضاة الطويل جداً للاختبار النهائي',
    universityNumber: '2021987654',
    universityName: 'جامعة الطفيلة التقنية',
    specialty: 'هندسة البرمجيات',
    opportunityTitle: 'التدريب الميداني — الشبكات',
    hours: 160,
    letterNo: 'FT-VERIFY-B',
  });

  const htmlA = letter.buildCompletionLetterHtml(a);
  const htmlB = letter.buildCompletionLetterHtml(b);
  const [pdfA, pdfB] = await Promise.all([
    letter.renderCompletionLetterPdf(a),
    letter.renderCompletionLetterPdf(b),
  ]);

  const fileA = path.join(outDir, letter.buildDownloadFilename(a.studentName, a.universityNumber));
  const fileB = path.join(outDir, letter.buildDownloadFilename(b.studentName, b.universityNumber));
  fs.writeFileSync(fileA, pdfA);
  fs.writeFileSync(fileB, pdfB);
  await screenshotHtml(htmlA, path.join(outDir, 'letter-a.png'));
  await screenshotHtml(htmlB, path.join(outDir, 'letter-b.png'));

  const textA = pdfA.toString('latin1');
  const textB = pdfB.toString('latin1');
  const fontA = /Sakkal|Majalla/i.test(textA);
  const fontB = /Sakkal|Majalla/i.test(textB);
  console.log(JSON.stringify({
    chrome: resolveChromeExecutable() || 'bundled',
    fileA,
    fileB,
    bytesA: pdfA.length,
    bytesB: pdfB.length,
    fontEmbeddedA: fontA,
    fontEmbeddedB: fontB,
    aHasOwnName: htmlA.includes(a.studentName),
    aHasOtherName: htmlA.includes(b.studentName),
    bHasOwnName: htmlB.includes(b.studentName),
    bHasOtherName: htmlB.includes(a.studentName),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

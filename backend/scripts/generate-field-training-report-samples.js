'use strict';

/**
 * Generate official field-training PDF + Excel samples from live DB data when available.
 * Does not seed, mutate, or delete records.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ExcelJS = require('exceljs');
const { prisma } = require('../src/config/db');
const reportRepo = require('../src/modules/fieldTraining/fieldTrainingReport.repository');
const dates = require('../src/modules/fieldTraining/fieldTrainingReport.dates');
const { renderUniversityReportHtml, renderStudentReportHtml } = require('../src/modules/fieldTraining/fieldTrainingReport.template');
const { exportUniversityReportExcel, exportStudentReportExcel } = require('../src/modules/fieldTraining/fieldTrainingReport.excel');
const { renderHtmlToPdf } = require('../src/modules/analytics/pdfRenderer');
const {
  loadBattechnoLogoDataUri,
  loadInstitutionLogoDataUri,
} = require('../src/modules/trainingPrograms/trainingReportPdf.service');

const OUT_DIR = path.join(__dirname, '..', 'tmp', 'field-training-report-samples');

function stampMeta(report, extra = {}) {
  const generatedAt = new Date();
  return {
    ...report,
    meta: {
      generated_at: generatedAt.toISOString(),
      generated_at_label: dates.formatReportDateTime(generatedAt),
      generated_by_name: extra.generatedBy || 'QA sample generator',
      version: 1,
      reference: extra.reference || `FT-QA-${generatedAt.getFullYear()}-SAMPLE`,
      status: 'READY',
      timezone: dates.REPORT_TZ,
    },
  };
}

async function loadAssets(university) {
  return {
    battechnoLogoDataUri: loadBattechnoLogoDataUri(),
    universityLogoDataUri: await loadInstitutionLogoDataUri(university?.logo_url || null),
  };
}

async function writePdf(html, filePath, label) {
  try {
    const buffer = await renderHtmlToPdf(html, {
      lang: 'ar',
      footerLeft: `BATTECHNO LMS · ${label}`,
      footerNote: dates.formatReportDateTime(new Date()),
    });
    fs.writeFileSync(filePath, buffer);
    const ok = buffer.slice(0, 5).toString() === '%PDF-';
    return { ok, bytes: buffer.length, error: ok ? null : 'PDF magic header missing' };
  } catch (err) {
    fs.writeFileSync(filePath.replace(/\.pdf$/i, '.html'), html);
    return { ok: false, bytes: 0, error: err.message, htmlFallback: true };
  }
}

async function inspectExcel(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb.worksheets.map((ws) => ({
    name: ws.name,
    rows: ws.rowCount,
    rtl: Boolean(ws.views?.[0]?.rightToLeft),
  }));
}

function inspectHtml(html) {
  return {
    rtl: /dir="rtl"/.test(html),
    googleFonts: /fonts\.googleapis\.com/.test(html),
    hasTitleUniversity: html.includes('التقرير الشامل للتدريب الميداني للجامعة'),
    hasTitleStudent: html.includes('التقرير الفردي للتدريب الميداني للطالب'),
    hasBattechno: html.includes('BATTECHNO LMS'),
    brokenImg: /<img[^>]+src=""/.test(html),
  };
}

async function findSafeUniversity() {
  const preferred = await prisma.universities.findMany({
    where: {
      status: 'active',
      OR: [
        { name: { contains: 'الشرق الأوسط' } },
        { name_en: { contains: 'Middle East', mode: 'insensitive' } },
        { code: { contains: 'MEU', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, name_en: true, code: true, logo_url: true },
    take: 10,
  });

  const preferredIds = new Set(preferred.map((u) => u.id));
  const others = await prisma.universities.findMany({
    where: {
      status: 'active',
      ...(preferred.length ? { id: { notIn: preferred.map((u) => u.id) } } : {}),
    },
    select: { id: true, name: true, name_en: true, code: true, logo_url: true },
    take: 40,
  });
  const candidates = [...preferred, ...others];

  let best = null;
  for (const uni of candidates) {
    const students = await prisma.users.findMany({
      where: { primary_university_id: uni.id },
      select: { id: true },
    });
    if (!students.length) continue;
    const ids = students.map((s) => s.id);
    const appCount = await prisma.field_training_applications.count({
      where: { student_id: { in: ids } },
    });
    if (!appCount) continue;
    const app = await prisma.field_training_applications.findFirst({
      where: { student_id: { in: ids } },
      select: { id: true },
      orderBy: { created_at: 'desc' },
    });
    const hit = {
      university: uni,
      applicationId: app.id,
      appCount,
      source: preferredIds.has(uni.id) ? 'meu' : 'other',
    };
    if (hit.source === 'meu') return hit;
    if (!best || hit.appCount > best.appCount) best = hit;
  }
  return best;
}

async function generateFromFixture() {
  const uniReport = stampMeta({
    report_title: 'التقرير الشامل للتدريب الميداني للجامعة',
    report_type: 'UNIVERSITY_FIELD_TRAINING_REPORT',
    university: { name: 'جامعة الاختبار', name_en: 'QA University', code: 'QA-UNI', specialties: [] },
    summary: { total_applicants: 0, completion_rate: null, average_attendance: null },
    funnel: [],
    opportunities: { rows: [] },
    organizations: { rows: [] },
    by_specialty: [],
    students: [],
    risk: [],
    recommendations: [],
    data_quality_warnings: ['تنبيه جودة البيانات: لا توجد بيانات تدريب ميداني آمنة في قاعدة البيانات الحالية.'],
  });
  const stuReport = stampMeta({
    report_title: 'التقرير الفردي للتدريب الميداني للطالب',
    report_type: 'STUDENT_FIELD_TRAINING_REPORT',
    student: {
      full_name: 'طالب تجريبي',
      university: uniReport.university,
      university_specialty_label: 'غير متوفر',
    },
    opportunity: { title: 'غير متوفر' },
    application: {},
    executive_summary: { tasks_required: false },
    sessions: [],
    submissions: [],
    tasks_required: false,
    requirements: [],
    completion_letter: { issued: false, status_label: 'لم تصدر الشهادة بعد' },
  });
  return { uniReport, stuReport, source: 'fixture' };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const notes = [];
  let source = 'fixture';
  let uniReport;
  let stuReport;
  let university = null;

  try {
    const found = await findSafeUniversity();
    if (found) {
      university = found.university;
      source = found.source === 'meu' ? 'middle_east_university' : 'other_university';
      uniReport = stampMeta(await reportRepo.buildUniversityReport(found.university.id, {}), {
        reference: `FT-UNI-${found.university.code || 'UNI'}-SAMPLE`,
      });
      stuReport = stampMeta(await reportRepo.buildStudentDetailedReport(found.applicationId, { exposeAiAudit: false }), {
        reference: `FT-STU-SAMPLE`,
      });
      notes.push(`DATA: ${source} — ${found.university.name} (${found.university.code || 'no-code'})`);
      notes.push(`STUDENT_APPLICATION: ${found.applicationId}`);
      notes.push(`UNIVERSITY_STUDENTS: ${uniReport.students?.length ?? 0}`);
    } else {
      notes.push('BLOCKED — no safe MEU field-training data');
      notes.push('FALLBACK: fixture used for layout QA only (not official data).');
      ({ uniReport, stuReport } = await generateFromFixture());
      university = uniReport.university;
    }
  } catch (err) {
    notes.push(`DATABASE_ERROR: ${err.message}`);
    notes.push('FALLBACK: fixture used for layout QA only (not official data).');
    ({ uniReport, stuReport } = await generateFromFixture());
    university = uniReport.university;
    source = 'fixture';
  }

  const uniAssets = await loadAssets(university || uniReport.university);
  const stuAssets = await loadAssets(stuReport.student?.university || university);
  notes.push(`BATTECHNO_LOGO: ${uniAssets.battechnoLogoDataUri ? 'loaded' : 'missing'}`);
  notes.push(`UNIVERSITY_LOGO: ${uniAssets.universityLogoDataUri ? 'loaded' : 'name fallback'}`);

  const uniHtml = renderUniversityReportHtml(uniReport, uniAssets);
  const stuHtml = renderStudentReportHtml(stuReport, stuAssets);
  fs.writeFileSync(path.join(OUT_DIR, 'university-report.html'), uniHtml);
  fs.writeFileSync(path.join(OUT_DIR, 'student-report.html'), stuHtml);
  notes.push(`HTML_UNIVERSITY: ${JSON.stringify(inspectHtml(uniHtml))}`);
  notes.push(`HTML_STUDENT: ${JSON.stringify(inspectHtml(stuHtml))}`);

  const uniPdf = await writePdf(uniHtml, path.join(OUT_DIR, 'university-field-training-report.pdf'), uniReport.meta.reference);
  const stuPdf = await writePdf(stuHtml, path.join(OUT_DIR, 'student-field-training-report.pdf'), stuReport.meta.reference);
  notes.push(`PDF_UNIVERSITY: ${JSON.stringify(uniPdf)}`);
  notes.push(`PDF_STUDENT: ${JSON.stringify(stuPdf)}`);

  const uniXlsx = path.join(OUT_DIR, 'university-field-training-report.xlsx');
  const stuXlsx = path.join(OUT_DIR, 'student-field-training-report.xlsx');
  fs.writeFileSync(uniXlsx, await exportUniversityReportExcel(uniReport));
  fs.writeFileSync(stuXlsx, await exportStudentReportExcel(stuReport));
  notes.push(`EXCEL_UNIVERSITY: ${JSON.stringify(await inspectExcel(uniXlsx))}`);
  notes.push(`EXCEL_STUDENT: ${JSON.stringify(await inspectExcel(stuXlsx))}`);
  notes.push(`SOURCE: ${source}`);
  notes.push(`OUT_DIR: ${OUT_DIR}`);

  const qaPath = path.join(OUT_DIR, 'QA_NOTES.txt');
  fs.writeFileSync(qaPath, `${notes.join('\n')}\n`);
  console.log(notes.join('\n'));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });

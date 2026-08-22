'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const {
  renderUniversityReportHtml,
  renderStudentReportHtml,
} = require('../src/modules/fieldTraining/fieldTrainingReport.template');
const {
  exportUniversityReportExcel,
  exportStudentReportExcel,
} = require('../src/modules/fieldTraining/fieldTrainingReport.excel');

function emptyUniversityReport(overrides = {}) {
  return {
    report_title: 'التقرير الشامل للتدريب الميداني للجامعة',
    report_type: 'UNIVERSITY_FIELD_TRAINING_REPORT',
    university: {
      name: 'جامعة الاختبار',
      name_en: 'Test University',
      code: 'TEST-UNI',
      specialties: [],
    },
    summary: {
      total_applicants: 0,
      completed_students: 0,
      completion_rate: null,
      average_attendance: null,
      total_training_hours: null,
      completion_letters_issued: 0,
    },
    filters: {},
    meta: {
      reference: 'TEST-UNI-UNI-2026-ABC',
      version: 1,
      generated_at_label: '22/08/2026 17:00',
      generated_by_name: 'QA',
    },
    funnel: [],
    opportunities: { rows: [] },
    organizations: { rows: [] },
    attendance: {},
    hours: {},
    tasks: {},
    assessments: { pre_post: { sample_size: 0 } },
    progress: { buckets: [] },
    completion: {},
    certificates: {},
    instructors: [],
    by_specialty: [],
    risk: [],
    recommendations: [],
    students: [],
    data_quality_warnings: ['تنبيه جودة البيانات: لا توجد سجلات حضور ضمن النطاق.'],
    ...overrides,
  };
}

function emptyStudentReport(overrides = {}) {
  return {
    report_title: 'التقرير الفردي للتدريب الميداني للطالب',
    report_type: 'STUDENT_FIELD_TRAINING_REPORT',
    student: {
      full_name: 'طالب تجريبي',
      email: 'student@example.edu',
      university: { name: 'جامعة الاختبار', name_en: 'Test University', code: 'TEST-UNI' },
      university_specialty_label: 'هندسة البرمجيات',
    },
    opportunity: { title: 'فرصة تجريبية', organization_name: 'جهة تدريب' },
    application: { status: 'approved', training_status: 'in_training' },
    executive_summary: {
      overall_progress: null,
      attendance_percentage: null,
      tasks_required: false,
      certificate_status_label: 'لم تصدر الشهادة بعد',
    },
    attendance_summary: {},
    training_hours: {},
    sessions: [],
    submissions: [],
    tasks_required: false,
    requirements: [{ key: 'tasks', label: 'المهام المطلوبة', label_ar: 'غير مطلوب' }],
    completion_letter: { issued: false, status_label: 'لم تصدر الشهادة بعد' },
    recommendations: [{ key: 'in_progress', text: 'التدريب الميداني ما زال قيد الإنجاز.' }],
    meta: { reference: 'TEST-STU-2026-ABC', version: 1, generated_at_label: '22/08/2026 17:00' },
    ...overrides,
  };
}

describe('field training report HTML', () => {
  it('university HTML is RTL, uses local fonts, and includes the official title', () => {
    const html = renderUniversityReportHtml(emptyUniversityReport());
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /Tahoma/);
    assert.match(html, /التقرير الشامل للتدريب الميداني للجامعة/);
    assert.match(html, /جامعة الاختبار/);
    assert.match(html, /BATTECHNO LMS/);
    assert.match(html, /الملخص التنفيذي/);
    assert.match(html, /تنبيه جودة البيانات/);
    assert.match(html, /غير متوفر/);
  });

  it('falls back to university names when no logo data URI is provided', () => {
    const html = renderUniversityReportHtml(emptyUniversityReport(), {});
    assert.match(html, /logo-fallback/);
    assert.doesNotMatch(html, /<img class="logo" src=""/);
  });

  it('student HTML uses the individual report title and empty-state wording', () => {
    const html = renderStudentReportHtml(emptyStudentReport());
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.match(html, /التقرير الفردي للتدريب الميداني للطالب/);
    assert.match(html, /طالب تجريبي/);
    assert.match(html, /غير مطلوب/);
  });
});

describe('field training report Excel', () => {
  it('university workbook has ordered RTL sheets without repair-required empties', async () => {
    const buffer = await exportUniversityReportExcel(emptyUniversityReport());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const names = wb.worksheets.map((ws) => ws.name);
    assert.deepEqual(names.slice(0, 3), ['01_الملخص_التنفيذي', '02_معلومات_الجامعة', '03_الطلاب']);
    assert.ok(names.includes('16_البيانات_الخام'));
    assert.ok(names.includes('15_الحالات_المعلقة'));
    const first = wb.getWorksheet('01_الملخص_التنفيذي');
    assert.equal(first.views?.[0]?.rightToLeft, true);
    const raw = wb.getWorksheet('16_البيانات_الخام');
    assert.notEqual(raw.getRow(1).getCell(1).value, 'application_id');
  });

  it('student workbook contains the nine official sheets', async () => {
    const buffer = await exportStudentReportExcel(emptyStudentReport());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const names = wb.worksheets.map((ws) => ws.name);
    assert.deepEqual(names, [
      '01_ملخص_الطالب',
      '02_معلومات_التدريب',
      '03_الحضور',
      '04_الساعات',
      '05_المهمات',
      '06_الاختبارات',
      '07_التقدم',
      '08_الإكمال',
      '09_الشهادة',
    ]);
  });

  it('student workbook coerces Prisma Decimal-like scores', async () => {
    const buffer = await exportStudentReportExcel(
      emptyStudentReport({
        submissions: [
          {
            task_title: 'مهمة',
            due_date: null,
            submitted_at: null,
            is_late: false,
            review_status: 'approved',
            manual_score: { toNumber: () => 17.5, toString: () => '17.5' },
            max_score: { toNumber: () => 20, toString: () => '20' },
            instructor_feedback: null,
          },
        ],
      })
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const tasks = wb.getWorksheet('05_المهمات');
    assert.equal(tasks.getRow(2).getCell(6).value, 17.5);
    assert.equal(tasks.getRow(2).getCell(7).value, 20);
  });
});

const { buildContentDisposition } = require('../src/modules/fieldTraining/fieldTrainingReport.controller');
const http = require('http');

describe('field training report download headers', () => {
  it('Content-Disposition stays ASCII when the filename contains Arabic', () => {
    const header = buildContentDisposition(
      'field-training-university-report-جامعة-الطفيلة-التقنية-2026-08-22.pdf'
    );
    assert.match(header, /^attachment; filename="/);
    assert.match(header, /filename\*=UTF-8''/);
    assert.equal(/^[\x20-\x7E]+$/.test(header), true);
    const res = new http.ServerResponse({ method: 'GET' });
    assert.doesNotThrow(() => res.setHeader('Content-Disposition', header));
  });
});

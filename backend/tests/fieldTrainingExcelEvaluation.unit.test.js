'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  seededFallback7to9,
  resolveTenPointRating,
  buildStudentExcelEvaluation,
  generalScoreFromCriteria,
  SCORE_SOURCE,
} = require('../src/modules/fieldTraining/fieldTrainingExcelEvaluation.scoring');
const {
  fillExcelEvaluationWorkbook,
  headerTexts,
  cellText,
} = require('../src/modules/fieldTraining/fieldTrainingExcelEvaluation.workbook');
const { SHEET_NAME, ELIGIBLE_AR, NOT_ELIGIBLE_AR } = require('../src/modules/fieldTraining/fieldTrainingExcelEvaluation.constants');

const TEMPLATE = path.join(__dirname, 'fixtures/tafila-field-training-excel-evaluation.xlsx');

function highPerformerSnapshot() {
  return {
    attendancePercentage: 100,
    hoursCompletionPercentage: 100,
    taskCompletionPercentage: 100,
    onTimeSubmissionPercentage: 100,
    averageTaskScore: 95,
    postAssessmentScore: 92,
    metrics: {
      attendanceMetric: 100,
      hoursMetric: 100,
      tasksCompletionMetric: 100,
      taskQualityMetric: 95,
      postAssessmentMetric: 92,
      onTimeMetric: 100,
    },
  };
}

describe('Tafila Excel evaluation scoring', () => {
  it('zeros every 1-10 rating and the general score for NOT_ELIGIBLE students', () => {
    const result = buildStudentExcelEvaluation({
      application: {
        id: 'app-1',
        opportunity_id: 'opp-1',
        completion_eligibility_status: 'ineligible',
        eligibility_reason: { reasons: ['training_hours_incomplete', 'attendance_below_minimum'] },
      },
      opportunity: { id: 'opp-1' },
      scoringInput: { completedHours: 40, attendancePercentage: 50, requiredHours: 140 },
      performanceSnapshot: highPerformerSnapshot(),
    });
    assert.equal(result.status, NOT_ELIGIBLE_AR);
    assert.equal(result.generalScore, 0);
    assert.equal(result.hours, 40);
    for (const rating of Object.values(result.ratings)) {
      assert.equal(rating.score, 0);
      assert.equal(rating.source, SCORE_SOURCE.NOT_ELIGIBLE_ZERO);
    }
    assert.match(result.ineligibilityReason, /الساعات/);
    assert.match(result.ineligibilityReason, /الحضور/);
  });

  it('uses performance evidence for a strong eligible student and 7-9 fallback only where needed', () => {
    const result = buildStudentExcelEvaluation({
      application: { id: 'app-2', opportunity_id: 'opp-1', completion_eligibility_status: 'eligible' },
      opportunity: { id: 'opp-1' },
      scoringInput: {
        completedHours: 140,
        attendancePercentage: 100,
        requiredHours: 140,
        supervisorRatings: {},
      },
      performanceSnapshot: highPerformerSnapshot(),
    });
    assert.equal(result.status, ELIGIBLE_AR);
    assert.equal(result.ineligibilityReason, '');
    assert.equal(result.ratings.commitment.score, 10);
    assert.equal(result.ratings.commitment.source, SCORE_SOURCE.PERFORMANCE_DERIVED);
    assert.equal(result.ratings.taskQuality.score, 10);
    assert.ok(result.ratings.cooperation.score >= 7 && result.ratings.cooperation.score <= 9);
    assert.equal(result.ratings.cooperation.source, SCORE_SOURCE.ADMINISTRATIVE_FALLBACK_7_9);
    assert.equal(result.ratings.problemSolving.score, result.ratings.problemSolvingDuplicate.score);
    assert.ok(result.generalScore >= 70 && result.generalScore <= 100);
  });

  it('keeps authorized 7-9 fallback stable for the same student and criterion', () => {
    const a = seededFallback7to9('app-9', 'opp-9', 'cooperation');
    const b = seededFallback7to9('app-9', 'opp-9', 'cooperation');
    const c = seededFallback7to9('app-9', 'opp-9', 'teamwork');
    assert.equal(a, b);
    assert.ok([7, 8, 9].includes(a));
    assert.ok([7, 8, 9].includes(c));
  });

  it('does not replace a real supervisor rating with fallback', () => {
    const rating = resolveTenPointRating({
      eligible: true,
      applicationId: 'app-3',
      opportunityId: 'opp-1',
      criterionCode: 'cooperation',
      supervisorScore: 4,
    });
    assert.equal(rating.score, 8);
    assert.equal(rating.source, SCORE_SOURCE.REAL_SUPERVISOR_RATING);
  });

  it('computes the general /100 score from the 1-10 criteria', () => {
    assert.equal(generalScoreFromCriteria([10, 10, 10, 10, 8, 8, 8, 9, 9]), 91);
  });

  it('does not turn unknown completed hours into zero', () => {
    const result = buildStudentExcelEvaluation({
      application: { id: 'app-h', opportunity_id: 'opp-1', completion_eligibility_status: 'ineligible' },
      opportunity: { id: 'opp-1' },
      scoringInput: { completedHours: null, requiredHours: 140 },
    });
    assert.equal(result.hours, 'غير متوفر');
    assert.equal(result.ratings.commitment.score, 0);
  });
});

describe('Tafila Excel workbook fill', () => {
  it('preserves the Form Responses sheet, adds required columns, and writes one row per student', async () => {
    const eligible = buildStudentExcelEvaluation({
      application: { id: 'app-e', opportunity_id: 'opp-t', completion_eligibility_status: 'eligible' },
      opportunity: { id: 'opp-t' },
      scoringInput: { completedHours: 140, attendancePercentage: 100, requiredHours: 140 },
      performanceSnapshot: highPerformerSnapshot(),
      taskTitles: ['إنشاء صفحة تسجيل دخول', 'اختبار API'],
    });
    const ineligible = buildStudentExcelEvaluation({
      application: {
        id: 'app-n',
        opportunity_id: 'opp-t',
        completion_eligibility_status: 'ineligible',
        eligibility_reason: { reasons: ['post_assessment_missing'] },
      },
      opportunity: { id: 'opp-t' },
      scoringInput: { completedHours: 20, attendancePercentage: 40, requiredHours: 140 },
      performanceSnapshot: highPerformerSnapshot(),
    });
    const first = await fillExcelEvaluationWorkbook(fs.readFileSync(TEMPLATE), [
      {
        supervisorName: 'خالد المشرف',
        supervisorPhone: '0790000000',
        supervisorEmail: 'company@example.com',
        studentName: 'أحمد علي سالم',
        universityNumber: '2020123456',
        universityName: 'جامعة الطفيلة التقنية',
        hours: eligible.hours,
        ratings: eligible.ratings,
        status: eligible.status,
        ineligibilityReason: eligible.ineligibilityReason,
        generalScore: eligible.generalScore,
        tasksText: eligible.tasksText,
      },
      {
        supervisorName: 'خالد المشرف',
        supervisorPhone: '0790000000',
        supervisorEmail: 'company@example.com',
        studentName: 'سارة أحمد',
        universityNumber: '2020654321',
        universityName: 'جامعة الطفيلة التقنية',
        hours: ineligible.hours,
        ratings: ineligible.ratings,
        status: ineligible.status,
        ineligibilityReason: ineligible.ineligibilityReason,
        generalScore: ineligible.generalScore,
        tasksText: ineligible.tasksText,
      },
    ]);
    const second = await fillExcelEvaluationWorkbook(fs.readFileSync(TEMPLATE), [
      {
        supervisorName: 'خالد المشرف',
        supervisorPhone: '0790000000',
        supervisorEmail: 'company@example.com',
        studentName: 'أحمد علي سالم',
        universityNumber: '2020123456',
        universityName: 'جامعة الطفيلة التقنية',
        hours: eligible.hours,
        ratings: eligible.ratings,
        status: eligible.status,
        ineligibilityReason: eligible.ineligibilityReason,
        generalScore: eligible.generalScore,
        tasksText: eligible.tasksText,
      },
    ]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(first);
    assert.equal(wb.worksheets[0].name, SHEET_NAME);
    assert.equal(wb.worksheets[0].views?.[0]?.rightToLeft, true);
    const headers = headerTexts(wb.worksheets[0]);
    assert.ok(headers.includes('الجامعة'));
    assert.ok(headers.includes('الحالة'));
    assert.ok(headers.some((text) => /سبب عدم التأهيل/.test(text)));
    assert.equal(headers.filter((text) => /ابتكار حلول للمشكلات/.test(text)).length, 2);
    assert.equal(wb.worksheets[0].rowCount, 3);
    const row2 = wb.worksheets[0].getRow(2);
    const nameCol = headers.findIndex((text) => /اسم الطالب/.test(text)) + 1;
    const numberCol = headers.findIndex((text) => /الرقم الجامعي/.test(text)) + 1;
    const uniCol = headers.findIndex((text) => text === 'الجامعة') + 1;
    const statusCol = headers.findIndex((text) => text === 'الحالة') + 1;
    assert.equal(cellText(row2.getCell(nameCol)), 'أحمد علي سالم');
    assert.equal(cellText(row2.getCell(numberCol)), '2020123456');
    assert.equal(cellText(row2.getCell(uniCol)), 'جامعة الطفيلة التقنية');
    assert.equal(cellText(row2.getCell(statusCol)), ELIGIBLE_AR);
    const notEligibleRow = wb.worksheets[0].getRow(3);
    assert.equal(cellText(notEligibleRow.getCell(statusCol)), NOT_ELIGIBLE_AR);
    const hoursCol = headers.findIndex((text) => /عدد الساعات/.test(text)) + 1;
    assert.equal(cellText(wb.worksheets[0].getRow(2).getCell(hoursCol)), '140');
    assert.equal(cellText(notEligibleRow.getCell(hoursCol)), '20');
    const scoreCols = headers
      .map((text, index) => (/من 1 الى 10/.test(text) ? index + 1 : null))
      .filter(Boolean);
    for (const col of scoreCols) {
      assert.equal(Number(notEligibleRow.getCell(col).value), 0);
    }

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(second);
    const headers2 = headerTexts(wb2.worksheets[0]);
    const coopCol = headers2.findIndex((text) => /تعاونا/.test(text)) + 1;
    assert.equal(
      wb.worksheets[0].getRow(2).getCell(coopCol).value,
      wb2.worksheets[0].getRow(2).getCell(coopCol).value
    );
  });
});

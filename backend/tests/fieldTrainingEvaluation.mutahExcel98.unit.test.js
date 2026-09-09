'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const JSZip = require('jszip');
const { officialTemplatePath } = require('../scripts/lib/mutahOfficialEvaluationTemplate');
const {
  ensureScoreGridRtl,
  fillScoreGridTable,
  scoreGridHeaderCells,
  ratingColumnIndexForScore,
  assertDesiredScoreGridHeaderOrder,
  cellPlainText,
  countBidiVisual,
  scoreGridIsVisualLtr,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const {
  applyMutahSoftDeliveryPayload,
  matchExcelRowsToApplications,
  reconcileZipUniversityNumbers,
  PROFESSIONAL_INCOMPLETE_TOTAL_AR,
  UNAVAILABLE_AR,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.mutahExcelDelivery');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const path = require('path');

async function loadScoreTable() {
  const zip = await JSZip.loadAsync(fs.readFileSync(officialTemplatePath()));
  const xml = await zip.file('word/document.xml').async('string');
  return [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
}

describe('Mutah score grid RTL orientation', () => {
  it('preserves the source V11 table direction and does not add w:bidiVisual', async () => {
    const score = await loadScoreTable();
    assert.equal(scoreGridIsVisualLtr(score), true);
    assert.equal(countBidiVisual(score), 0);
    const originalHeaders = scoreGridHeaderCells(score);
    const ensured = ensureScoreGridRtl(score);
    assert.equal(countBidiVisual(ensured), 0);
    const headers = scoreGridHeaderCells(ensured);
    assert.deepEqual(headers, originalHeaders);
    assert.equal(assertDesiredScoreGridHeaderOrder(headers), true);
    assert.match(headers[0], /(?:ف|ض)عيف\s*1/);
    assert.match(headers[4], /ممتاز\s*5/);
    assert.match(headers[headers.length - 2], /مجال التقييم/);
    assert.match(headers[headers.length - 1], /الرقم/);
    const again = ensureScoreGridRtl(ensured);
    assert.equal(countBidiVisual(again), 0);
    assert.deepEqual(scoreGridHeaderCells(again), headers);
    assert.equal(ensured.includes('w:tblpPr') || score.includes('w:tblpPr'), true);
  });

  it('maps C1=1 … C5=5 checkmarks under the correct semantic score columns', async () => {
    const score = await loadScoreTable();
    const filled = fillScoreGridTable(score, {
      criterion_1_score: 1,
      criterion_2_score: 2,
      criterion_3_score: 3,
      criterion_4_score: 4,
      criterion_5_score: 5,
      professional_evaluation_total: 15,
    });
    assert.equal(countBidiVisual(filled), 0);
    const headers = scoreGridHeaderCells(filled);
    assert.equal(assertDesiredScoreGridHeaderOrder(headers), true);
    const rows = [...filled.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].slice(1, 6);
    const expected = [1, 2, 3, 4, 5];
    rows.forEach((row, index) => {
      const cells = [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const marked = cells
        .map((cell, cellIndex) => (cellPlainText(cell[0]).includes('✓') ? cellIndex : null))
        .filter((value) => value != null);
      const expectedCol = ratingColumnIndexForScore(headers, expected[index]);
      assert.deepEqual(marked, [expectedCol], `C${index + 1} should mark column ${expectedCol}`);
      assert.match(headers[expectedCol], new RegExp(String(expected[index])));
    });
  });

  it('does not reverse table cells or the score array when placing checkmarks', () => {
    const source = fs.readFileSync(
      require.resolve('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill'),
      'utf8'
    );
    assert.doesNotMatch(source, /\.reverse\(/);
    assert.doesNotMatch(source, /reverseCells\s*\(|reverseColumns\s*\(|scoreColumns\.reverse/);
    assert.match(source, /ratingColumnIndexForScore/);
  });

  it('places all 10 NOT_ELIGIBLE checkmarks under ضعيف and writes total 10', async () => {
    const score = await loadScoreTable();
    const filled = fillScoreGridTable(score, {
      eligibility_status: 'NOT_ELIGIBLE',
      professional_evaluation_total: 10,
      criterion_1_score: 1,
      criterion_2_score: 1,
      criterion_3_score: 1,
      criterion_4_score: 1,
      criterion_5_score: 1,
      criterion_6_score: 1,
      criterion_7_score: 1,
      criterion_8_score: 1,
      criterion_9_score: 1,
      criterion_10_score: 1,
    });
    const headers = scoreGridHeaderCells(filled);
    const weakCol = ratingColumnIndexForScore(headers, 1);
    assert.match(headers[weakCol], /(?:ف|ض)عيف\s*1/);
    const rows = [...filled.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].slice(1, 11);
    rows.forEach((row) => {
      const cells = [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const marked = cells
        .map((cell, cellIndex) => (cellPlainText(cell[0]).includes('✓') ? cellIndex : null))
        .filter((value) => value != null);
      assert.deepEqual(marked, [weakCol]);
    });
    assert.match(cellPlainText(filled), /المجموع:\s*10/);
  });
});

describe('Mutah excel soft delivery helpers', () => {
  it('parses fixture with exactly 98 students', async () => {
    const fixture = path.join(
      __dirname,
      'fixtures/mutah-field-training-supervisor-assignments.xlsx'
    );
    const parsed = await parseSupervisorAssignmentWorkbook(fixture);
    assert.equal(parsed.rows.length, 98);
  });

  it('fills authorized eligible missing criteria with 5 and assigns not-eligible scores of 1', () => {
    const eligible = applyMutahSoftDeliveryPayload({
      student_name: 'أ',
      student_number: '1',
      eligibility_status: 'ELIGIBLE',
      criterion_1_score: 4,
      criterion_2_score: 4,
      criterion_5_score: 4,
      criterion_9_score: 4,
      general_comments: 'حالة الطالب: مؤهل',
    });
    assert.equal(eligible.criterion_3_score, 5);
    assert.equal(eligible.criterion_6_score, 5);
    assert.equal(eligible.professional_evaluation_total, 46);

    const ineligible = applyMutahSoftDeliveryPayload({
      student_name: 'ب',
      student_number: '2',
      eligibility_status: 'NOT_ELIGIBLE',
      criterion_1_score: 3,
      general_comments: 'حالة الطالب: غير مؤهل',
    });
    assert.equal(ineligible.criterion_1_score, 1);
    assert.equal(ineligible.criterion_3_score, 1);
    assert.equal(ineligible.professional_evaluation_total, 10);
    assert.equal(ineligible.professional_evaluation_status, 'POLICY_ASSIGNED_NOT_ELIGIBLE');
    assert.equal(ineligible.professional_score_source, 'POLICY_ASSIGNED_NOT_ELIGIBLE');
    assert.equal(ineligible.field_supervisor_name, UNAVAILABLE_AR);
  });

  it('matches excel rows by university number and reconciles ZIP numbers', () => {
    const excelRows = [
      { universityNumber: '120232222080', universityEmail: 'a@mutah.edu.jo', studentName: 'عمر' },
      { universityNumber: '999', universityEmail: 'missing@mutah.edu.jo', studentName: 'غير موجود' },
    ];
    const apps = [
      {
        id: 'app-1',
        users: { university_student_number: '120232222080', email: 'a@mutah.edu.jo' },
      },
    ];
    const matched = matchExcelRowsToApplications(excelRows, apps);
    assert.equal(matched.matched.length, 1);
    assert.equal(matched.unmatched.length, 1);
    assert.equal(matched.unmatched[0].code, 'REPORT_REQUIRES_FALLBACK_DATA');

    const zipCheck = reconcileZipUniversityNumbers(
      excelRows.map((r) => r.universityNumber),
      ['120232222080', '999']
    );
    assert.equal(zipCheck.ok, true);
    assert.equal(zipCheck.missingFromZip.length, 0);
  });
});

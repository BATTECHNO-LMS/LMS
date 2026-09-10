'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateOpportunityReportDataset,
  sortReportRows,
  humanSourceAr,
  TAFILA_ONLINE_EXPECTED,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
} = require('../src/modules/fieldTraining/fieldTraining.cohortReports.service');
const { SOURCE } = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');

function row(partial) {
  return {
    applicationId: partial.applicationId || 'a1',
    studentName: partial.studentName || 'طالب',
    universityNumber: partial.universityNumber || '320220600001',
    status: partial.status || 'eligible',
    approvedFinalScore: partial.approvedFinalScore ?? 90,
    attendancePoints: partial.attendancePoints ?? 20,
    postAssessmentPoints: partial.postAssessmentPoints ?? 20,
    taskPoints: partial.taskPoints ?? 30,
    behaviorPoints: partial.behaviorPoints ?? 20,
    submittedTaskCount: partial.submittedTaskCount ?? 4,
    requiredTaskCount: partial.requiredTaskCount ?? 4,
    reasons: partial.reasons || [],
    opportunityId: partial.opportunityId || PRIMARY_TAFILA_OPPORTUNITY_ID,
    source: partial.source || SOURCE.AUTHORIZED_MANUAL_REVIEW,
  };
}

describe('Field training cohort reporting', () => {
  it('sorts eligible before not eligible then by Arabic name', () => {
    const sorted = sortReportRows([
      row({ studentName: 'يوسف', status: 'ineligible', approvedFinalScore: 0 }),
      row({ studentName: 'أحمد', status: 'eligible' }),
      row({ studentName: 'بشار', status: 'eligible' }),
    ]);
    assert.equal(sorted[0].studentName, 'أحمد');
    assert.equal(sorted[1].studentName, 'بشار');
    assert.equal(sorted[2].status, 'ineligible');
  });

  it('translates approved sources to Arabic labels', () => {
    assert.equal(humanSourceAr(SOURCE.AUTHORIZED_MANUAL_REVIEW), 'مراجعة واعتماد نهائي');
    assert.equal(
      humanSourceAr(SOURCE.AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT),
      'نتيجة معتمدة بعد المراجعة'
    );
    assert.equal(humanSourceAr(SOURCE.EXCEL_BASELINE), 'النتيجة النهائية المعتمدة');
  });

  it('validates Tafila expected counts and score integrity', () => {
    const students = [];
    for (let i = 0; i < 146; i += 1) {
      students.push(
        row({
          universityNumber: `E${String(i).padStart(6, '0')}`,
          status: 'eligible',
          approvedFinalScore: 90,
          attendancePoints: 20,
          postAssessmentPoints: 20,
          taskPoints: 30,
          behaviorPoints: 20,
        })
      );
    }
    for (let i = 0; i < 5; i += 1) {
      students.push(
        row({
          universityNumber: `N${String(i).padStart(6, '0')}`,
          status: 'ineligible',
          approvedFinalScore: i === 0 ? 59.4 : 0,
          attendancePoints: i === 0 ? 20 : 0,
          postAssessmentPoints: i === 0 ? 14.4 : 0,
          taskPoints: i === 0 ? 16.2 : 0,
          behaviorPoints: i === 0 ? 8.8 : 0,
          reasons: ['غير مؤهل'],
        })
      );
    }
    assert.equal(students.length, TAFILA_ONLINE_EXPECTED.students);
    const validation = validateOpportunityReportDataset(PRIMARY_TAFILA_OPPORTUNITY_ID, students);
    assert.equal(validation.ready, true);
    assert.equal(validation.statusAr, 'جاهز للإصدار');
  });

  it('flags eligible stale failure reasons and breakdown mismatches', () => {
    const students = [
      row({
        universityNumber: '1',
        approvedFinalScore: 90,
        attendancePoints: 20,
        postAssessmentPoints: 20,
        taskPoints: 20,
        behaviorPoints: 20,
        reasons: ['لم يستكمل جميع التاسكات المطلوبة'],
      }),
      row({
        universityNumber: '2',
        approvedFinalScore: 80,
        attendancePoints: 10,
        postAssessmentPoints: 10,
        taskPoints: 10,
        behaviorPoints: 10,
      }),
    ];
    // pad to avoid primary count checks dominating — use non-primary opportunity
    const validation = validateOpportunityReportDataset('other-opportunity-id', students);
    assert.equal(validation.ready, false);
    assert.ok(validation.issues.some((i) => i.name === 'eligible_stale_failure_reason_zero'));
    assert.ok(validation.issues.some((i) => i.name === 'score_breakdown_mismatch_zero'));
  });

  it('keeps second opportunity isolated from primary expected counts', () => {
    const validation = validateOpportunityReportDataset('01666ebc-bfc1-4948-87a5-2add3f641c65', [
      row({
        opportunityId: '01666ebc-bfc1-4948-87a5-2add3f641c65',
        universityNumber: '320200601081',
        status: 'ineligible',
        approvedFinalScore: 0,
        attendancePoints: 0,
        postAssessmentPoints: 0,
        taskPoints: 0,
        behaviorPoints: 0,
      }),
    ]);
    assert.equal(
      validation.checks.some((c) => c.name === 'students_151'),
      false
    );
    assert.equal(validation.ready, true);
  });
});

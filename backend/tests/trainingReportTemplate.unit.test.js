'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildTrainingReportHtml } = require('../src/modules/trainingPrograms/trainingReport.template');

describe('trainingReport.template', () => {
  it('renders Arabic RTL cover and individual sections without throwing', () => {
    const html = buildTrainingReportHtml(
      {
        report_type: 'INDIVIDUAL',
        version: 1,
        reference_code: 'TR-IND-2026-TEST',
        snapshot_json: {
          meta: {
            reportTitle: 'التقرير الفردي لنتائج المتدرب',
            courseName: 'اجتياز مقابلات العمل',
            institutionName: 'مؤسسة ولي العهد',
            platformName: 'BATTECHNO LMS',
            platformNameAr: 'شركة الرجل الوطواط للتكنولوجيا',
            trainingDates: { startLabel: '2 أغسطس 2026', endLabel: '3 أغسطس 2026' },
            totalHours: 6,
            generatedAtLabel: '4 أغسطس 2026',
            confidentiality: 'سري',
          },
          identity: { fullName: 'متدرب تجريبي', institution: 'مؤسسة ولي العهد', course: 'اجتياز مقابلات العمل' },
          executiveSummary: {
            finalStatus: 'COMPLETED',
            attendancePct: 90,
            preTestScore: 55,
            postTestScore: 85,
            improvementPp: 30,
            evaluationSubmitted: true,
            certificateStatus: 'ISSUED',
          },
          attendance: { totalSessions: 2, present: 2, attendancePctLabel: '100%', sessions: [] },
          preTest: { statusLabel: '55%' },
          postTest: { statusLabel: '85%' },
          learningImprovement: {
            preTestScore: 55,
            postTestScore: 85,
            percentagePointDifference: 30,
            relativeImprovementPct: 54.55,
            note: 'فرق النقاط المئوية',
          },
          tasks: { rows: [] },
          requirements: [{ code: 'attendance', title: 'الحضور', label: 'مكتمل', state: 'completed' }],
          completion: { status: 'COMPLETED', missingRequirements: [] },
          certificate: { status: 'ISSUED', certificateNumber: 'C-1' },
          recommendation: 'حقق المتدرب تحسنًا قدره 30 نقطة مئوية.',
        },
      },
      { battechnoLogoDataUri: null, institutionLogoDataUri: null }
    );
    assert.match(html, /dir="rtl"/);
    assert.match(html, /التقرير الفردي لنتائج المتدرب/);
    assert.match(html, /مؤسسة ولي العهد/);
    assert.match(html, /BATTECHNO LMS/);
    assert.match(html, /جدول المحتويات/);
  });

  it('uses a single-brand cover when institution is BATTECHNO', () => {
    const html = buildTrainingReportHtml(
      {
        report_type: 'COURSE',
        version: 1,
        reference_code: 'TR-CRS-2026-BAT',
        snapshot_json: {
          meta: {
            reportTitle: 'التقرير الشامل للدورة',
            courseName: 'الدبلوم التشغيلي الرقمي',
            institutionName: 'شركة الرجل الوطواط للتكنولوجيا – BATTECHNO',
            institutionCode: 'BATTECHNO',
            singleBrand: true,
            platformName: 'BATTECHNO LMS',
            platformNameAr: 'شركة الرجل الوطواط للتكنولوجيا',
            trainingDates: { startLabel: null, endLabel: null },
            totalHours: null,
            generatedAtLabel: '10 أغسطس 2026',
            confidentiality: 'سري',
          },
          executiveSummary: { enrolled: 0 },
        },
      },
      { battechnoLogoDataUri: null, institutionLogoDataUri: 'data:image/png;base64,AAA', singleBrand: true }
    );
    assert.match(html, /cover__brands--single/);
    assert.match(html, /تنفيذ وتشغيل/);
    assert.doesNotMatch(html, /بالتعاون مع/);
    assert.doesNotMatch(html, /logo--institution/);
  });
});

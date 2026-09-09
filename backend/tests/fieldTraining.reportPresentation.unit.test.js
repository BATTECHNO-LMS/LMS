'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const present = require('../src/utils/fieldTraining.reportPresentation');
const {
  renderComprehensiveReportHtml,
} = require('../src/modules/fieldTraining/fieldTraining.comprehensiveReport.service');

function sampleReport(overrides = {}) {
  return {
    generatedAtLabelAr: '8 أيلول 2026',
    student: {
      fullName: 'ليث محمد أحمد بريوش',
      universityNumber: '320230601066',
      university: 'جامعة الطفيلة التقنية',
      specialty: 'نظم المعلومات الحاسوبية',
      email: '320230601066@ttu.edu.jo',
      phone: null,
    },
    opportunity: {
      title: 'التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026',
      organizationName: 'BATMAN TECHNOLOGY',
      trainingModeAr: 'عن بعد',
      periodLabelAr: 'من 23 تموز 2026 إلى 5 أيلول 2026',
      requiredTrainingHours: 140,
      minimumAttendancePercentage: 80,
      requiresFinalTask: false,
      requiresFinalTaskLabelAr: 'غير مطلوبة',
    },
    application: {
      status: 'approved',
      statusLabelAr: 'معتمد',
      trainingStatus: 'completed',
      trainingStatusLabelAr: 'مكتمل',
      eligibilityStatus: 'ineligible',
      academicSupervisorName: null,
    },
    eligibility: {
      finalScore: 59.4,
      passingScore: 80,
      workflowOutcome: 'ineligible',
      scoreBreakdown: {
        attendancePoints: 20,
        postAssessmentPoints: 14.4,
        taskPoints: 16.2,
        behaviorPoints: 8.8,
      },
      mandatoryGates: [
        { key: 'attendance', nameAr: 'الحضور', labelAr: 'مستوفى', status: 'passed' },
        { key: 'hours', nameAr: 'الساعات التدريبية', labelAr: 'مستوفى', status: 'passed' },
        { key: 'preAssessment', nameAr: 'التقييم القبلي', labelAr: 'مكتمل', status: 'complete' },
        { key: 'postAssessment', nameAr: 'التقييم البعدي', labelAr: 'مكتمل', status: 'complete' },
        { key: 'tasks', nameAr: 'التاسكات المطلوبة', labelAr: 'غير مكتمل', status: 'incomplete' },
        { key: 'behavior', nameAr: 'تقييم السلوك والالتزام', labelAr: 'غير مكتمل', status: 'incomplete' },
        { key: 'finalScore', nameAr: 'الحد الأدنى للعلامة النهائية', labelAr: 'غير مستوفى', status: 'failed' },
      ],
      eligibilityReasonLabels: [
        'قرار إداري معتمد بعدم التأهيل مع الاحتفاظ بالعلامات الفعلية للطالب.',
      ],
      approvedEvaluationResult: {
        source: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
        sourceLabelAr: 'قرار إداري معتمد',
        approvedFinalScore: 59.4,
      },
    },
    scoring: { finalScore: 59.4, passingScore: 80, components: {} },
    attendance: {
      percentage: 100,
      attended: 8,
      requiredSessions: 8,
      completedHours: 140,
      requiredHours: 140,
      counts: { present: 8, late: 0, excused: 0, absent: 0 },
      sessions: [
        {
          dateLabelAr: '30 تموز 2026',
          title: 'المحاضرة الرابعة - جامعة الطفيلة - 30/7/2026',
          statusLabelAr: 'حاضر',
          durationHours: 4,
          isRequired: true,
        },
      ],
    },
    tasks: {
      requiredCount: 4,
      completedCount: 2,
      submittedCount: 2,
      items: [
        {
          title: 'المهمة الأولى: تصميم قاعدة بيانات متجر إلكتروني باستخدام PostgreSQL',
          submissionStatus: 'SUBMITTED',
          submissionStatusLabelAr: 'مسلّم',
          reviewStatusLabelAr: 'تم التقييم',
          accepted: true,
          approvedTaskScore: 84,
          maxScore: 100,
          submittedAtLabelAr: '1 آب 2026',
        },
        {
          title: 'المهمة الثانية: بناء واختبار REST API باستخدام Node.js وExpress وربطه بقاعدة البيانات',
          submissionStatus: 'SUBMITTED',
          submissionStatusLabelAr: 'مسلّم',
          reviewStatusLabelAr: 'تم التقييم',
          accepted: true,
          approvedTaskScore: 78,
          maxScore: 100,
          submittedAtLabelAr: '5 آب 2026',
        },
        {
          title: 'المهمة الثالثة: فحص وتأمين REST API وفق أساسيات أمن تطبيقات الويب',
          submissionStatus: 'NOT_SUBMITTED',
          submissionStatusLabelAr: 'غير مسلّم',
          reviewStatusLabelAr: 'لم يتم التقييم',
          accepted: false,
          approvedTaskScore: null,
          submittedAtLabelAr: null,
        },
        {
          title: 'المهمة الرابعة: تصميم وتنفيذ واجهة متجر إلكتروني باستخدام React',
          submissionStatus: 'NOT_SUBMITTED',
          submissionStatusLabelAr: 'غير مسلّم',
          reviewStatusLabelAr: 'لم يتم التقييم',
          accepted: false,
          approvedTaskScore: null,
          submittedAtLabelAr: null,
        },
      ],
    },
    assessments: {
      pre: { completed: true, score: 84, maxScore: 100, submittedAtLabelAr: '25 تموز 2026', statusLabelAr: 'مكتمل' },
      post: { completed: true, score: 72, maxScore: 100, submittedAtLabelAr: '7 أيلول 2026', statusLabelAr: 'مكتمل' },
    },
    professionalEvaluation: {
      behaviorPoints: 8.8,
      criteria: [
        { labelAr: 'الالتزام', score: 2, maxScore: 5 },
        { labelAr: 'التعاون', score: null, maxScore: 5 },
      ],
    },
    activitySummary: {
      lastLoginAtLabelAr: '7 أيلول 2026',
      attendanceEventsCount: 8,
      requiredSessionsCount: 8,
      taskSubmissionsCount: 2,
      requiredTasksCount: 4,
      assessmentsCompletedCount: 2,
      assessmentsRequiredCount: 2,
      loginCountAvailable: false,
      loginNoteAr:
        'ملاحظة: لا تتوفر بيانات كاملة لعدد مرات تسجيل الدخول خلال كامل فترة التدريب.',
    },
    activityTimeline: [
      { atLabelAr: '7 أيلول 2026', categoryLabelAr: 'تقييم', title: '', description: '' },
      {
        atLabelAr: '5 آب 2026',
        categoryLabelAr: 'تاسك',
        title: 'تسليم مهمة',
        description: 'تم تسليم المهمة الثانية',
      },
    ],
    ...overrides,
  };
}

describe('field training report presentation polish', () => {
  it('formats scores and counts without RTL ambiguity', () => {
    assert.equal(present.ltrScore(59.4, 100), '59.4 / 100');
    assert.match(present.scoreHtml(14.4, 20), /dir="ltr"/);
    assert.equal(present.countOfHtml(2, 4), '2 من 4');
  });

  it('maps statuses to natural Arabic and hides technical sources', () => {
    assert.equal(present.labelApplicationStatus('approved'), 'معتمد');
    assert.equal(present.labelTrainingStatus('completed'), 'مكتمل');
    assert.equal(present.labelEligibilityStatus('ineligible'), 'غير مؤهل');
    assert.equal(present.labelSourceHuman('AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE'), 'قرار إداري معتمد');
    assert.equal(present.labelSourceHuman('EXCEL_BASELINE'), 'النتيجة النهائية المعتمدة');
  });

  it('builds factual not-eligible reasons instead of admin jargon', () => {
    const reasons = present.buildNotEligibleReasonsAr(sampleReport());
    assert.ok(reasons.some((r) => r.includes('2 من أصل 4')));
    assert.ok(reasons.some((r) => r.includes('السلوك والالتزام')));
    assert.ok(reasons.some((r) => r.includes('59.4')));
    assert.equal(reasons.some((r) => /AUTHORIZED|قرار إداري معتمد بعدم/.test(r)), false);
  });

  it('renders polished HTML without forbidden tokens', () => {
    const html = renderComprehensiveReportHtml(sampleReport(), {});
    assert.match(html, /cover__title[\s\S]*#ffffff/i);
    assert.match(html, /تقرير الطالب الشامل/);
    assert.match(html, /للتدريب الميداني/);
    assert.match(html, /dir="ltr">59\.4 \/ 100/);
    assert.match(html, /2 من 4/);
    assert.match(html, /تقييم السلوك والالتزام/);
    assert.match(html, /أسباب عدم التأهيل/);
    assert.match(html, /بيانات التقرير/);
    assert.doesNotMatch(html, /\u2014/);
    assert.doesNotMatch(html, /AUTHORIZED_/);
    assert.doesNotMatch(html, /EXCEL_BASELINE/);
    assert.doesNotMatch(html, /applicationId|opportunityId/);
    assert.doesNotMatch(html, /c8ca4e24-65f0-4a0e-96e0-6042042c7556/);
    assert.doesNotMatch(html, /2026-09-08T/);
    assert.doesNotMatch(html, /العلامة السابقة في ملف التقييم/);
    assert.doesNotMatch(html, /مصدر الاعتماد/);
    assert.doesNotMatch(html, /معرّف الطلب|معرف الطلب/);
    assert.match(html, /المحاضرة الرابعة/);
    assert.doesNotMatch(html, /المحاضرة الرابعة - جامعة الطفيلة - 30\/7\/2026/);
    const findings = present.assertNoForbiddenPresentation(html);
    assert.deepEqual(findings, []);
  });
});
